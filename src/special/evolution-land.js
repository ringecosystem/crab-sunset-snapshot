const fs = require("fs");
const path = require("path");
const BaseHolders = require('../base/holders');
const CrabAPI = require('../crab/api');
const CrabAnnotations = require('../crab/annotations');

const BASE_URL = "https://crab-scan.darwinia.network/api";

async function fetchAllTokens() {
	console.log(`\n📋 Fetching all tokens from the chain...`);
	let nextPageParams = null;
	let hasMore = true;
	let page = 1;
	const allTokens = [];

	while (hasMore) {
		try {
			let url = `${BASE_URL}/v2/tokens`;

			if (nextPageParams) {
				const params = new URLSearchParams();
				for (const [key, value] of Object.entries(nextPageParams)) {
					params.append(key, value);
				}
				url += `?${params.toString()}`;
			}

			const response = await fetch(url, {
				headers: {
					'Accept': 'application/json'
				}
			});

			if (!response.ok) {
				throw new Error(`HTTP Error: ${response.status}`);
			}

			const data = await response.json();
			const items = data.items || [];

			if (items.length === 0) {
				hasMore = false;
				break;
			}

			allTokens.push(...items);
			process.stdout.write(`\rFetching tokens: ${allTokens.length} found (page ${page})...`);

			// Check if there's a next page
			if (data.next_page_params) {
				nextPageParams = data.next_page_params;
				page++;
			} else {
				hasMore = false;
			}

			// Rate limiting
			await new Promise((r) => setTimeout(r, 200));
		} catch (error) {
			console.error(`\n❌ Error on page ${page}:`, error.message);
			break;
		}
	}

	process.stdout.write(`\n`);
	console.log(`✅ Fetched ${allTokens.length} tokens`);
	return allTokens;
}

function filterEvolutionLand(tokens) {
	const evolutionTokens = tokens.filter(token => {
		const name = token.name || "";
		return name.startsWith("Evolution Land");
	});

	console.log(`✅ Found ${evolutionTokens.length} Evolution Land tokens`);
	return evolutionTokens;
}

async function processEvolutionToken(evolutionToken, api, annotationsObj) {
	const address = evolutionToken.address;
	const name = evolutionToken.name || "Unknown";
	const symbol = evolutionToken.symbol || "Unknown";
	
	console.log(`\n🔄 Processing: ${symbol} - ${name}`);
	console.log(`📍 ${address}`);
	
	// Fetch all holders
	const holdersManager = new BaseHolders(api, api.getCacheManager());
	const allHolders = await holdersManager.fetchAllHolders(address);
	
	// Separate contract holders and EOA holders
	const addressCache = api.getCache();
	const { contractHolders, eoaHolders } = await holdersManager.separateHoldersByType(allHolders, addressCache);

	return {
		address: address,
		name: name,
		symbol: symbol,
		decimals: parseInt(evolutionToken.decimals) || 18,
		total_supply: evolutionToken.total_supply || "0",
		holders_count: Object.keys(allHolders).length,
		contract_holders_count: Object.keys(contractHolders).length,
		eoa_holders_count: Object.keys(eoaHolders).length,
		contract_holders: annotationsObj.annotateHolders(holdersManager.sortHoldersByBalance(contractHolders)),
		eoa_holders: annotationsObj.annotateHolders(holdersManager.sortHoldersByBalance(eoaHolders))
	};
}

async function fetchEvolutionLandSnapshot(outputDir) {
	console.log(`\n📊 Evolution Land Snapshot`);
	console.log(`📍 Crab Network`);

	// Load cache and annotations
	const api = new CrabAPI();
	const annotationsObj = new CrabAnnotations();

	// Fetch all tokens from the chain
	const allTokens = await fetchAllTokens();
	
	// Filter Evolution Land tokens
	const evolutionTokens = filterEvolutionLand(allTokens);
	
	if (evolutionTokens.length === 0) {
		console.log(`⚠️  No Evolution Land tokens found`);
		return;
	}
	
	// Process each Evolution Land token
	const results = [];
	for (let i = 0; i < evolutionTokens.length; i++) {
		console.log(`\n[${i + 1}/${evolutionTokens.length}]`);
		const result = await processEvolutionToken(evolutionTokens[i], api, annotationsObj);
		results.push(result);
	}
	
	// Prepare output
	const output = {
		timestamp: new Date().toISOString(),
		chain: "Crab Network",
		evolution_tokens_count: results.length,
		evolution_tokens: results
	};

	// Ensure output directory exists
	const outputPath = path.resolve(outputDir);
	if (!fs.existsSync(outputPath)) {
		fs.mkdirSync(outputPath, { recursive: true });
	}

	// Generate filename
	const outputFile = path.join(outputPath, `evolution_land_snapshot.json`);

	// Write JSON file
	fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));

	console.log(`\n💾 Saved: ${path.basename(outputFile)}`);
	console.log(`✨ Done!\n`);
	
	return output;
}

module.exports = {
	fetchEvolutionLandSnapshot
};
