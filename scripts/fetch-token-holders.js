const fs = require("fs");
const path = require("path");
const { fetchTokenInfo } = require('./api');
const { fetchAllHolders, separateHoldersByType } = require('./holders');
const { loadCache } = require('./cache');

async function fetchTokenHoldersSnapshot(contractAddress, outputDir) {
	// Load cache
	const addressCache = loadCache();

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

	// Prepare output JSON with token info
	const output = {
		address: contractAddress,
		name: tokenInfo?.name || "Unknown",
		symbol: tokenInfo?.symbol || "Unknown",
		decimals: tokenInfo?.decimals || 18,
		total_supply: tokenInfo?.total_supply || "0",
		holders_count: Object.keys(allHolders).length,
		contract_holders_count: Object.keys(contractHolders).length,
		eoa_holders_count: Object.keys(eoaHolders).length,
		contract_holders: sortHoldersByBalance(contractHolders),
		eoa_holders: sortHoldersByBalance(eoaHolders)
	};

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
