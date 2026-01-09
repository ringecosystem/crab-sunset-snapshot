const path = require("path");
const fs = require("fs");
const BaseAirdropRule = require('./base-rule');

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

		console.log(`📊 Processing CKTON Group rule...`);

		const cktonHolders = this.loadTokenHolders(dataDir, 'CKTON', crabCache);
		const wcktonHolders = this.loadTokenHolders(dataDir, 'WCKTON', crabCache);
		const gcktonHolders = this.loadTokenHolders(dataDir, 'gCKTON', crabCache);

		console.log(`  - CKTON: ${Object.keys(cktonHolders).length} holders`);
		console.log(`  - WCKTON: ${Object.keys(wcktonHolders).length} holders`);
		console.log(`  - gCKTON: ${Object.keys(gcktonHolders).length} holders`);

		const aggregated = this.aggregateBalances({
			ckton: cktonHolders,
			wckton: wcktonHolders,
			gckton: gcktonHolders
		});

		console.log(`  - Total unique addresses: ${Object.keys(aggregated).length}`);

		const allocation = this.config.allocation || "7160185992720132232208961";
		const { airdropPerAddress, totalSupply } = this.calculateProportionalAirdrop(aggregated, allocation);

		const componentSupplies = this.calculateComponentSupplies({
			ckton: cktonHolders,
			wckton: wcktonHolders,
			gckton: gcktonHolders
		});

		return {
			ruleName: this.name,
			description: this.description,
			allocationPercentage: "0.20",
			allocation: allocation,
			totalSupply: totalSupply,
			componentSupplies: componentSupplies,
			airdropPerAddress: airdropPerAddress,
			rawBalances: {
				ckton: cktonHolders,
				wckton: wcktonHolders,
				gckton: gcktonHolders
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

	loadTokenHolders(dataDir, symbol, addressCache) {
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

		return this.filterEOAs(allHolders, addressCache);
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
			components: ["CKTON", "WCKTON", "gCKTON"]
		};
	}
}

module.exports = CktonGroupRule;
