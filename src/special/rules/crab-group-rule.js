const path = require("path");
const fs = require("fs");
const BaseAirdropRule = require('./base-rule');
const { buildVirtualHoldings } = require('./lp-virtual-holdings');
const { createPublicClient, http } = require('viem');
const CrabAPI = require('../../crab/api');
const DarwiniaAPI = require('../../darwinia/api');

const CRAB_RPC_URL = 'https://crab-rpc.darwinia.network';
const CKTON_TREASURY_ADDRESS = '0xB633Ad1142941CA2Eb9C350579cF88BbE266660D';

class CrabGroupRule extends BaseAirdropRule {
	constructor(config = {}) {
		super(
			'crab_group',
			'CRAB Group (CRAB + WCRAB + gCRAB + xWCRAB + WCRING + rewards)',
			config
		);
	}

	async calculate(existingRecipients, options = {}) {
		const dataDir = path.join(__dirname, '..', '..', '..', 'data');
		const crabCache = this.loadCrabCache();
		const darwiniaCache = this.loadDarwiniaCache();

		console.log(`📊 Processing CRAB Group rule...`);

		const crabNative = this.loadCrabNativeHolders();
		const wcrabHolders = this.loadTokenHolders(dataDir, 'WCRAB', crabCache);
		const gcrabHolders = this.loadTokenHolders(dataDir, 'gCRAB', crabCache);
		const wcringHolders = this.loadTokenHolders(dataDir, 'WCRING', crabCache);
		const xwcrabHolders = await this.loadXwcrabHolders(dataDir, darwiniaCache);
		const virtualHoldings = buildVirtualHoldings(['CRAB', 'WCRAB', 'gCRAB', 'xWCRAB', 'WCRING']);
		// Rewards and deposit balances are added as extra CRAB group balances.
		const crabStakingRewards = this.loadCrabStakingRewards(crabCache);
		const cktonStakingRewards = this.loadCktonStakingRewards(crabCache);
		const crabDepositBalances = this.loadCrabDepositBalances(crabCache);
		const cktonGroupBalances = this.loadCktonGroupBalances(dataDir, crabCache);
		const cktonTreasuryBalance = await this.fetchCktonTreasuryBalance();
		const cktonTreasuryAddonResult = this.calculateProportionalAirdrop(
			cktonGroupBalances.balances,
			cktonTreasuryBalance
		);
		const cktonTreasuryAddonBalances = this.extractAirdropAmounts(cktonTreasuryAddonResult.airdropPerAddress);

		const virtualCrab = virtualHoldings.CRAB || {};
		const virtualWcrab = virtualHoldings.WCRAB || {};
		const virtualGcrab = virtualHoldings.gCRAB || {};
		const virtualXwcrab = virtualHoldings.xWCRAB || {};
		const virtualWcring = virtualHoldings.WCRING || {};

		console.log(`  - CRAB native: ${Object.keys(crabNative).length} EOA holders`);
		console.log(`  - WCRAB: ${Object.keys(wcrabHolders).length} EOA holders`);
		console.log(`  - gCRAB: ${Object.keys(gcrabHolders).length} EOA holders`);
		console.log(`  - WCRING: ${Object.keys(wcringHolders).length} EOA holders`);
		console.log(`  - xWCRAB: ${Object.keys(xwcrabHolders).length} EOA holders`);
		console.log(`  - Virtual CRAB: ${Object.keys(virtualCrab).length} holders`);
		console.log(`  - Virtual WCRAB: ${Object.keys(virtualWcrab).length} holders`);
		console.log(`  - Virtual gCRAB: ${Object.keys(virtualGcrab).length} holders`);
		console.log(`  - Virtual xWCRAB: ${Object.keys(virtualXwcrab).length} holders`);
		console.log(`  - Virtual WCRING: ${Object.keys(virtualWcring).length} holders`);
		console.log(`  - CRAB staking rewards: ${Object.keys(crabStakingRewards).length} holders`);
		console.log(`  - CKTON staking rewards: ${Object.keys(cktonStakingRewards).length} holders`);
		console.log(`  - CRAB deposit balances: ${Object.keys(crabDepositBalances).length} holders`);
		console.log(`  - CKTON treasury CRAB add-on: ${Object.keys(cktonTreasuryAddonBalances).length} holders`);
		console.log(`  - CKTON treasury CRAB balance: ${cktonTreasuryBalance}`);

		const aggregated = this.aggregateBalances({
			crab: crabNative,
			wcrab: wcrabHolders,
			gcrab: gcrabHolders,
			wcring: wcringHolders,
			xwcrab: xwcrabHolders,
			virtual_crab: virtualCrab,
			virtual_wcrab: virtualWcrab,
			virtual_gcrab: virtualGcrab,
			virtual_xwcrab: virtualXwcrab,
			virtual_wcring: virtualWcring,
			crab_staking_rewards: crabStakingRewards,
			ckton_staking_rewards: cktonStakingRewards,
			crab_deposit_balance: crabDepositBalances,
			ckton_treasury_crab_addon: cktonTreasuryAddonBalances
		});

		console.log(`  - Total unique addresses: ${Object.keys(aggregated).length}`);

		const allocation = this.config.allocation || "21480557978160396696626883";
		const { airdropPerAddress, totalSupply } = this.calculateProportionalAirdrop(aggregated, allocation);

		const componentSupplies = this.calculateComponentSupplies({
			crab: crabNative,
			wcrab: wcrabHolders,
			gcrab: gcrabHolders,
			wcring: wcringHolders,
			xwcrab: xwcrabHolders,
			virtual_crab: virtualCrab,
			virtual_wcrab: virtualWcrab,
			virtual_gcrab: virtualGcrab,
			virtual_xwcrab: virtualXwcrab,
			virtual_wcring: virtualWcring,
			crab_staking_rewards: crabStakingRewards,
			ckton_staking_rewards: cktonStakingRewards,
			crab_deposit_balance: crabDepositBalances,
			ckton_treasury_crab_addon: cktonTreasuryAddonBalances
		});

		return {
			ruleName: this.name,
			description: this.description,
			allocationPercentage: "0.60",
			allocation: allocation,
			totalSupply: totalSupply,
			componentSupplies: componentSupplies,
			airdropPerAddress: airdropPerAddress,
			cktonTreasuryCrabBalance: cktonTreasuryBalance,
			cktonTreasuryGroupSupply: cktonGroupBalances.totalSupply,
			rawBalances: {
				crab: crabNative,
				wcrab: wcrabHolders,
				gcrab: gcrabHolders,
				wcring: wcringHolders,
				xwcrab: xwcrabHolders,
				virtual_crab: virtualCrab,
				virtual_wcrab: virtualWcrab,
				virtual_gcrab: virtualGcrab,
				virtual_xwcrab: virtualXwcrab,
				virtual_wcring: virtualWcring,
				crab_staking_rewards: crabStakingRewards,
				ckton_staking_rewards: cktonStakingRewards,
				crab_deposit_balance: crabDepositBalances,
				ckton_treasury_crab_addon: cktonTreasuryAddonBalances
			}
		};
	}

	loadCrabCache() {
		const cachePath = path.join(__dirname, '..', '..', '..', 'data', 'crab-cache.json');
		if (fs.existsSync(cachePath)) {
			return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
		}
		return {};
	}

	loadDarwiniaCache() {
		const cachePath = path.join(__dirname, '..', '..', '..', 'data', 'darwinia-cache.json');
		if (fs.existsSync(cachePath)) {
			let cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
			
			// Clean up annotated addresses in cache (e.g., "0xaddr (Snow LP)")
			const keysToDelete = Object.keys(cache).filter(k => k.includes(' ('));
			if (keysToDelete.length > 0) {
				console.log(`  🧹 Cleaning ${keysToDelete.length} malformed cache entries...`);
				for (const key of keysToDelete) {
					delete cache[key];
				}
				fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));
				console.log(`  ✅ Cache cleaned`);
			}
			return cache;
		}
		return {};
	}

	saveDarwiniaCache(cache) {
		const cachePath = path.join(__dirname, '..', '..', '..', 'data', 'darwinia-cache.json');
		fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));
	}

	loadCrabNativeHolders() {
		const data = this.loadDataFile('CRAB_native.json');
		const eoaHolders = {};
		for (const [address, balance] of Object.entries(data.eoa_holders || {})) {
			// Normalize to lowercase
			eoaHolders[address.toLowerCase()] = balance;
		}
		return eoaHolders;
	}

	loadTokenHolders(dataDir, symbol, addressCache) {
		const files = fs.readdirSync(dataDir);
		const matchingFiles = files.filter(f => f.startsWith(`${symbol}_`) && f.endsWith('.json'));
		
		if (matchingFiles.length === 0) {
			console.warn(`  ⚠️  No ${symbol} data file found`);
			return {};
		}

		const filePath = path.join(dataDir, matchingFiles[0]);
		const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
		
		return this.filterEOAs(data.eoa_holders || {}, addressCache);
	}

	loadCrabStakingRewards(addressCache) {
		const data = this.loadDataFile('CRAB_staking_rewards.json');
		const rewards = {};

		for (const entry of data.rewards || []) {
			const account = (entry.account || '').toLowerCase();
			if (!account) {
				continue;
			}
			rewards[account] = entry.reward || '0';
		}

		return this.filterEOAs(rewards, addressCache);
	}

	loadCktonStakingRewards(addressCache) {
		const data = this.loadDataFile('CKTON_staking_rewards.json');
		const rewards = {};

		for (const entry of data.rewards || []) {
			const account = (entry.account || '').toLowerCase();
			if (!account) {
				continue;
			}
			rewards[account] = entry.reward || '0';
		}

		return this.filterEOAs(rewards, addressCache);
	}

	loadCrabDepositBalances(addressCache) {
		const data = this.loadDataFile('CRAB_deposit_balance.json');
		const balances = {};

		for (const entry of data.balances || []) {
			const account = (entry.account || '').toLowerCase();
			if (!account) {
				continue;
			}
			balances[account] = entry.total_balance || '0';
		}

		return this.filterEOAs(balances, addressCache);
	}

	loadCktonGroupBalances(dataDir, addressCache) {
		const cktonHolders = this.loadTokenHolders(dataDir, 'CKTON', addressCache);
		const wcktonHolders = this.loadTokenHolders(dataDir, 'WCKTON', addressCache);
		const gcktonHolders = this.loadTokenHolders(dataDir, 'gCKTON', addressCache);
		const virtualHoldings = buildVirtualHoldings(['CKTON', 'WCKTON', 'gCKTON']);

		const aggregated = this.aggregateBalances({
			ckton: cktonHolders,
			wckton: wcktonHolders,
			gckton: gcktonHolders,
			virtual_ckton: virtualHoldings.CKTON || {},
			virtual_wckton: virtualHoldings.WCKTON || {},
			virtual_gckton: virtualHoldings.gCKTON || {}
		});

		const totalSupply = Object.values(aggregated).reduce((sum, balance) => {
			return sum + BigInt(balance);
		}, 0n).toString();

		return {
			balances: aggregated,
			totalSupply
		};
	}

	async fetchCktonTreasuryBalance() {
		const client = createPublicClient({
			transport: http(CRAB_RPC_URL)
		});

		const balance = await client.getBalance({
			address: CKTON_TREASURY_ADDRESS
		});

		return balance.toString();
	}

	extractAirdropAmounts(airdropPerAddress) {
		const balances = {};
		for (const [address, data] of Object.entries(airdropPerAddress || {})) {
			balances[address] = data.amount || '0';
		}
		return balances;
	}

	async loadXwcrabHolders(dataDir, darwiniaCache) {
		const files = fs.readdirSync(dataDir);
		const matchingFiles = files.filter(f => f.startsWith('xWCRAB_') && f.endsWith('.json'));
		
		if (matchingFiles.length === 0) {
			console.warn(`  ⚠️  No xWCRAB data file found`);
			return {};
		}

		const filePath = path.join(dataDir, matchingFiles[0]);
		const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

		const holders = data.eoa_holders || {};
		const contractHolders = data.contract_holders || {};
		const allHolders = { ...holders, ...contractHolders };

		const eoaHolders = {};
		const missingAddresses = [];

		for (const [address, balance] of Object.entries(allHolders)) {
			// Strip annotation and normalize to lowercase
			const normalizedAddress = address.split(' (')[0].toLowerCase();
			const isCached = darwiniaCache[normalizedAddress] !== undefined;
			
			if (isCached) {
				if (darwiniaCache[normalizedAddress] === false) {
					eoaHolders[normalizedAddress] = balance;
				}
			} else {
				missingAddresses.push({ normalizedAddress, balance });
			}
		}

		if (missingAddresses.length > 0) {
			console.log(`  ℹ️  Fetching ${missingAddresses.length} missing addresses from Darwinia API...`);
			const api = new DarwiniaAPI();
			
			for (const item of missingAddresses) {
				const isContract = await api.isSmartContract(item.normalizedAddress, darwiniaCache);
				darwiniaCache[item.normalizedAddress] = isContract;
				
				if (!isContract) {
					eoaHolders[item.normalizedAddress] = item.balance;
				}
				
				await new Promise(r => setTimeout(r, 100));
			}

			this.saveDarwiniaCache(darwiniaCache);
			console.log(`  ✅ Updated Darwinia cache`);
		}

		return eoaHolders;
	}

	calculateComponentSupplies(sources) {
		const supplies = {};
		for (const [name, holders] of Object.entries(sources)) {
			const total = Object.values(holders).reduce((sum, b) => sum + BigInt(b), 0n);
			supplies[name] = total.toString();
		}
		return supplies;
	}

	getMetadata() {
		return {
			name: this.name,
			description: this.description,
			allocationPercentage: "0.60",
			components: [
				"CRAB",
				"WCRAB",
				"gCRAB",
				"xWCRAB",
				"WCRING",
				"Virtual CRAB",
				"Virtual WCRAB",
				"Virtual gCRAB",
				"Virtual xWCRAB",
				"Virtual WCRING",
				"CRAB staking rewards",
				"CKTON staking rewards",
				"CRAB deposit balance",
				"CKTON treasury CRAB add-on"
			]
		};
	}
}

module.exports = CrabGroupRule;
