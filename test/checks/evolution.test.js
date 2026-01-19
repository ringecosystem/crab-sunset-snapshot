const { loadJson } = require('../helpers/data');
const { pickSampleKeys } = require('../helpers/sample');
const { bigIntToDecimalString, sumBalances } = require('../helpers/math');

const LAND_SYMBOLS = ['FIRE', 'GOLD', 'WOOD', 'SIOO', 'HHO'];
const AIRDROP_TOLERANCE = 1000n;

function assertMatch(message, expected, actual) {
	if (expected !== actual) {
		throw new Error(`${message} expected=${expected} actual=${actual}`);
	}
}

function assertWithinTolerance(message, expected, actual) {
	const expectedValue = BigInt(expected || '0');
	const actualValue = BigInt(actual || '0');
	const delta = expectedValue >= actualValue ? expectedValue - actualValue : actualValue - expectedValue;
	if (delta > AIRDROP_TOLERANCE) {
		throw new Error(`${message} expected=${expected} actual=${actual} delta=${delta}`);
	}
}

test('Evolution Land sample checks', () => {
	const snapshot = loadJson('evolution_land_snapshot.json');
	const airdrop = loadJson('airdrop_results.json');
	const tokens = snapshot.evolution_tokens || [];

	for (const symbol of LAND_SYMBOLS) {
		const token = tokens.find((item) => item.symbol === symbol);
		if (!token) {
			throw new Error(`Missing Evolution Land token for ${symbol}`);
		}

		const holders = token.eoa_holders || {};
		const eoaCache = loadJson('eoa-verified-cache.json');
		const filteredHolders = Object.fromEntries(
			Object.entries(holders).filter(([address, balance]) => {
				const normalized = address.toLowerCase();
				if (BigInt(balance || '0') === 0n) {
					return false;
				}
				return eoaCache[normalized] === 'eoa';
			})
		);
		const totalSupply = sumBalances(filteredHolders);
		const sampleAddresses = pickSampleKeys(Object.keys(filteredHolders));
		console.log(`ℹ️  EVOL ${symbol} sample size=${sampleAddresses.length} from=${Object.keys(filteredHolders).length}`);

			sampleAddresses.forEach((address) => {
				const normalized = address.toLowerCase();
				const balance = filteredHolders[address] || filteredHolders[normalized] || '0';

			const expectedProportion = bigIntToDecimalString(balance, totalSupply, 18);
			const recipient = airdrop.recipients[normalized];
			const evolutionBreakdown = recipient?.breakdown?.evolution_land;
			const breakdown = evolutionBreakdown?.land_breakdown?.[symbol];

			if (!breakdown || !evolutionBreakdown) {
				throw new Error(`Missing evolution_land breakdown for ${symbol} ${normalized}`);
			}

			if (breakdown.balance !== balance.toString()) {
				assertMatch(`Evolution ${symbol} balance for ${normalized}`, balance, breakdown.balance);
			}

			if (breakdown.proportion !== expectedProportion) {
				assertMatch(`Evolution ${symbol} proportion for ${normalized}`, expectedProportion, breakdown.proportion);
			}

			const allocation = evolutionBreakdown.land_allocations?.[symbol] || '0';
				const expectedAmount = totalSupply === 0n ? 0n : (BigInt(balance || '0') * BigInt(allocation)) / totalSupply;

			assertWithinTolerance(
				`Evolution ${symbol} amount for ${normalized}`,
				expectedAmount.toString(),
				breakdown.amount
			);
		});
	}

	const recipients = Object.values(airdrop.recipients || {}).filter((recipient) => {
		return !!recipient.breakdown?.evolution_land;
	});
	const evolutionSamples = pickSampleKeys(recipients.map((recipient) => recipient.address));

	evolutionSamples.forEach((address) => {
		const recipient = airdrop.recipients[address];
		const evolutionBreakdown = recipient?.breakdown?.evolution_land;
		if (!evolutionBreakdown) {
			throw new Error(`Missing evolution_land breakdown for ${address}`);
		}

		const landAmounts = Object.values(evolutionBreakdown.land_breakdown || {}).reduce((sum, entry) => {
			return sum + BigInt(entry.amount || '0');
		}, 0n);

		assertWithinTolerance(
			`Evolution total amount for ${address}`,
			landAmounts.toString(),
			evolutionBreakdown.airdrop_amount
		);
	});
});
