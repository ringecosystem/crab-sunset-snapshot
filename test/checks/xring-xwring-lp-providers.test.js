const { loadJson } = require('../helpers/data');
const { buildLpProviders } = require('../../src/special/xring-xwring-lp-providers');

const XRING_SCALE = 10n ** 9n;

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
		const totalSupply = lp.total_supply || '0';

		for (const [holder, balance] of Object.entries(lp.eoa_holders || {})) {
			const normalized = normalizeAddress(holder);
			if (!normalized) {
				continue;
			}
			const holderBalance = BigInt(balance || '0');
			if (holderBalance === 0n) {
				continue;
			}
			const supply = BigInt(totalSupply || '0');
			if (supply === 0n) {
				continue;
			}
			const providerAssets = {};
			if (lpAssets.xRING) {
				providerAssets.xRING = ((BigInt(lpAssets.xRING) * holderBalance) / supply).toString();
			}
			if (lpAssets.xWRING) {
				providerAssets.xWRING = ((BigInt(lpAssets.xWRING) * holderBalance) / supply).toString();
			}
			if (!Object.keys(providerAssets).length) {
				continue;
			}
			const combinedTotal = (
				(BigInt(providerAssets.xRING || '0') * XRING_SCALE) +
				BigInt(providerAssets.xWRING || '0')
			).toString();
			addBalance(totals, normalized, combinedTotal);
			if (!providers[normalized]) {
				providers[normalized] = [];
			}
			providers[normalized].push({
				lp_address: lpAddress,
				provided_assets: providerAssets
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
	const expectedTotalAmount = Object.values(expected).reduce(
		(sum, entry) => sum + BigInt(entry.total || '0'),
		0n
	);
	const expectedTotalDecimal = `${expectedTotalAmount / 10n ** 18n}.${
		(expectedTotalAmount % 10n ** 18n).toString().padStart(18, '0')
	}`;

	expect(actualKeys).toEqual(expectedKeys);
	expect(outputKeys).toEqual(expectedKeys);
	expect(actual.metadata.holders_count).toBe(expectedKeys.length);
	expect(output.metadata.holders_count).toBe(expectedKeys.length);
	expect(actual.metadata.total_amount).toBe(expectedTotalAmount.toString());
	expect(output.metadata.total_amount).toBe(expectedTotalAmount.toString());
	expect(actual.metadata.total_amount_with_decimal).toBe(expectedTotalDecimal);
	expect(output.metadata.total_amount_with_decimal).toBe(expectedTotalDecimal);

	expectedKeys.forEach((address) => {
		expect(actual.providers[address].total).toBe(expected[address].total);
		expect(output.providers[address].total).toBe(expected[address].total);
		const expectedBreakdown = expected[address].breakdown || [];
			const actualBreakdown = actual.providers[address].breakdown || [];
			const outputBreakdown = output.providers[address].breakdown || [];
			expect(actualBreakdown.length).toBe(expectedBreakdown.length);
			expect(outputBreakdown.length).toBe(expectedBreakdown.length);
		actualBreakdown.forEach((entry) => {
			Object.keys(entry.provided_assets || {}).forEach((symbol) => {
				expect(['xRING', 'xWRING']).toContain(symbol);
			});
			expect(entry.lp_assets).toBeUndefined();
		});
		outputBreakdown.forEach((entry) => {
			Object.keys(entry.provided_assets || {}).forEach((symbol) => {
				expect(['xRING', 'xWRING']).toContain(symbol);
			});
			expect(entry.lp_assets).toBeUndefined();
		});
		const actualTotal = actualBreakdown.reduce((sum, entry) => {
			const providerAssets = entry.provided_assets || {};
			const xringTotal = BigInt(providerAssets.xRING || '0') * XRING_SCALE;
			const xwringTotal = BigInt(providerAssets.xWRING || '0');
			return sum + xringTotal + xwringTotal;
		}, 0n);
			expect(actualTotal.toString()).toBe(expected[address].total);
		});
});
