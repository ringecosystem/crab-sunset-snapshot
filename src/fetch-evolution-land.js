const fs = require("fs");
const path = require("path");
const { fetchAllHolders } = require('./holders');
const { isSmartContract } = require('./api');
const { loadCache, saveCache } = require('./cache');
const { getAnnotations, annotateHolders } = require('./annotations');

const BASE_URL = "https://crab-scan.darwinia.network/api";

function getTrackedTokenAddresses(dataDir) {
	console.log(`📂 Loading tracked tokens from data folder...`);
	const trackedTokens = [];
	
	try {
		const files = fs.readdirSync(dataDir);
		
		for (const file of files) {
			if (file.endsWith('.json') && !file.includes('native') && !file.includes('snow_lps') && !file.includes('evolution')) {
				const filePath = path.join(dataDir, file);
				const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
				
				if (content.address) {
					trackedTokens.push({
						address: content.address,
						symbol: content.symbol || "Unknown",
						name: content.name || "Unknown"
					});
				}
			}
		}
		
		console.log(`✅ Found ${trackedTokens.length} tracked tokens`);
	} catch (error) {
		console.warn(`⚠️  Could not load tracked tokens:`, error.message);
	}
	
	return trackedTokens;
}

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

async function fetchContractBalances(contractAddress, trackedTokens) {
	const balances = {};
	
	for (const token of trackedTokens) {
		try {
			// Fetch the contract's balance for this token
			const url = `${BASE_URL}?module=account&action=tokenbalance&contractaddress=${token.address}&address=${contractAddress}`;
			
			const response = await fetch(url);
			if (!response.ok) continue;
			
			const data = await response.json();
			
			if (data.result && data.result !== "0") {
				balances[token.address] = {
					symbol: token.symbol,
					name: token.name,
					balance: data.result
				};
			}
			
			await new Promise((r) => setTimeout(r, 100));
		} catch (error) {
			// Skip if error
		}
	}
	
	return balances;
}

async function processEvolutionToken(evolutionToken, addressCache, trackedTokens, annotations) {
	const address = evolutionToken.address;
	const name = evolutionToken.name || "Unknown";
	const symbol = evolutionToken.symbol || "Unknown";
	
	console.log(`\n🔄 Processing: ${symbol} - ${name}`);
	console.log(`📍 ${address}`);
	
	// Fetch all holders
	const allHolders = await fetchAllHolders(address);
	
	// Separate contract holders and EOA holders
	const contractHolders = {};
	const eoaHolders = {};
	
	const addresses = Object.keys(allHolders);
	let checkedCount = 0;
	let cacheHits = 0;
	let apiCalls = 0;
	
	for (const holderAddress of addresses) {
		const wasCached = holderAddress in addressCache;
		const isContract = await isSmartContract(holderAddress, addressCache);
		
		if (wasCached) {
			cacheHits++;
		} else {
			apiCalls++;
		}
		
		if (isContract) {
			contractHolders[holderAddress] = allHolders[holderAddress];
		} else {
			eoaHolders[holderAddress] = allHolders[holderAddress];
		}
		
		checkedCount++;
		if (checkedCount % 10 === 0 || checkedCount === addresses.length) {
			process.stdout.write(`\rChecking types: ${checkedCount}/${addresses.length} (cache: ${cacheHits}, API: ${apiCalls})`);
		}
		
		if (!wasCached) {
			await new Promise((r) => setTimeout(r, 100));
		}
	}
	
	process.stdout.write(`\n`);
	
	// Save updated cache
	saveCache(addressCache);
	
	// Sort holders by balance
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
	
	// Fetch contract balances for tracked tokens
	console.log(`🔍 Fetching contract balances...`);
	const contractBalances = await fetchContractBalances(address, trackedTokens);
	console.log(`✅ Fetched balances for ${Object.keys(contractBalances).length} tokens`);
	
	return {
		address: address,
		name: name,
		symbol: symbol,
		decimals: parseInt(evolutionToken.decimals) || 18,
		total_supply: evolutionToken.total_supply || "0",
		holders_count: Object.keys(allHolders).length,
		contract_holders_count: Object.keys(contractHolders).length,
		eoa_holders_count: Object.keys(eoaHolders).length,
		contract_balances: contractBalances,
		contract_holders: annotateHolders(sortHoldersByBalance(contractHolders), annotations),
		eoa_holders: annotateHolders(sortHoldersByBalance(eoaHolders), annotations)
	};
}

async function fetchEvolutionLandSnapshot(outputDir) {
	console.log(`\n📊 Evolution Land Snapshot`);
	console.log(`📍 Crab Network`);

	// Load cache and annotations
	const addressCache = loadCache();
	const annotations = getAnnotations();
	
	// Get tracked tokens from data folder
	const trackedTokens = getTrackedTokenAddresses(outputDir);
	
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
		const result = await processEvolutionToken(evolutionTokens[i], addressCache, trackedTokens, annotations);
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
