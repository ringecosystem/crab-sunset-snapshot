const { loadJson, loadTokenSnapshot } = require('../helpers/data');
const { pickSampleKeys } = require('../helpers/sample');

const EXCLUDED_NATIVE = new Set([
	'0xb633ad1142941ca2eb9c350579cf88bbe266660d',
	'0x6d6f646c64612f74727372790000000000000000'
]);

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

function filterExcludedNative(holders, lpTokens = new Set()) {
	const filtered = {};
	for (const [address, balance] of Object.entries(holders || {})) {
		const normalized = address.toLowerCase();
		if (EXCLUDED_NATIVE.has(normalized)) {
			continue;
		}
		if (lpTokens.has(normalized)) {
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

function assertMatch(message, expected, actual) {
	if (expected !== actual) {
		throw new Error(`${message} expected=${expected} actual=${actual}`);
	}
}

function loadRewardsBalances(filename, field) {
	const data = loadJson(filename);
	const balances = {};
	for (const entry of data[field] || []) {
		const account = (entry.account || '').toLowerCase();
		if (!account) {
			continue;
		}
		balances[account] = entry.reward || entry.total_balance || '0';
	}
	return balances;
}

test('CRAB group sample checks', () => {
	const crabCache = loadJson('crab-cache.json');
	const darwiniaCache = loadJson('darwinia-cache.json');
	const snowLps = loadJson('snow_lps_crab.json').snow_lps || [];
	const airdrop = loadJson('airdrop_results.json');

	const crabNativeData = loadJson('CRAB_native.json');
	const lpTokens = new Set((snowLps || []).map((lp) => (lp.address || '').toLowerCase()).filter(Boolean));
	const crabNative = filterExcludedNative(crabNativeData.eoa_holders || {}, lpTokens);
	const wcrabData = loadTokenSnapshot('WCRAB');
	const gcrabData = loadTokenSnapshot('gCRAB');
	const wcringData = loadTokenSnapshot('WCRING');
	const xwcrabData = loadTokenSnapshot('xWCRAB');

	if (!wcrabData || !gcrabData || !wcringData || !xwcrabData) {
		throw new Error('Missing CRAB token snapshots for test');
	}

	const wcrabHolders = filterEOAs(wcrabData.eoa_holders || {}, crabCache, lpTokens);
	const gcrabHolders = filterEOAs(gcrabData.eoa_holders || {}, crabCache, lpTokens);
	const wcringHolders = filterEOAs(wcringData.eoa_holders || {}, crabCache, lpTokens);

	const xwcrabHolders = filterEOAs({
		...(xwcrabData.eoa_holders || {}),
		...(xwcrabData.contract_holders || {})
	}, darwiniaCache, lpTokens);

	const virtualHoldings = buildVirtualHoldings(snowLps, ['CRAB', 'WCRAB', 'gCRAB', 'xWCRAB', 'WCRING']);
	const crabStakingRewards = loadRewardsBalances('CRAB_staking_rewards.json', 'rewards');
	const cktonStakingRewards = loadRewardsBalances('CKTON_staking_rewards.json', 'rewards');
	const crabDepositBalances = loadRewardsBalances('CRAB_deposit_balance.json', 'balances');

	const firstRecipient = Object.values(airdrop.recipients || {}).find((recipient) => recipient?.breakdown?.crab_group);
	const treasuryBalance = firstRecipient?.breakdown?.crab_group?.virtual_from_ckton_treasury?.ckton_treasury_crab_balance || '0';
	const groupSupply = firstRecipient?.breakdown?.crab_group?.virtual_from_ckton_treasury?.ckton_group_total_supply || '0';
	const cktonAddon = {};

	if (BigInt(groupSupply || '0') > 0n) {
		Object.keys(airdrop.recipients).forEach((address) => {
			const breakdown = airdrop.recipients[address]?.breakdown?.ckton_group;
			const groupBalance = BigInt(breakdown?.group_balance || '0');
			const addon = (groupBalance * BigInt(treasuryBalance)) / BigInt(groupSupply || '1');
			cktonAddon[address] = addon.toString();
		});
	}

	const aggregated = aggregateBalances({
		crab: crabNative,
		wcrab: wcrabHolders,
		gcrab: gcrabHolders,
		wcring: wcringHolders,
		xwcrab: xwcrabHolders,
		virtual_crab: virtualHoldings.CRAB || {},
		virtual_wcrab: virtualHoldings.WCRAB || {},
		virtual_gcrab: virtualHoldings.gCRAB || {},
		virtual_xwcrab: virtualHoldings.xWCRAB || {},
		virtual_wcring: virtualHoldings.WCRING || {},
		crab_staking_rewards: crabStakingRewards,
		ckton_staking_rewards: cktonStakingRewards,
		crab_deposit_balance: crabDepositBalances,
		ckton_treasury_crab_addon: cktonAddon
	});

	const crabRecipients = Object.keys(airdrop.recipients || {}).filter((address) => {
		return !!airdrop.recipients[address]?.breakdown?.crab_group;
	});
	const sampleAddresses = pickSampleKeys(crabRecipients);
	console.log(`ℹ️  CRAB sample size=${sampleAddresses.length} from=${crabRecipients.length}`);
	console.log(`ℹ️  CRAB samples: ${sampleAddresses.join(', ')}`);

	sampleAddresses.forEach((address) => {
		const recipient = airdrop.recipients[address];
		const breakdown = recipient?.breakdown?.crab_group;
		if (!breakdown) {
			throw new Error(`Missing CRAB breakdown for ${address}`);
		}

		const expectedTotal = BigInt(aggregated[address] || '0').toString();
		const actualTotal = breakdown.group_balance || '0';
		if (expectedTotal !== actualTotal) {
			assertMatch(`CRAB group balance for ${address}`, expectedTotal, actualTotal);
		}
	});
});
