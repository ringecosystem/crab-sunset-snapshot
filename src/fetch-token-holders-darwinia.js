const fs = require("fs");
const path = require("path");
const { fetchTokenInfo, fetchTokenHolders } = require('./api-darwinia');
const { fetchAllHolders, separateHoldersByType } = require('./holders-darwinia');
const { loadCache } = require('./cache-darwinia');
const { getAnnotations, annotateHolders, checkIsSnowLP } = require('./annotations-darwinia');

async function fetchTokenHoldersSnapshot(contractAddress, outputDir) {
	// Load cache and annotations
	const addressCache = loadCache();
	let annotations = getAnnotations();

	// First, fetch token information
	const tokenInfo = await fetchTokenInfo(contractAddress);
	console.log(`\n📊 ${tokenInfo?.symbol || "Unknown"} - ${tokenInfo?.name || "Unknown"}`);
	console.log(`📍 ${contractAddress}`);
	
	// Fetch all holders
	const allHolders = await fetchAllHolders(contractAddress);
	
	// Separate contract holders and EOA holders
	const { contractHolders, eoaHolders } = await separateHoldersByType(allHolders, addressCache);

	// Sort holders by balance (descending)
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

	// Check if any contract holders are LP tokens and fetch their holders
	console.log(`\n🔍 Checking for LP contracts...`);
	const lpContracts = [];

	for (const contractAddr of Object.keys(contractHolders)) {
		const isLP = await checkIsSnowLP(contractAddr);
		if (isLP) {
			const tokenInfo = await fetchTokenInfo(contractAddr);
			if (tokenInfo) {
				console.log(`  ✅ Found LP token: ${tokenInfo.symbol} (${contractAddr})`);
				lpContracts.push({
					address: contractAddr,
					name: tokenInfo.name,
					symbol: tokenInfo.symbol,
					decimals: tokenInfo.decimals,
					lp_contract_balances: contractHolders[contractAddr]
				});
				// Add to annotations
				annotations[contractAddr.toLowerCase()] = "Snow LP";
			}
		}
		await new Promise(r => setTimeout(r, 100));
	}

	// Re-annotate holders with updated annotations including LPs
	const finalContractHolders = annotateHolders(sortHoldersByBalance(contractHolders), annotations);
	const finalEoaHolders = annotateHolders(sortHoldersByBalance(eoaHolders), annotations);

	// Prepare output JSON with token info and annotations
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
		eoa_holders: finalEoaHolders,
		lp_holders: {}
	};

	if (lpContracts.length > 0) {
		console.log(`\n🔄 Fetching holders for ${lpContracts.length} LP contracts...`);
		
		for (const lp of lpContracts) {
			console.log(`\n  📊 ${lp.symbol} - ${lp.name}`);
			console.log(`  📍 ${lp.address}`);
			
			// Fetch LP token holders
			const lpAllHolders = await fetchAllHolders(lp.address);
			
			// Separate LP holders by type
			const lpAddressCache = loadCache();
			const { contractHolders: lpContractHolders, eoaHolders: lpEoaHolders } = await separateHoldersByType(lpAllHolders, lpAddressCache);
			
			// Sort LP holders by balance
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
				contract_holders: annotateHolders(lpContractHoldersSorted, annotations),
				eoa_holders: annotateHolders(lpEoaHoldersSorted, annotations)
			};
		}
		
		console.log(`\n✅ Fetched holders for all LP contracts`);
	} else {
		console.log(`  ℹ️  No LP contracts found holding ${tokenInfo?.symbol}`);
	}

	// Ensure output directory exists
	const outputPath = path.resolve(outputDir);
	if (!fs.existsSync(outputPath)) {
		fs.mkdirSync(outputPath, { recursive: true });
	}

	// Generate filename with symbol for easier recognition
	const symbol = (tokenInfo?.symbol || "Unknown").replace(/[^a-zA-Z0-9]/g, '_');
	const outputFile = path.join(outputPath, `${symbol}_${contractAddress}.json`);

	// Write JSON file
	fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));

	console.log(`💾 Saved: ${path.basename(outputFile)}`);
	console.log(`✨ Done!\n`);
	
	return output;
}

module.exports = {
	fetchTokenHoldersSnapshot
};
