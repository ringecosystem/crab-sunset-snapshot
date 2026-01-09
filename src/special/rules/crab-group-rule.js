const path = require("path");
const fs = require("fs");
const BaseAirdropRule = require('./base-rule');
const CrabAPI = require('../../crab/api');
const DarwiniaAPI = require('../../darwinia/api');

class CrabGroupRule extends BaseAirdropRule {
	constructor(config = {}) {
		super(
			'crab_group',
			'CRAB Group (CRAB + WCRAB + gCRAB + xWCRAB)',
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
		const xwcrabHolders = await this.loadXwcrabHolders(dataDir, darwiniaCache);

		console.log(`  - CRAB native: ${Object.keys(crabNative).length} EOA holders`);
		console.log(`  - WCRAB: ${Object.keys(wcrabHolders).length} EOA holders`);
		console.log(`  - gCRAB: ${Object.keys(gcrabHolders).length} EOA holders`);
		console.log(`  - xWCRAB: ${Object.keys(xwcrabHolders).length} EOA holders`);

		const aggregated = this.aggregateBalances({
			crab: crabNative,
			wcrab: wcrabHolders,
			gcrab: gcrabHolders,
			xwcrab: xwcrabHolders
		});

		console.log(`  - Total unique addresses: ${Object.keys(aggregated).length}`);

		const allocation = this.config.allocation || "21480557978160396696626883";
		const { airdropPerAddress, totalSupply } = this.calculateProportionalAirdrop(aggregated, allocation);

		const componentSupplies = this.calculateComponentSupplies({
			crab: crabNative,
			wcrab: wcrabHolders,
			gcrab: gcrabHolders,
			xwcrab: xwcrabHolders
		});

		return {
			ruleName: this.name,
			description: this.description,
			allocationPercentage: "0.60",
			allocation: allocation,
			totalSupply: totalSupply,
			componentSupplies: componentSupplies,
			airdropPerAddress: airdropPerAddress,
			rawBalances: {
				crab: crabNative,
				wcrab: wcrabHolders,
				gcrab: gcrabHolders,
				xwcrab: xwcrabHolders
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
			components: ["CRAB", "WCRAB", "gCRAB", "xWCRAB"]
		};
	}
}

module.exports = CrabGroupRule;
