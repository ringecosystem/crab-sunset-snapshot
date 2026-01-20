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
	const totals = {};
	const providers = {};

	for (const lp of snowLps || []) {
		const assets = lp.assets || [];
		const includesTarget = assets.some((asset) => ['xRING', 'xWRING'].includes(asset.symbol));
		if (!includesTarget) {
			continue;
		}
		const lpAssets = assets
			.filter((asset) => ['xRING', 'xWRING'].includes(asset.symbol))
			.reduce((accumulator, asset) => {
				accumulator[asset.symbol] = asset.balance || '0';
				return accumulator;
			}, {});
		const lpAddress = normalizeAddress(lp.address);

		for (const [holder, balance] of Object.entries(lp.eoa_holders || {})) {
			const normalized = normalizeAddress(holder);
			if (!normalized) {
				continue;
			}
			const holderBalance = BigInt(balance || '0');
			if (holderBalance === 0n) {
				continue;
			}
			addBalance(totals, normalized, holderBalance.toString());
			if (!providers[normalized]) {
				providers[normalized] = [];
			}
			providers[normalized].push({
				lp_address: lpAddress,
				provider_balance: holderBalance.toString(),
				lp_assets: lpAssets
			});
		}
	}
	const expected = {};
	Object.keys(totals).forEach((address) => {
		expected[address] = {
			total: totals[address],
			breakdown: providers[address] || []
		};
	});
	return expected;
}

test('xRING/xWRING LP provider merge matches snapshot', () => {
	const snowLps = loadJson('snow_lps_crab.json').snow_lps || [];
	const expected = buildExpectedProviders(snowLps);
	const actual = buildLpProviders(snowLps);
	const output = loadJson('xRING_xWRING_lp_providers.json');

	const expectedKeys = Object.keys(expected).sort();
	const actualKeys = Object.keys(actual.providers).sort();
	const outputKeys = Object.keys(output.providers).sort();

	expect(actualKeys).toEqual(expectedKeys);
	expect(outputKeys).toEqual(expectedKeys);

	expectedKeys.forEach((address) => {
		expect(actual.providers[address].total).toBe(expected[address].total);
		expect(output.providers[address].total).toBe(expected[address].total);
		const expectedBreakdown = expected[address].breakdown || [];
		const actualBreakdown = actual.providers[address].breakdown || [];
		const outputBreakdown = output.providers[address].breakdown || [];
		expect(actualBreakdown.length).toBe(expectedBreakdown.length);
		expect(outputBreakdown.length).toBe(expectedBreakdown.length);
		actualBreakdown.forEach((entry) => {
			Object.keys(entry.lp_assets || {}).forEach((symbol) => {
				expect(['xRING', 'xWRING']).toContain(symbol);
			});
		});
		outputBreakdown.forEach((entry) => {
			Object.keys(entry.lp_assets || {}).forEach((symbol) => {
				expect(['xRING', 'xWRING']).toContain(symbol);
			});
		});
		const actualTotal = actualBreakdown.reduce((sum, entry) => sum + BigInt(entry.provider_balance || '0'), 0n);
		expect(actualTotal.toString()).toBe(expected[address].total);
	});
});
