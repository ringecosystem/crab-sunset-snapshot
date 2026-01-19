const BaseAirdropRule = require('./base-rule');
const { filterBalancesByVerifiedEoa } = require('../../base/eoa-verified-cache');

const LAND_SYMBOLS = ['FIRE', 'GOLD', 'WOOD', 'SIOO', 'HHO'];

const EXCLUDED_ADDRESSES = new Set([
	'0xb633ad1142941ca2eb9c350579cf88bbe266660d',
	'0x6d6f646c64612f74727372790000000000000000',
	
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

class EvolutionLandRule extends BaseAirdropRule {
	constructor(config = {}) {
		super(
			'evolution_land',
			'Evolution Land (FIRE + GOLD + WOOD + SIOO + HHO)',

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
			const holders = await filterBalancesByVerifiedEoa(this.normalizeHolders(land.eoa_holders || {}));
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
				proportion_fraction: `(${holders[address] || '0'}/${totalSupply})`,
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
			const normalizedAddress = (address || '').toLowerCase();
			if (!normalizedAddress) {
				continue;
			}
			if (EXCLUDED_ADDRESSES.has(normalizedAddress)) {
				continue;
			}
			normalized[normalizedAddress] = balance;
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
