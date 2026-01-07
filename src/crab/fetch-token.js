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
		eoa_holders: annotations.annotateHolders(sortHoldersByBalance(eoaHolders)),
		lp_holders: {}
	};

	console.log(`\n🔍 Checking for LP contracts...`);
	const lpContracts = [];

	for (const contractAddr of Object.keys(contractHolders)) {
		const tokenInfo = await api.fetchTokenInfo(contractAddr);
		if (tokenInfo && tokenInfo.name && tokenInfo.name.includes("Snow LP")) {
			console.log(`  ✅ Found LP token: ${tokenInfo.symbol} (${contractAddr})`);
			lpContracts.push({
				address: contractAddr,
				name: tokenInfo.name,
				symbol: tokenInfo.symbol,
				decimals: tokenInfo.decimals,
				lp_contract_balances: contractHolders[contractAddr]
			});
		}
		await new Promise(r => setTimeout(r, 100));
	}

	if (lpContracts.length > 0) {
		console.log(`\n🔄 Fetching holders for ${lpContracts.length} LP contracts...`);
		
		for (const lp of lpContracts) {
			console.log(`\n  📊 ${lp.symbol} - ${lp.name}`);
			console.log(`  📍 ${lp.address}`);
			
			const lpAllHolders = await holdersManager.fetchAllHolders(lp.address);
			const lpCache = api.getCache();
			const { contractHolders: lpContractHolders, eoaHolders: lpEoaHolders } = await holdersManager.separateHoldersByType(lpAllHolders, lpCache);
			
			const lpContractHoldersSorted = sortHoldersByBalance(lpContractHolders);
			const lpEoaHoldersSorted = sortHoldersByBalance(lpEoaHolders);
			
			output.lp_holders[lp.address] = {
				name: lp.name,
				symbol: lp.symbol,
				decimals: lp.decimals,
				lp_contract_balances: lp.lp_contract_balances,
				holders_count: Object.keys(lpAllHolders).length,
				contract_holders_count: Object.keys(lpContractHolders).length,
				eoa_holders_count: Object.keys(lpEoaHolders).length,
				contract_holders: annotations.annotateHolders(lpContractHoldersSorted),
				eoa_holders: annotations.annotateHolders(lpEoaHoldersSorted)
			};
		}
		
		console.log(`\n✅ Fetched holders for all LP contracts`);
	} else {
		console.log(`  ℹ️  No LP contracts found holding ${tokenInfo?.symbol}`);
	}

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
	fetchTokenHoldersSnapshot
};
