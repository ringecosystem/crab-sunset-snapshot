const { loadJson } = require('../helpers/data');
const { buildLpProviders } = require('../../src/special/xring-xwring-lp-providers');

function normalizeAddress(address) {
	return (address || '').split(' (')[0].toLowerCase();
}

function addBalance(target, address, amount) {
	if (!target[address]) {
		target[address] = '0';
	}
	target[address] = (BigInt(target[address]) + BigInt(amount || '0')).toString();
}

function buildExpectedProviders(snowLps) {
	const providers = {};

	for (const lp of snowLps || []) {
		const assets = lp.assets || [];
		const includesTarget = assets.some((asset) => ['xRING', 'xWRING'].includes(asset.symbol));
		if (!includesTarget) {
			continue;
		}

		for (const [holder, balance] of Object.entries(lp.eoa_holders || {})) {
			const normalized = normalizeAddress(holder);
			if (!normalized) {
				continue;
			}
			const holderBalance = BigInt(balance || '0');
			if (holderBalance === 0n) {
				continue;
			}
			addBalance(providers, normalized, holderBalance.toString());
		}
	}

	return providers;
}

test('xRING/xWRING LP provider merge matches snapshot', () => {
	const snowLps = loadJson('snow_lps_crab.json').snow_lps || [];
	const expected = buildExpectedProviders(snowLps);
	const actual = buildLpProviders(snowLps);
	const output = loadJson('xRING_xWRING_lp_providers.json');

	const expectedKeys = Object.keys(expected).sort();
	const actualKeys = Object.keys(actual).sort();
	const outputKeys = Object.keys(output).sort();

	expect(actualKeys).toEqual(expectedKeys);
	expect(outputKeys).toEqual(expectedKeys);

	expectedKeys.forEach((address) => {
		expect(actual[address]).toBe(expected[address]);
		expect(output[address]).toBe(expected[address]);
	});
});
