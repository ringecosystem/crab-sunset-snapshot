const { fetchTokenHolders, isSmartContract } = require('./api');
const { saveCache } = require('./cache');

async function fetchAllHolders(contractAddress, offset = 100) {
	let page = 1;
	let hasMore = true;
	const allHolders = {};

	while (hasMore) {
		try {
			const results = await fetchTokenHolders(contractAddress, page, offset);

			// Check if there is data
			if (!Array.isArray(results) || results.length === 0) {
				hasMore = false;
				break;
			}

			// Collect holder data
			results.forEach((item) => {
				allHolders[item.address] = parseFloat(item.value);
			});

			process.stdout.write(`\rFetching holders: ${Object.keys(allHolders).length} found (page ${page})...`);

			page++;

			// Simple rate limiting to avoid requests being too fast
			await new Promise((r) => setTimeout(r, 200));
		} catch (error) {
			console.error(`❌ Error on page ${page}:`, error.message);
			break;
		}
	}

	process.stdout.write(`\n`);
	console.log(`✅ Fetched ${Object.keys(allHolders).length} holders`);
	return allHolders;
}

async function separateHoldersByType(allHolders, addressCache) {
	const contractHolders = {};
	const eoaHolders = {};
	
	const addresses = Object.keys(allHolders);
	let checkedCount = 0;
	let cacheHits = 0;
	let apiCalls = 0;
	
	for (const address of addresses) {
		const wasCached = address in addressCache;
		const isContract = await isSmartContract(address, addressCache);
		
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
	saveCache(addressCache);
	
	process.stdout.write(`\n`);
	console.log(`✅ Contracts: ${Object.keys(contractHolders).length}, EOAs: ${Object.keys(eoaHolders).length} (cache: ${cacheHits}, API: ${apiCalls})`);

	return { contractHolders, eoaHolders };
}

module.exports = {
	fetchAllHolders,
	separateHoldersByType
};
