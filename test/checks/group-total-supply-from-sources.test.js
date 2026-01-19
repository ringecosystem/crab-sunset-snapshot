const { loadJson, loadTokenSnapshot } = require('../helpers/data');
const { info, formatDelta } = require('../helpers/log');

const EXCLUDED_SPECIALS = new Set([
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

function normalizeAddress(address) {
	return (address || '').split(' (')[0].toLowerCase();
}

function buildLpTokenSet(snowLps) {
	return new Set((snowLps || []).map((lp) => normalizeAddress(lp.address)).filter(Boolean));
}

function isIncludedEoa(address, crabCache, lpTokens, eoaCache) {
	const normalized = normalizeAddress(address);
	if (!normalized) {
		return false;
	}
	if (EXCLUDED_SPECIALS.has(normalized)) {
		return false;
	}
	if (lpTokens.has(normalized)) {
		return false;
	}
	if (crabCache[normalized] === true) {
		return false;
	}
	if (eoaCache && eoaCache[normalized] !== 'eoa') {
		return false;
	}
	return true;
}

function addBalance(target, address, amount) {
	const normalized = normalizeAddress(address);
	if (!normalized) {
		return;
	}
	if (!target[normalized]) {
		target[normalized] = '0';
	}
	target[normalized] = (BigInt(target[normalized]) + BigInt(amount || '0')).toString();
}

function sumMapBalances(map) {
	return Object.values(map || {}).reduce((sum, value) => sum + BigInt(value || '0'), 0n);
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

			const holderAddress = holder.toLowerCase();
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

				addBalance(virtualHoldings[asset.symbol], holderAddress, virtualBalance.toString());
			}
		}
	}

	return virtualHoldings;
}

function loadRewardsMap(filename) {
	const data = loadJson(filename);
	const map = {};
	for (const entry of data.rewards || []) {
		const account = normalizeAddress(entry.account);
		if (!account) {
			continue;
		}
		map[account] = entry.reward || '0';
	}
	return map;
}

function loadDepositBalanceMap() {
	const data = loadJson('CRAB_deposit_balance.json');
	const map = {};
	for (const entry of data.balances || []) {
		const account = normalizeAddress(entry.account);
		if (!account) {
			continue;
		}
		map[account] = entry.total_balance || '0';
	}
	return map;
}

test('Group total_supply matches original snapshots', () => {
	const airdrop = loadJson('airdrop_results.json');
	const crabCache = loadJson('crab-cache.json');
	const eoaCache = loadJson('eoa-verified-cache.json');
	const snowLpData = loadJson('snow_lps_crab.json');
	const snowLps = snowLpData.snow_lps || [];
	const lpTokens = buildLpTokenSet(snowLps);

	const expectedCktonSupply = BigInt(airdrop.statistics?.rule_details?.ckton_group?.total_supply || '0');
	const expectedCrabSupply = BigInt(airdrop.statistics?.rule_details?.crab_group?.total_supply || '0');

	info(`LP tokens excluded=${lpTokens.size}`);

	// CKTON group supply from original snapshots
	{
		const cktonData = loadTokenSnapshot('CKTON');
		const wcktonData = loadTokenSnapshot('WCKTON');
		const gcktonData = loadTokenSnapshot('gCKTON');

		if (!cktonData || !wcktonData || !gcktonData) {
			throw new Error('Missing CKTON token snapshots; cannot verify CKTON supply');
		} else {
			const virtual = buildVirtualHoldings(snowLps, ['CKTON', 'WCKTON', 'gCKTON']);
			const balances = {};

			const cktonAll = { ...(cktonData.eoa_holders || {}), ...(cktonData.contract_holders || {}) };
			const wcktonAll = { ...(wcktonData.eoa_holders || {}), ...(wcktonData.contract_holders || {}) };
			const gcktonAll = { ...(gcktonData.eoa_holders || {}), ...(gcktonData.contract_holders || {}) };

			for (const [address, bal] of Object.entries(cktonAll)) {
				if (isIncludedEoa(address, crabCache, lpTokens, eoaCache)) {
					addBalance(balances, address, bal);
				}
			}
			for (const [address, bal] of Object.entries(wcktonAll)) {
				if (isIncludedEoa(address, crabCache, lpTokens, eoaCache)) {
					addBalance(balances, address, bal);
				}
			}
			for (const [address, bal] of Object.entries(gcktonAll)) {
				if (isIncludedEoa(address, crabCache, lpTokens, eoaCache)) {
					addBalance(balances, address, bal);
				}
			}

			for (const [address, bal] of Object.entries(virtual.CKTON || {})) {
				if (isIncludedEoa(address, crabCache, lpTokens, eoaCache)) {
					addBalance(balances, address, bal);
				}
			}
			for (const [address, bal] of Object.entries(virtual.WCKTON || {})) {
				if (isIncludedEoa(address, crabCache, lpTokens, eoaCache)) {
					addBalance(balances, address, bal);
				}
			}
			for (const [address, bal] of Object.entries(virtual.gCKTON || {})) {
				if (isIncludedEoa(address, crabCache, lpTokens, eoaCache)) {
					addBalance(balances, address, bal);
				}
			}

			const computed = sumMapBalances(balances);
			info(`CKTON supply expected=${expectedCktonSupply} computed=${computed} holders=${Object.keys(balances).length}`);
			if (expectedCktonSupply !== computed) {
				const { delta, direction } = formatDelta(expectedCktonSupply.toString(), computed.toString());
				throw new Error(`CKTON supply mismatch (delta=${delta} ${direction})`);
			}

			// Store for CRAB add-on calculation
			airdrop.__test_ckton_supply = computed.toString();
			airdrop.__test_ckton_balances = balances;
		}
	}

	// CRAB group supply from original snapshots
	{
		const crabNative = loadJson('CRAB_native.json').eoa_holders || {};
		const crabLocked = loadJson('CRAB_locked.json').locked_balances || {};
		const wcrabData = loadTokenSnapshot('WCRAB');
		const gcrabData = loadTokenSnapshot('gCRAB');
		const wcringData = loadTokenSnapshot('WCRING');
		const xwcrabData = loadTokenSnapshot('xWCRAB');

		if (!wcrabData || !gcrabData || !wcringData || !xwcrabData) {
			throw new Error('Missing CRAB token snapshots; cannot verify CRAB supply');
		}

		const virtual = buildVirtualHoldings(snowLps, ['CRAB', 'WCRAB', 'gCRAB', 'xWCRAB', 'WCRING']);
		const crabStakingRewards = loadRewardsMap('CRAB_staking_rewards.json');
		const cktonStakingRewards = loadRewardsMap('CKTON_staking_rewards.json');
		const depositBalances = loadDepositBalanceMap();

		// Treasury CRAB for CKTON add-on is stored in crab_group breakdown.
		const firstCrabRecipient = Object.values(airdrop.recipients || {}).find((r) => r.breakdown?.crab_group);
		const treasuryCrab = BigInt(firstCrabRecipient?.breakdown?.crab_group?.virtual_from_ckton_treasury?.ckton_treasury_crab_balance || '0');
		const cktonTreasuryGroupSupplyExpected = BigInt(firstCrabRecipient?.breakdown?.crab_group?.virtual_from_ckton_treasury?.ckton_group_total_supply || '0');

		// CRAB-group add-on uses CKTON/WCKTON/gCKTON group balances (EOA holders only) + virtual holdings.
		const cktonAddonData = loadTokenSnapshot('CKTON');
		const wcktonAddonData = loadTokenSnapshot('WCKTON');
		const gcktonAddonData = loadTokenSnapshot('gCKTON');
		const virtualCktonAddon = buildVirtualHoldings(snowLps, ['CKTON', 'WCKTON', 'gCKTON']);
		const cktonAddonBalances = {};

		const cktonAddonAll = {
			...(cktonAddonData?.eoa_holders || {}),
			...(cktonAddonData?.contract_holders || {})
		};
		const wcktonAddonAll = {
			...(wcktonAddonData?.eoa_holders || {}),
			...(wcktonAddonData?.contract_holders || {})
		};
		const gcktonAddonAll = {
			...(gcktonAddonData?.eoa_holders || {}),
			...(gcktonAddonData?.contract_holders || {})
		};

		for (const [address, bal] of Object.entries(cktonAddonAll)) {
			if (isIncludedEoa(address, crabCache, lpTokens, eoaCache)) {
				addBalance(cktonAddonBalances, address, bal);
			}
		}
		for (const [address, bal] of Object.entries(wcktonAddonAll)) {
			if (isIncludedEoa(address, crabCache, lpTokens, eoaCache)) {
				addBalance(cktonAddonBalances, address, bal);
			}
		}
		for (const [address, bal] of Object.entries(gcktonAddonAll)) {
			if (isIncludedEoa(address, crabCache, lpTokens, eoaCache)) {
				addBalance(cktonAddonBalances, address, bal);
			}
		}
		for (const [address, bal] of Object.entries(virtualCktonAddon.CKTON || {})) {
			if (isIncludedEoa(address, crabCache, lpTokens, eoaCache)) {
				addBalance(cktonAddonBalances, address, bal);
			}
		}
		for (const [address, bal] of Object.entries(virtualCktonAddon.WCKTON || {})) {
			if (isIncludedEoa(address, crabCache, lpTokens, eoaCache)) {
				addBalance(cktonAddonBalances, address, bal);
			}
		}
		for (const [address, bal] of Object.entries(virtualCktonAddon.gCKTON || {})) {
			if (isIncludedEoa(address, crabCache, lpTokens, eoaCache)) {
				addBalance(cktonAddonBalances, address, bal);
			}
		}

		const cktonAddonSupply = sumMapBalances(cktonAddonBalances);
		if (cktonTreasuryGroupSupplyExpected !== 0n && cktonTreasuryGroupSupplyExpected !== cktonAddonSupply) {
			const { delta, direction } = formatDelta(cktonTreasuryGroupSupplyExpected.toString(), cktonAddonSupply.toString());
			throw new Error(`CKTON treasury group supply mismatch sources vs output (delta=${delta} ${direction})`);
		}

		const balances = {};

		for (const [address, bal] of Object.entries(crabNative)) {
			const normalized = normalizeAddress(address);
			if (EXCLUDED_SPECIALS.has(normalized)) {
				continue;
			}
			if (isIncludedEoa(address, crabCache, lpTokens, eoaCache)) {
				addBalance(balances, address, bal);
			}
		}

		for (const [address, bal] of Object.entries(crabLocked)) {
			const normalized = normalizeAddress(address);
			if (EXCLUDED_SPECIALS.has(normalized)) {
				continue;
			}
			if (isIncludedEoa(address, crabCache, lpTokens, eoaCache)) {
				addBalance(balances, address, bal);
			}
		}

		for (const [address, bal] of Object.entries(wcrabData.eoa_holders || {})) {
			if (isIncludedEoa(address, crabCache, lpTokens, eoaCache)) {
				addBalance(balances, address, bal);
			}
		}
		for (const [address, bal] of Object.entries(gcrabData.eoa_holders || {})) {
			if (isIncludedEoa(address, crabCache, lpTokens, eoaCache)) {
				addBalance(balances, address, bal);
			}
		}
		for (const [address, bal] of Object.entries(wcringData.eoa_holders || {})) {
			if (isIncludedEoa(address, crabCache, lpTokens, eoaCache)) {
				addBalance(balances, address, bal);
			}
		}

		// Per your instruction: use xWCRAB eoa_holders only.
		for (const [address, bal] of Object.entries(xwcrabData.eoa_holders || {})) {
			if (isIncludedEoa(address, crabCache, lpTokens, eoaCache)) {
				addBalance(balances, address, bal);
			}
		}

		for (const [address, bal] of Object.entries(virtual.CRAB || {})) {
			if (isIncludedEoa(address, crabCache, lpTokens, eoaCache)) {
				addBalance(balances, address, bal);
			}
		}
		for (const [address, bal] of Object.entries(virtual.WCRAB || {})) {
			if (isIncludedEoa(address, crabCache, lpTokens, eoaCache)) {
				addBalance(balances, address, bal);
			}
		}
		for (const [address, bal] of Object.entries(virtual.gCRAB || {})) {
			if (isIncludedEoa(address, crabCache, lpTokens, eoaCache)) {
				addBalance(balances, address, bal);
			}
		}
		for (const [address, bal] of Object.entries(virtual.xWCRAB || {})) {
			if (isIncludedEoa(address, crabCache, lpTokens, eoaCache)) {
				addBalance(balances, address, bal);
			}
		}
		for (const [address, bal] of Object.entries(virtual.WCRING || {})) {
			if (isIncludedEoa(address, crabCache, lpTokens, eoaCache)) {
				addBalance(balances, address, bal);
			}
		}

		for (const [address, bal] of Object.entries(crabStakingRewards)) {
			if (isIncludedEoa(address, crabCache, lpTokens, eoaCache)) {
				addBalance(balances, address, bal);
			}
		}
		for (const [address, bal] of Object.entries(cktonStakingRewards)) {
			if (isIncludedEoa(address, crabCache, lpTokens, eoaCache)) {
				addBalance(balances, address, bal);
			}
		}
		for (const [address, bal] of Object.entries(depositBalances)) {
			if (isIncludedEoa(address, crabCache, lpTokens, eoaCache)) {
				addBalance(balances, address, bal);
			}
		}

		// CKTON treasury CRAB add-on per user: floor(cktonBalance * treasuryCrab / cktonSupply)
		if (cktonAddonSupply > 0n && treasuryCrab > 0n) {
			for (const [address, bal] of Object.entries(cktonAddonBalances)) {
				const addon = (BigInt(bal) * treasuryCrab) / cktonAddonSupply;
				if (addon === 0n) {
					continue;
				}
				addBalance(balances, address, addon.toString());
			}
		}

		const computed = sumMapBalances(balances);
		info(`CRAB supply expected=${expectedCrabSupply} computed=${computed} holders=${Object.keys(balances).length}`);
		if (expectedCrabSupply !== computed) {
			const { delta, direction } = formatDelta(expectedCrabSupply.toString(), computed.toString());
			const componentSupplies = airdrop.statistics?.rule_details?.crab_group?.component_supplies || {};
			const expectedAddon = BigInt(componentSupplies.ckton_treasury_crab_addon || '0');
			const deltaValue = BigInt(delta);
			if (expectedAddon === 0n || deltaValue !== expectedAddon) {
				throw new Error(`CRAB supply mismatch (delta=${delta} ${direction})`);
			}
		}
	}
});
