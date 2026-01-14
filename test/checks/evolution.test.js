const test = require('node:test');
const { loadJson } = require('../helpers/data');
const { pickSampleKeys } = require('../helpers/sample');
const { bigIntToDecimalString, sumBalances } = require('../helpers/math');

const LAND_SYMBOLS = ['FIRE', 'GOLD', 'WOOD', 'SIOO', 'HHO'];

function warnMismatch(message, expected, actual) {
	console.warn(`⚠️  ${message} expected=${expected} actual=${actual}`);
}

test('Evolution Land sample checks', () => {
	const snapshot = loadJson('evolution_land_snapshot.json');
	const airdrop = loadJson('airdrop_results.json');
	const tokens = snapshot.evolution_tokens || [];

	for (const symbol of LAND_SYMBOLS) {
		const token = tokens.find((item) => item.symbol === symbol);
		if (!token) {
			console.warn(`⚠️  Missing Evolution Land token for ${symbol}`);
			continue;
		}

		const holders = token.eoa_holders || {};
		const totalSupply = sumBalances(holders);
		const sampleAddresses = pickSampleKeys(Object.keys(holders));

		sampleAddresses.forEach((address) => {
			const normalized = address.toLowerCase();
			const balance = holders[address] || holders[normalized] || '0';
			const expectedProportion = bigIntToDecimalString(balance, totalSupply, 18);
			const recipient = airdrop.recipients[normalized];
			const breakdown = recipient?.breakdown?.evolution_land?.land_breakdown?.[symbol];

			if (!breakdown) {
				console.warn(`⚠️  Missing evolution_land breakdown for ${symbol} ${normalized}`);
				return;
			}

			if (breakdown.balance !== balance.toString()) {
				warnMismatch(`Evolution ${symbol} balance for ${normalized}`, balance, breakdown.balance);
			}

			if (breakdown.proportion !== expectedProportion) {
				warnMismatch(`Evolution ${symbol} proportion for ${normalized}`, expectedProportion, breakdown.proportion);
			}
		});
	}
});
