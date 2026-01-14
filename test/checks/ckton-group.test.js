const test = require('node:test');
const { loadJson, loadTokenSnapshot } = require('../helpers/data');
const { pickSampleKeys } = require('../helpers/sample');
const { sumBalances } = require('../helpers/math');

const EXCLUDED = new Set(['0xb633ad1142941ca2eb9c350579cf88bbe266660d']);

function filterExcluded(holders) {
	const filtered = {};
	for (const [address, balance] of Object.entries(holders || {})) {
		if (EXCLUDED.has(address.toLowerCase())) {
			continue;
		}
		filtered[address.toLowerCase()] = balance;
	}
	return filtered;
}

function filterEOAs(holders, cache, lpTokens = new Set()) {
	const filtered = {};
	for (const [address, balance] of Object.entries(holders || {})) {
		const normalized = address.split(' (')[0].toLowerCase();
		if (lpTokens.has(normalized)) {
			continue;
		}
		if (cache[normalized] === true) {
			continue;
		}
		filtered[normalized] = balance;
	}
	return filtered;
}

function buildVirtualHoldings(snowLps, allowedSymbols) {
	const virtualHoldings = {};

	for (const lp of snowLps || []) {
		const totalSupply = BigInt(lp.total_supply || '0');
		if (totalSupply === 0n) {
			continue;
		}

		const assets = (lp.assets || []).filter((asset) => allowedSymbols.includes(asset.symbol));
		if (assets.length === 0) {
			continue;
		}

		for (const [holder, balance] of Object.entries(lp.eoa_holders || {})) {
			const holderBalance = BigInt(balance || '0');
			if (holderBalance === 0n) {
				continue;
			}

			const address = holder.toLowerCase();
			for (const asset of assets) {
				const assetBalance = BigInt(asset.balance || '0');
				if (assetBalance === 0n) {
					continue;
				}

				const virtualBalance = (holderBalance * assetBalance) / totalSupply;
				if (virtualBalance === 0n) {
					continue;
				}

				if (!virtualHoldings[asset.symbol]) {
					virtualHoldings[asset.symbol] = {};
				}

				if (!virtualHoldings[asset.symbol][address]) {
					virtualHoldings[asset.symbol][address] = '0';
				}

				virtualHoldings[asset.symbol][address] = (
					BigInt(virtualHoldings[asset.symbol][address]) + virtualBalance
				).toString();
			}
		}
	}

	return virtualHoldings;
}

function aggregateBalances(sources) {
	const aggregated = {};
	for (const holders of Object.values(sources)) {
		for (const [address, balance] of Object.entries(holders || {})) {
			if (!aggregated[address]) {
				aggregated[address] = '0';
			}
			aggregated[address] = (BigInt(aggregated[address]) + BigInt(balance || '0')).toString();
		}
	}
	return aggregated;
}

function warnMismatch(message, expected, actual) {
	console.warn(`⚠️  ${message} expected=${expected} actual=${actual}`);
}

test('CKTON group sample checks', () => {
	const crabCache = loadJson('crab-cache.json');
	const snowLps = loadJson('snow_lps_crab.json').snow_lps || [];
	const airdrop = loadJson('airdrop_results.json');

	const cktonData = loadTokenSnapshot('CKTON');
	const wcktonData = loadTokenSnapshot('WCKTON');
	const gcktonData = loadTokenSnapshot('gCKTON');

	if (!cktonData || !wcktonData || !gcktonData) {
		console.warn('⚠️  Missing CKTON token snapshots for test');
		return;
	}

	const lpTokens = new Set((snowLps || []).map((lp) => (lp.address || '').toLowerCase()).filter(Boolean));

	const cktonHolders = filterExcluded(filterEOAs({ ...cktonData.eoa_holders, ...cktonData.contract_holders }, crabCache, lpTokens));
	const wcktonHolders = filterExcluded(filterEOAs({ ...wcktonData.eoa_holders, ...wcktonData.contract_holders }, crabCache, lpTokens));
	const gcktonHolders = filterExcluded(filterEOAs({ ...gcktonData.eoa_holders, ...gcktonData.contract_holders }, crabCache, lpTokens));

	const virtualHoldings = buildVirtualHoldings(snowLps, ['CKTON', 'WCKTON', 'gCKTON']);
	const virtualCkton = filterExcluded(virtualHoldings.CKTON || {});
	const virtualWckton = filterExcluded(virtualHoldings.WCKTON || {});
	const virtualGckton = filterExcluded(virtualHoldings.gCKTON || {});

	const aggregated = aggregateBalances({
		ckton: cktonHolders,
		wckton: wcktonHolders,
		gckton: gcktonHolders,
		virtual_ckton: virtualCkton,
		virtual_wckton: virtualWckton,
		virtual_gckton: virtualGckton
	});

	const cktonRecipients = Object.keys(airdrop.recipients || {}).filter((address) => {
		return !!airdrop.recipients[address]?.breakdown?.ckton_group;
	});
	const sampleAddresses = pickSampleKeys(cktonRecipients);
	console.log(`ℹ️  CKTON sample size=${sampleAddresses.length} from=${cktonRecipients.length}`);
	console.log(`ℹ️  CKTON samples: ${sampleAddresses.join(', ')}`);

	sampleAddresses.forEach((address) => {
		const recipient = airdrop.recipients[address];
		const breakdown = recipient?.breakdown?.ckton_group;
		if (!breakdown) {
			return;
		}

		const expectedTotal = BigInt(aggregated[address] || '0').toString();
		const actualTotal = breakdown.total_group_balance || '0';
		if (expectedTotal !== actualTotal) {
			warnMismatch(`CKTON group balance for ${address}`, expectedTotal, actualTotal);
		}
	});
});
