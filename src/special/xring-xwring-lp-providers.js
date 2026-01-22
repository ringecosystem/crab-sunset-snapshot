const fs = require('fs');
const path = require('path');

const TARGET_SYMBOLS = ['xRING', 'xWRING'];
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

function sortProviders(providers) {
	const entries = Object.entries(providers).sort((a, b) => {
		const balanceA = BigInt(a[1].total || '0');
		const balanceB = BigInt(b[1].total || '0');
		if (balanceA > balanceB) return -1;
		if (balanceA < balanceB) return 1;
		return 0;
	});
	return Object.fromEntries(entries);
}

function buildLpAssets(assets) {
	const lpAssets = {};
	for (const asset of assets || []) {
		if (!TARGET_SYMBOLS.includes(asset.symbol)) {
			continue;
		}
		lpAssets[asset.symbol] = asset.balance || '0';
	}
	return lpAssets;
}

function buildProviderAssets(lpAssets, holderBalance, totalSupply) {
	const providerAssets = {};
	const balanceRatio = BigInt(holderBalance || '0');
	const supply = BigInt(totalSupply || '0');
	if (supply === 0n || balanceRatio === 0n) {
		return providerAssets;
	}
	if (lpAssets.xRING) {
		providerAssets.xRING = (
			(BigInt(lpAssets.xRING || '0') * balanceRatio) / supply
		).toString();
	}
	if (lpAssets.xWRING) {
		providerAssets.xWRING = (
			(BigInt(lpAssets.xWRING || '0') * balanceRatio) / supply
		).toString();
	}
	return providerAssets;
}

function buildProviderTotal(providerAssets) {
	const xringBalance = BigInt(providerAssets.xRING || '0') * XRING_SCALE;
	const xwringBalance = BigInt(providerAssets.xWRING || '0');
	return (xringBalance + xwringBalance).toString();
}

function formatWithDecimals(value, decimals) {
	const numeric = BigInt(value || '0');
	const scale = 10n ** BigInt(decimals);
	const integerPart = numeric / scale;
	const fractionalPart = (numeric % scale).toString().padStart(decimals, '0');
	return `${integerPart.toString()}.${fractionalPart}`;
}

function buildLpProviders(snowLps) {
	const totals = {};
	const providers = {};

	for (const lp of snowLps || []) {
		const assets = lp.assets || [];
		const includesTarget = assets.some((asset) => TARGET_SYMBOLS.includes(asset.symbol));
		if (!includesTarget) {
			continue;
		}
		const lpAssets = buildLpAssets(assets);
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
			const providerAssets = buildProviderAssets(lpAssets, holderBalance, totalSupply);
			if (!Object.keys(providerAssets).length) {
				continue;
			}
			const providerTotal = buildProviderTotal(providerAssets);
			addBalance(totals, normalized, providerTotal);
			if (!providers[normalized]) {
				providers[normalized] = {
					total: '0',
					breakdown: []
				};
			}
			providers[normalized].breakdown.push({
				lp_address: lpAddress,
				provided_assets: providerAssets
			});
		}
	}

	const totalAmount = Object.values(totals).reduce(
		(sum, total) => sum + BigInt(total || '0'),
		0n
	);
	const sortedTotals = sortProviders(
		Object.fromEntries(Object.entries(totals).map(([address, total]) => [
			address,
			{ total }
		]))
	);
	const sortedProviders = {};
	Object.keys(sortedTotals).forEach((address) => {
		sortedProviders[address] = {
			total: totals[address],
			breakdown: providers[address] ? providers[address].breakdown : []
		};
	});
	return {
		metadata: {
			generated_at: new Date().toISOString(),
			source: 'snow_lps_crab.json',
			symbols: [...TARGET_SYMBOLS],
			holders_count: Object.keys(sortedProviders).length,
			total_amount: totalAmount.toString(),
			total_amount_with_decimal: formatWithDecimals(totalAmount.toString(), 18)
		},
		providers: sortedProviders
	};
}

function loadCrabSnowLps(dataDir) {
	const snowLpFile = path.join(dataDir, 'snow_lps_crab.json');
	if (!fs.existsSync(snowLpFile)) {
		throw new Error('Missing snow_lps_crab.json. Run npm run snow-lps first.');
	}
	const data = JSON.parse(fs.readFileSync(snowLpFile, 'utf8'));
	return data.snow_lps || [];
}

function writeXringXwringLpProviders(outputDir) {
	const dataDir = path.resolve(outputDir || path.join(__dirname, '..', '..', 'data'));
	const snowLps = loadCrabSnowLps(dataDir);
	const providers = buildLpProviders(snowLps);

	if (!fs.existsSync(dataDir)) {
		fs.mkdirSync(dataDir, { recursive: true });
	}

	const outputFile = path.join(dataDir, 'xRING_xWRING_lp_providers.json');
	fs.writeFileSync(outputFile, JSON.stringify(providers, null, 2));

	console.log(`✅ xRING/xWRING LP providers: ${Object.keys(providers.providers).length}`);
	console.log(`💾 Saved: ${path.basename(outputFile)}`);

	return {
		outputFile,
		providers
	};
}

module.exports = {
	buildLpProviders,
	writeXringXwringLpProviders
};
