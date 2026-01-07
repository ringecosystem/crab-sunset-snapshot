const path = require("path");

class BaseHolders {
	constructor(api, cacheManager) {
		this.api = api;
		this.cacheManager = cacheManager;
	}

	async fetchAllHolders(contractAddress, offset = 100) {
		let page = 1;
		let hasMore = true;
		const allHolders = {};

		while (hasMore) {
			try {
				const results = await this.api.fetchTokenHolders(contractAddress, page, offset);

				if (!Array.isArray(results) || results.length === 0) {
					hasMore = false;
					break;
				}

				results.forEach((item) => {
					allHolders[item.address] = item.value;
				});

				process.stdout.write(`\rFetching holders: ${Object.keys(allHolders).length} found (page ${page})...`);

				page++;

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

	async separateHoldersByType(allHolders, addressCache) {
		const contractHolders = {};
		const eoaHolders = {};
		
		const addresses = Object.keys(allHolders);
		let checkedCount = 0;
		let cacheHits = 0;
		let apiCalls = 0;
		
		for (const address of addresses) {
			const wasCached = address in addressCache;
			const isContract = await this.api.isSmartContract(address, addressCache);
			
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
			
			if (!wasCached) {
				await new Promise((r) => setTimeout(r, 100));
			}
		}
		
		this.cacheManager.save(addressCache);
		
		process.stdout.write(`\n`);
		console.log(`✅ Contracts: ${Object.keys(contractHolders).length}, EOAs: ${Object.keys(eoaHolders).length} (cache: ${cacheHits}, API: ${apiCalls})`);

		return { contractHolders, eoaHolders };
	}

	sortHoldersByBalance(holders) {
		const sorted = Object.entries(holders).sort((a, b) => {
			const balA = BigInt(a[1]);
			const balB = BigInt(b[1]);
			if (balA > balB) return -1;
			if (balA < balB) return 1;
			return 0;
		});
		return Object.fromEntries(sorted);
	}
}

module.exports = BaseHolders;
