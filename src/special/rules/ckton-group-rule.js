const path = require("path");
const fs = require("fs");
const BaseAirdropRule = require('./base-rule');
const { buildVirtualHoldings, loadLpTokenAddresses } = require('./lp-virtual-holdings');
const { filterManyBalanceMapsByVerifiedEoa } = require('../../base/eoa-verified-cache');

const EXCLUDED_CKTON_ADDRESSES = new Set([
	'0xb633ad1142941ca2eb9c350579cf88bbe266660d',

	// Special system contracts without code (treat as contracts)
	'0x000000000f681d85374225edeeadc25560c1fb3f',
	'0x0000000000000000000000000000000000000000',
	'0x000000000419683a1a03abc21fc9da25fd2b4dd7',
	'0x7369626cd0070000000000000000000000000000',
	'0x0000000000000000000000000000000000000201',
	'0x0000000000000000000000000000000000000101',
	'0x0000000000000000000000000000000000000019',
	'0x0000000000000000000000000000000000000100',
	'0x0000000000000000000000000000000000000200',
	'0x00000005a796df0489b6f16120e9a72bbc954c96'
]);


class CktonGroupRule extends BaseAirdropRule {
	constructor(config = {}) {
		super(
			'ckton_group',
			'CKTON Group (CKTON + WCKTON + gCKTON)',
			config
		);
	}

	async calculate(existingRecipients, options = {}) {
		const dataDir = path.join(__dirname, '..', '..', '..', 'data');
		const crabCache = this.loadCrabCache();
		const lpTokens = loadLpTokenAddresses();

		console.log(`📊 Processing CKTON Group rule...`);

		const cktonHolders = this.excludeAddresses(this.loadTokenHolders(dataDir, 'CKTON', crabCache, lpTokens));
		const wcktonHolders = this.excludeAddresses(this.loadTokenHolders(dataDir, 'WCKTON', crabCache, lpTokens));
		const gcktonHolders = this.excludeAddresses(this.loadTokenHolders(dataDir, 'gCKTON', crabCache, lpTokens));
		const virtualHoldings = buildVirtualHoldings(['CKTON', 'WCKTON', 'gCKTON']);


		const virtualCkton = this.excludeAddresses(virtualHoldings.CKTON || {});
		const virtualWckton = this.excludeAddresses(virtualHoldings.WCKTON || {});
		const virtualGckton = this.excludeAddresses(virtualHoldings.gCKTON || {});

		console.log(`  - CKTON: ${Object.keys(cktonHolders).length} holders`);
		console.log(`  - WCKTON: ${Object.keys(wcktonHolders).length} holders`);
		console.log(`  - gCKTON: ${Object.keys(gcktonHolders).length} holders`);
		console.log(`  - Virtual CKTON: ${Object.keys(virtualCkton).length} holders`);
		console.log(`  - Virtual WCKTON: ${Object.keys(virtualWckton).length} holders`);
		console.log(`  - Virtual gCKTON: ${Object.keys(virtualGckton).length} holders`);

		const rawBalances = {
			ckton: cktonHolders,
			wckton: wcktonHolders,
			gckton: gcktonHolders,
			virtual_ckton: virtualCkton,
			virtual_wckton: virtualWckton,
			virtual_gckton: virtualGckton
		};

		const { filteredMaps: filteredBalances } = await filterManyBalanceMapsByVerifiedEoa(rawBalances);
		const aggregated = this.aggregateBalances(filteredBalances);

		console.log(`  - Total unique addresses: ${Object.keys(aggregated).length}`);

		const allocation = this.config.allocation || "7160185992720132232208961";
		const { airdropPerAddress, totalSupply } = this.calculateProportionalAirdrop(aggregated, allocation);

		const componentSupplies = this.calculateComponentSupplies(filteredBalances);

		return {
			ruleName: this.name,
			description: this.description,
			allocationPercentage: "0.20",
			allocation: allocation,
			totalSupply: totalSupply,
			componentSupplies: componentSupplies,
			airdropPerAddress: airdropPerAddress,
			rawBalances: filteredBalances
		};
	}

	loadCrabCache() {
		const cachePath = path.join(__dirname, '..', '..', '..', 'data', 'crab-cache.json');
		if (fs.existsSync(cachePath)) {
			return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
		}
		return {};
	}

	loadTokenHolders(dataDir, symbol, addressCache, lpTokens = new Set()) {
		const files = fs.readdirSync(dataDir);
		const matchingFiles = files.filter(f => f.startsWith(`${symbol}_`) && f.endsWith('.json'));
		
		if (matchingFiles.length === 0) {
			console.warn(`  ⚠️  No ${symbol} data file found`);
			return {};
		}

		const filePath = path.join(dataDir, matchingFiles[0]);
		const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

		const allHolders = {
			...(data.eoa_holders || {}),
			...(data.contract_holders || {})
		};

		return this.filterEOAs(allHolders, addressCache, lpTokens);
	}

	excludeAddresses(holders) {
		const filtered = {};
		for (const [address, balance] of Object.entries(holders)) {
			if (EXCLUDED_CKTON_ADDRESSES.has(address.toLowerCase())) {
				continue;
			}
			filtered[address] = balance;
		}
		return filtered;
	}

	filterEOAs(holders, cache, lpTokens = new Set()) {
		const filtered = {};
		for (const [address, balance] of Object.entries(holders || {})) {
			const normalized = address.split(' (')[0].toLowerCase();
			if (lpTokens.has(normalized)) {
				continue;
			}
			const isContract = cache[normalized];
			if (isContract === true) {
				continue;
			}
			filtered[normalized] = balance;
		}
		return filtered;
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
			allocationPercentage: "0.20",
			components: ["CKTON", "WCKTON", "gCKTON", "Virtual CKTON", "Virtual WCKTON", "Virtual gCKTON"]
		};
	}
}

module.exports = CktonGroupRule;
