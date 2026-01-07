const fs = require("fs");
const path = require("path");
const CrabAPI = require('../crab/api');
const CrabAnnotations = require('../crab/annotations');

const BASE_URL = "https://crab-scan.darwinia.network/api";

async function fetchNativeHoldersPage(nextPageParams = null) {
	try {
		let url = `${BASE_URL}/v2/addresses`;
		
		if (nextPageParams) {
			// Build query string from next_page_params
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
		return {
			items: data.items || [],
			next_page_params: data.next_page_params || null
		};
	} catch (error) {
		throw error;
	}
}

async function fetchAllNativeHolders() {
	let nextPageParams = null;
	let hasMore = true;
	let page = 1;
	const allHolders = {};

	while (hasMore) {
		try {
			const result = await fetchNativeHoldersPage(nextPageParams);
			
			if (!result.items || result.items.length === 0) {
				hasMore = false;
				break;
			}

			// Collect holder data
			result.items.forEach((item) => {
				const balance = item.coin_balance || "0";
				allHolders[item.hash] = balance;
			});

			process.stdout.write(`\rFetching native holders: ${Object.keys(allHolders).length} found (page ${page})...`);

			// Check if there's a next page
			if (result.next_page_params) {
				nextPageParams = result.next_page_params;
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
	console.log(`✅ Fetched ${Object.keys(allHolders).length} native holders`);
	return allHolders;
}

async function separateNativeHoldersByType(allHolders, api) {
	const contractHolders = {};
	const eoaHolders = {};
	
	const addresses = Object.keys(allHolders);
	const cache = api.getCache();
	let checkedCount = 0;
	let cacheHits = 0;
	let apiCalls = 0;
	
	for (const address of addresses) {
		const wasCached = address in cache;
		const isContract = await api.isSmartContract(address, cache);
		
		if (wasCached) {
			cacheHits++;
		} else {
			apiCalls++;
		}
		
		if (isContract) {
			contractHolders[address] = allHolders[address];
		} else {
			eoaHolders[address] = allHolders[address];
		}
		
		checkedCount++;
		if (checkedCount % 10 === 0 || checkedCount === addresses.length) {
			process.stdout.write(`\rChecking types: ${checkedCount}/${addresses.length} (cache: ${cacheHits}, API: ${apiCalls})`);
		}
		
		// Rate limiting only for API calls
		if (!wasCached) {
			await new Promise((r) => setTimeout(r, 100));
		}
	}
	
	// Save updated cache
	api.saveCache(cache);
	
	process.stdout.write(`\n`);
	console.log(`✅ Contracts: ${Object.keys(contractHolders).length}, EOAs: ${Object.keys(eoaHolders).length} (cache: ${cacheHits}, API: ${apiCalls})`);

	return { contractHolders, eoaHolders };
}

async function fetchNativeTokenSnapshot(outputDir) {
	console.log(`\n📊 Native Token - CRAB`);
	console.log(`📍 Crab Network Native Token`);

	// Load cache and annotations
	const api = new CrabAPI();
	const annotations = new CrabAnnotations();
	annotations.getAll();
	
	// Fetch all native token holders
	const allHolders = await fetchAllNativeHolders();
	
	// Separate contract holders and EOA holders
	const { contractHolders, eoaHolders } = await separateNativeHoldersByType(allHolders, api);

	// Calculate total balance
	const calculateTotalBalance = (holders) => {
		return Object.values(holders).reduce((sum, balance) => {
			const bal = BigInt(balance || "0");
			return sum + bal;
		}, BigInt(0)).toString();
	};

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

	// Prepare output JSON with annotations
	const output = {
		name: "CRAB",
		symbol: "CRAB",
		decimals: 18,
		holders_count: Object.keys(allHolders).length,
		contract_holders_count: Object.keys(contractHolders).length,
		eoa_holders_count: Object.keys(eoaHolders).length,
		total_balance: calculateTotalBalance(allHolders),
		contract_holders: annotations.annotateHolders(sortHoldersByBalance(contractHolders)),
		eoa_holders: annotations.annotateHolders(sortHoldersByBalance(eoaHolders))
	};

	// Ensure output directory exists
	const outputPath = path.resolve(outputDir);
	if (!fs.existsSync(outputPath)) {
		fs.mkdirSync(outputPath, { recursive: true });
	}

	// Generate filename
	const outputFile = path.join(outputPath, `CRAB_native.json`);

	// Write JSON file
	fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));

	console.log(`💾 Saved: ${path.basename(outputFile)}`);
	console.log(`✨ Done!\n`);
	
	return output;
}

module.exports = {
	fetchNativeTokenSnapshot
};
