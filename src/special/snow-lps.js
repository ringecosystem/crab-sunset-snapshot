const fs = require("fs");
const path = require("path");
const BaseHolders = require('../base/holders');
const CrabAPI = require('../crab/api');
const DarwiniaAPI = require('../darwinia/api');
const CrabAnnotations = require('../crab/annotations');
const DarwiniaAnnotations = require('../darwinia/annotations');

function getAPIAndAnnotations(network) {
	if (network === 'darwinia') {
		return {
			api: new DarwiniaAPI(),
			annotations: function(api) { return new DarwiniaAnnotations(api); },
			baseUrl: "https://explorer.darwinia.network/api",
			chainName: "Darwinia Network"
		};
	}
	// Default to Crab
	return {
		api: new CrabAPI(),
		annotations: function() { return new CrabAnnotations(); },
		baseUrl: "https://crab-scan.darwinia.network/api",
		chainName: "Crab Network"
	};
}

async function fetchAllTokens(baseUrl) {
	console.log(`\n📋 Fetching all tokens from the chain...`);
	let nextPageParams = null;
	let hasMore = true;
	let page = 1;
	const allTokens = [];

	while (hasMore) {
		try {
			let url = `${baseUrl}/v2/tokens`;
			
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

function filterSnowLPs(tokens) {
	const snowLPs = tokens.filter(token => {
		const name = token.name || "";
		return name.includes("Snow LP");
	});
	
	console.log(`✅ Found ${snowLPs.length} Snow LP tokens`);
	return snowLPs;
}

async function processSnowLP(lpToken, api, annotationsObj) {
	const address = lpToken.address;
	const name = lpToken.name || "Unknown";
	const symbol = lpToken.symbol || "Unknown";
	
	console.log(`\n🔄 Processing: ${symbol} - ${name}`);
	console.log(`📍 ${address}`);
	
	// Fetch all holders
	const holdersManager = new BaseHolders(api, api.getCacheManager());
	const allHolders = await holdersManager.fetchAllHolders(address);
	
	// Separate contract holders and EOA holders
	const addressCache = api.getCache();
	const { contractHolders, eoaHolders } = await holdersManager.separateHoldersByType(allHolders, addressCache);
	
	// Fetch tokens held by the LP contract itself
	console.log(`💰 Fetching LP contract assets...`);
	const assets = await api.fetchAddressTokens(address);
	console.log(`✅ Found ${assets.length} asset(s) in LP contract`);
	
	// Rate limiting
	await new Promise((r) => setTimeout(r, 200));
	
	return {
		address: address,
		name: name,
		symbol: symbol,
		decimals: parseInt(lpToken.decimals) || 18,
		total_supply: lpToken.total_supply || "0",
		assets: assets,
		holders_count: Object.keys(allHolders).length,
		contract_holders_count: Object.keys(contractHolders).length,
		eoa_holders_count: Object.keys(eoaHolders).length,

		contract_holders: annotationsObj.annotateHolders(holdersManager.sortHoldersByBalance(contractHolders)),
		eoa_holders: annotationsObj.annotateHolders(holdersManager.sortHoldersByBalance(eoaHolders))
	};
}

async function fetchSnowLPsSnapshot(outputDir, network = 'crab') {
	console.log(`\n📊 Snow LPs Snapshot`);
	console.log(`📍 ${network === 'darwinia' ? 'Darwinia' : 'Crab'} Network`);

	// Get network-specific API and config
	const config = getAPIAndAnnotations(network);
	const api = config.api;
	const annotationsObj = config.annotations(api);
	
	// Fetch all tokens from the chain
	const allTokens = await fetchAllTokens(config.baseUrl);
	
	// Filter Snow LP tokens
	const snowLPs = filterSnowLPs(allTokens);
	
	if (snowLPs.length === 0) {
		console.log(`⚠️  No Snow LP tokens found`);
		return;
	}
	
	// Process each Snow LP
	const results = [];
	for (let i = 0; i < snowLPs.length; i++) {
		console.log(`\n[${i + 1}/${snowLPs.length}]`);
		const result = await processSnowLP(snowLPs[i], api, annotationsObj);
		results.push(result);
	}
	
	// Prepare output
	const output = {
		timestamp: new Date().toISOString(),
		chain: config.chainName,
		snow_lps_count: results.length,
		snow_lps: results
	};

	// Ensure output directory exists
	const outputPath = path.resolve(outputDir);
	if (!fs.existsSync(outputPath)) {
		fs.mkdirSync(outputPath, { recursive: true });
	}

	// Generate network-specific filename
	const outputFile = path.join(outputPath, `snow_lps_${network}.json`);

	// Write JSON file
	fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));

	console.log(`\n💾 Saved: ${path.basename(outputFile)}`);
	console.log(`✨ Done!\n`);
	
	return output;
}

module.exports = {
	fetchSnowLPsSnapshot
};
