const BaseAPI = require('../base/api');
const BaseCache = require('../base/cache');
const BaseHolders = require('../base/holders');
const CrabAnnotations = require('./annotations');
const CrabAPI = require('./api');
const fs = require("fs");
const path = require("path");

async function fetchTokenHoldersSnapshot(contractAddress, outputDir) {
	const api = new CrabAPI();
	const annotations = new CrabAnnotations();
	const cacheManager = api.getCacheManager();
	const holdersManager = new BaseHolders(api, cacheManager);
	annotations.getAll();

	const tokenInfo = await api.fetchTokenInfo(contractAddress);
	console.log(`\n📊 ${tokenInfo?.symbol || "Unknown"} - ${tokenInfo?.name || "Unknown"}`);
	console.log(`📍 ${contractAddress}`);
	
	const allHolders = await holdersManager.fetchAllHolders(contractAddress);
	const { contractHolders, eoaHolders } = await holdersManager.separateHoldersByType(allHolders, cacheManager);

	const sortHoldersByBalance = (holders) => {
		const sorted = Object.entries(holders).sort((a, b) => {
			const balA = BigInt(a[1]);
			const balB = BigInt(b[1]);
			if (balA > balB) return -1;
			if (balA < balB) return 1;
			return 0;
		});
		return Object.fromEntries(sorted);
	};

	const output = {
		address: contractAddress,
		name: tokenInfo?.name || "Unknown",
		symbol: tokenInfo?.symbol || "Unknown",
		decimals: tokenInfo?.decimals || 18,
		total_supply: tokenInfo?.total_supply || "0",
		holders_count: Object.keys(allHolders).length,
		contract_holders_count: Object.keys(contractHolders).length,
		eoa_holders_count: Object.keys(eoaHolders).length,
		contract_holders: annotations.annotateHolders(sortHoldersByBalance(contractHolders)),
		eoa_holders: annotations.annotateHolders(sortHoldersByBalance(eoaHolders))
	};

	const outputPath = path.resolve(outputDir);
	if (!fs.existsSync(outputPath)) {
		fs.mkdirSync(outputPath, { recursive: true });
	}

	const symbol = (tokenInfo?.symbol || "Unknown").replace(/[^a-zA-Z0-9]/g, '_');
	const outputFile = path.join(outputPath, `${symbol}_${contractAddress}.json`);

	fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));

	console.log(`💾 Saved: ${path.basename(outputFile)}`);
	console.log(`✨ Done!\n`);
	
	return output;
}

module.exports = {
	fetchTokenHoldersSnapshot,
	fetchCrabTokenSnapshot: fetchTokenHoldersSnapshot
};
