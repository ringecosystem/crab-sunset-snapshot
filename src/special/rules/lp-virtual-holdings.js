const path = require('path');
const fs = require('fs');

function loadSnowLPData() {
	const dataDir = path.join(__dirname, '..', '..', '..', 'data');
	const filePath = path.join(dataDir, 'snow_lps_crab.json');

	if (!fs.existsSync(filePath)) {
		throw new Error('Data file not found: snow_lps_crab.json');
	}

	return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadLpTokenAddresses() {
	const data = loadSnowLPData();
	const tokens = new Set();
	for (const lp of data.snow_lps || []) {
		if (lp.address) {
			tokens.add(lp.address.toLowerCase());
		}
	}
	return tokens;
}

function buildVirtualHoldings(allowedSymbols) {
	// Calculate per-holder virtual balances based on LP share of assets.
	const data = loadSnowLPData();
	const virtualHoldings = {};

	for (const lp of data.snow_lps || []) {
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

module.exports = {
	buildVirtualHoldings,
	loadLpTokenAddresses
};
