const BaseAirdropRule = require('./base-rule');

const LAND_SYMBOLS = ['FIRE', 'GOLD', 'WOOD', 'SIOO', 'WATER'];

class EvolutionLandRule extends BaseAirdropRule {
	constructor(config = {}) {
		super(
			'evolution_land',
			'Evolution Land (FIRE + GOLD + WOOD + SIOO + WATER)',
			config
		);
	}

	async calculate(existingRecipients, options = {}) {
		console.log('📊 Processing Evolution Land rule...');
		const data = this.loadDataFile('evolution_land_snapshot.json');
		const landTokens = (data.evolution_tokens || []).filter((token) => LAND_SYMBOLS.includes(token.symbol));

		// Split the 15% allocation evenly across the five lands.
		const allocationBigInt = BigInt(this.config.allocation || '0');
		const baseAllocation = allocationBigInt / BigInt(LAND_SYMBOLS.length);
		const remainder = allocationBigInt % BigInt(LAND_SYMBOLS.length);

		const perLandAllocations = {};
		LAND_SYMBOLS.forEach((symbol, index) => {
			perLandAllocations[symbol] = (baseAllocation + (index === 0 ? remainder : 0n)).toString();
		});

		const airdropPerAddress = {};
		const landBalances = {};
		const landSupplies = {};

		for (const land of landTokens) {
			const symbol = land.symbol;
			const holders = this.normalizeHolders(land.eoa_holders || {});
			landBalances[symbol] = holders;

			const { airdropPerAddress: landAirdrop, totalSupply } = this.calculateProportionalAirdrop(
				holders,
				perLandAllocations[symbol]
			);

			landSupplies[symbol] = totalSupply;

			for (const [address, data] of Object.entries(landAirdrop)) {
				if (!airdropPerAddress[address]) {
					airdropPerAddress[address] = {
						amount: '0',
						proportion: '0',
						lands: {}
					};
				}

				airdropPerAddress[address].amount = (
					BigInt(airdropPerAddress[address].amount) + BigInt(data.amount)
				).toString();

				airdropPerAddress[address].lands[symbol] = {
					proportion: data.proportion,
					amount: data.amount,
					balance: holders[address] || '0'
				};
			}
		}

		return {
			ruleName: this.name,
			description: this.description,
			allocationPercentage: '0.15',
			allocation: allocationBigInt.toString(),
			totalSupply: Object.values(landSupplies).reduce((sum, value) => sum + BigInt(value), 0n).toString(),
			componentSupplies: landSupplies,
			airdropPerAddress: airdropPerAddress,
			rawBalances: landBalances,
			landAllocations: perLandAllocations
		};
	}

	normalizeHolders(holders) {
		const normalized = {};
		for (const [address, balance] of Object.entries(holders)) {
			normalized[address.toLowerCase()] = balance;
		}
		return normalized;
	}

	getMetadata() {
		return {
			name: this.name,
			description: this.description,
			allocationPercentage: '0.15',
			components: LAND_SYMBOLS
		};
	}
}

module.exports = EvolutionLandRule;
