const fs = require('fs');
const path = require('path');

const TARGET_SYMBOLS = ['xRING', 'xWRING'];

function normalizeAddress(address) {
	return (address || '').split(' (')[0].toLowerCase();
}

function addBalance(target, address, amount) {
	if (!target[address]) {
		target[address] = '0';
	}
	target[address] = (BigInt(target[address]) + BigInt(amount || '0')).toString();
}

function sortBalances(balances) {
	const entries = Object.entries(balances).sort((a, b) => {
		const balanceA = BigInt(a[1]);
		const balanceB = BigInt(b[1]);
		if (balanceA > balanceB) return -1;
		if (balanceA < balanceB) return 1;
		return 0;
	});
	return Object.fromEntries(entries);
}

function buildLpProviders(snowLps) {
	const providers = {};

	for (const lp of snowLps || []) {
		const assets = lp.assets || [];
		const includesTarget = assets.some((asset) => TARGET_SYMBOLS.includes(asset.symbol));
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

	return sortBalances(providers);
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

	console.log(`✅ xRING/xWRING LP providers: ${Object.keys(providers).length}`);
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
