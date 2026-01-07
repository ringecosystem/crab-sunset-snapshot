const BaseAPI = require('../base/api');
const BaseCache = require('../base/cache');
const BaseHolders = require('../base/holders');
const DarwiniaAnnotations = require('./annotations');
const DarwiniaAPI = require('./api');
const fs = require("fs");
const path = require("path");

async function fetchTokenHoldersSnapshot(contractAddress, outputDir) {
	const api = new DarwiniaAPI();
	const annotations = new DarwiniaAnnotations(api);
	const cacheManager = api.getCacheManager();
	const holdersManager = new BaseHolders(api, cacheManager);
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

	console.log(`\n🔍 Checking for LP contracts...`);
	let lpContractCount = 0;

	for (const contractAddr of Object.keys(contractHolders)) {
		const tokenInfo = await api.fetchTokenInfo(contractAddr);
		if (tokenInfo && ((tokenInfo.name && tokenInfo.name.includes("Snow LP")) || tokenInfo.symbol === "SNOW-LP")) {
			console.log(`  ✅ Found LP token: ${tokenInfo.symbol} (${contractAddr})`);
			lpContractCount++;
		}
		await new Promise(r => setTimeout(r, 100));
	}

	if (lpContractCount === 0) {
		console.log(`  ℹ️  No LP contracts found holding ${tokenInfo?.symbol}`);
	}

	await annotations.loadForContracts(Object.keys(contractHolders));
	const finalContractHolders = annotations.annotateHolders(sortHoldersByBalance(contractHolders));
	const finalEoaHolders = annotations.annotateHolders(sortHoldersByBalance(eoaHolders));

	const output = {
		address: contractAddress,
		name: tokenInfo?.name || "Unknown",
		symbol: tokenInfo?.symbol || "Unknown",
		decimals: tokenInfo?.decimals || 18,
		total_supply: tokenInfo?.total_supply || "0",
		holders_count: Object.keys(allHolders).length,
		contract_holders_count: Object.keys(contractHolders).length,
		eoa_holders_count: Object.keys(eoaHolders).length,
		contract_holders: finalContractHolders,
		eoa_holders: finalEoaHolders
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
	fetchDarwiniaTokenSnapshot: fetchTokenHoldersSnapshot
};
