const { loadJson } = require('../helpers/data');
const { pickSampleKeys } = require('../helpers/sample');
const { info } = require('../helpers/log');

function normalizeAddress(address) {
	return (address || '').split(' (')[0].toLowerCase();
}

function addBalance(target, address, amount) {
	if (!target[address]) {
		target[address] = '0';
	}
	target[address] = (BigInt(target[address]) + BigInt(amount || '0')).toString();
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

			const address = normalizeAddress(holder);
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

				addBalance(virtualHoldings[asset.symbol], address, virtualBalance.toString());
			}
		}
	}

	return virtualHoldings;
}

function assertMatch(message, expected, actual) {
	if (expected !== actual) {
		throw new Error(`${message} expected=${expected} actual=${actual}`);
	}
}

test('LP virtual balances match breakdown values', () => {
	const snowLps = loadJson('snow_lps_crab.json').snow_lps || [];
	const airdrop = loadJson('airdrop_results.json');
	const recipients = airdrop.recipients || {};
	const virtualHoldings = buildVirtualHoldings(snowLps, [
		'CRAB',
		'WCRAB',
		'gCRAB',
		'xWCRAB',
		'WCRING',
		'CKTON',
		'WCKTON',
		'gCKTON'
	]);

	const crabRecipients = Object.values(recipients).filter((recipient) => {
		return !!recipient.breakdown?.crab_group;
	});
	const crabSample = pickSampleKeys(crabRecipients.map((recipient) => recipient.address));
	info(`CRAB virtual samples=${crabSample.length}`);
	crabSample.forEach((address) => {
		const breakdown = recipients[address]?.breakdown?.crab_group;
		if (!breakdown) {
			return;
		}

		const expectedCrab = virtualHoldings.CRAB?.[address] || '0';
		const expectedWcrab = virtualHoldings.WCRAB?.[address] || '0';
		const expectedGcrab = virtualHoldings.gCRAB?.[address] || '0';
		const expectedXwcrab = virtualHoldings.xWCRAB?.[address] || '0';
		const expectedWcring = virtualHoldings.WCRING?.[address] || '0';

		if (breakdown.virtual_crab_from_lp !== expectedCrab) {
			assertMatch(`CRAB virtual balance for ${address}`, expectedCrab, breakdown.virtual_crab_from_lp);
		}
		if (breakdown.virtual_wcrab_from_lp !== expectedWcrab) {
			assertMatch(`WCRAB virtual balance for ${address}`, expectedWcrab, breakdown.virtual_wcrab_from_lp);
		}
		if (breakdown.virtual_gcrab_from_lp !== expectedGcrab) {
			assertMatch(`gCRAB virtual balance for ${address}`, expectedGcrab, breakdown.virtual_gcrab_from_lp);
		}
		if (breakdown.virtual_xwcrab_from_lp !== expectedXwcrab) {
			assertMatch(`xWCRAB virtual balance for ${address}`, expectedXwcrab, breakdown.virtual_xwcrab_from_lp);
		}
		if (breakdown.virtual_wcring_from_lp !== expectedWcring) {
			assertMatch(`WCRING virtual balance for ${address}`, expectedWcring, breakdown.virtual_wcring_from_lp);
		}
	});

	const cktonRecipients = Object.values(recipients).filter((recipient) => {
		return !!recipient.breakdown?.ckton_group;
	});
	const cktonSample = pickSampleKeys(cktonRecipients.map((recipient) => recipient.address));
	info(`CKTON virtual samples=${cktonSample.length}`);
	cktonSample.forEach((address) => {
		const breakdown = recipients[address]?.breakdown?.ckton_group;
		if (!breakdown) {
			return;
		}

		const expectedCkton = virtualHoldings.CKTON?.[address] || '0';
		const expectedWckton = virtualHoldings.WCKTON?.[address] || '0';
		const expectedGckton = virtualHoldings.gCKTON?.[address] || '0';

		if (breakdown.virtual_ckton_balance !== expectedCkton) {
			assertMatch(`CKTON virtual balance for ${address}`, expectedCkton, breakdown.virtual_ckton_balance);
		}
		if (breakdown.virtual_wckton_balance !== expectedWckton) {
			assertMatch(`WCKTON virtual balance for ${address}`, expectedWckton, breakdown.virtual_wckton_balance);
		}
		if (breakdown.virtual_gckton_balance !== expectedGckton) {
			assertMatch(`gCKTON virtual balance for ${address}`, expectedGckton, breakdown.virtual_gckton_balance);
		}
	});
});

test('CKTON treasury add-on matches expected amounts', () => {
	const airdrop = loadJson('airdrop_results.json');
	const recipients = airdrop.recipients || {};

	const crabRecipients = Object.values(recipients).filter((recipient) => {
		return !!recipient.breakdown?.crab_group;
	});

	const first = crabRecipients[0];
	const treasuryCrab = BigInt(first?.breakdown?.crab_group?.virtual_from_ckton_treasury?.ckton_treasury_crab_balance || '0');
	const cktonSupply = BigInt(first?.breakdown?.crab_group?.virtual_from_ckton_treasury?.ckton_group_total_supply || '0');

	if (treasuryCrab === 0n || cktonSupply === 0n) {
		throw new Error('CKTON treasury add-on has zero supply or balance');
	}

	const sampleAddresses = pickSampleKeys(crabRecipients.map((recipient) => recipient.address));
	info(`CKTON treasury add-on samples=${sampleAddresses.length}`);

	sampleAddresses.forEach((address) => {
		const recipient = recipients[address];
		const crabBreakdown = recipient?.breakdown?.crab_group;
		const cktonBreakdown = recipient?.breakdown?.ckton_group;
		if (!crabBreakdown || !cktonBreakdown) {
			return;
		}

		const cktonBalance = BigInt(cktonBreakdown.group_balance || '0');
		const expected = ((cktonBalance * treasuryCrab) / cktonSupply).toString();
		const actual = crabBreakdown.virtual_from_ckton_treasury?.amount || '0';
		if (expected !== actual) {
			assertMatch(`CKTON treasury add-on for ${address}`, expected, actual);
		}
	});
});
