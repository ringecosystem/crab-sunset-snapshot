const { loadJson } = require('../helpers/data');
const { pickSampleKeys } = require('../helpers/sample');
const { bigIntToDecimalString, sumBalances } = require('../helpers/math');

const LAND_SYMBOLS = ['FIRE', 'GOLD', 'WOOD', 'SIOO', 'HHO'];

function assertMatch(message, expected, actual) {
	if (expected !== actual) {
		throw new Error(`${message} expected=${expected} actual=${actual}`);
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
		const totalSupply = sumBalances(holders);
		const sampleAddresses = pickSampleKeys(Object.keys(holders));
		console.log(`ℹ️  EVOL ${symbol} sample size=${sampleAddresses.length} from=${Object.keys(holders).length}`);

		sampleAddresses.forEach((address) => {
			const normalized = address.toLowerCase();
			const balance = holders[address] || holders[normalized] || '0';
			const expectedProportion = bigIntToDecimalString(balance, totalSupply, 18);
			const recipient = airdrop.recipients[normalized];
			const breakdown = recipient?.breakdown?.evolution_land?.land_breakdown?.[symbol];

			if (!breakdown) {
				throw new Error(`Missing evolution_land breakdown for ${symbol} ${normalized}`);
			}

			if (breakdown.balance !== balance.toString()) {
				assertMatch(`Evolution ${symbol} balance for ${normalized}`, balance, breakdown.balance);
			}

			if (breakdown.proportion !== expectedProportion) {
				assertMatch(`Evolution ${symbol} proportion for ${normalized}`, expectedProportion, breakdown.proportion);
			}
		});
	}
});
