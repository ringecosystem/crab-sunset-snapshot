class BaseAPI {
	constructor(baseUrl) {
		this.baseUrl = baseUrl;
	}

	async fetchTokenInfo(address) {
		try {
			const url = `${this.baseUrl}/v2/tokens/${address}`;
			
			const response = await fetch(url, {
				headers: {
					'Accept': 'application/json'
				}
			});
			
			if (!response.ok) {
				console.warn(`⚠️  Could not fetch token info: ${response.status}`);
				return null;
			}
			
			const tokenData = await response.json();
			return {
				name: tokenData.name || "Unknown",
				symbol: tokenData.symbol || "Unknown",
				decimals: parseInt(tokenData.decimals) || 18,
				total_supply: tokenData.total_supply || "0",
				holders_count: parseInt(tokenData.holders) || 0
			};
		} catch (error) {
			console.warn(`⚠️  Error fetching token info:`, error.message);
			return null;
		}
	}

	async fetchAddressTokens(address) {
		try {
			const url = `${this.baseUrl}/v2/addresses/${address}/tokens?type=ERC-20`;
			
			const response = await fetch(url, {
				headers: {
					'Accept': 'application/json'
				}
			});
			
			if (!response.ok) {
				console.warn(`⚠️  Could not fetch tokens for address ${address}: ${response.status}`);
				return [];
			}
			
			const data = await response.json();
			const items = data.items || [];
			
			// Transform to simpler format with only required fields
			return items.map(item => ({
				address: item.token.address,
				symbol: item.token.symbol || "Unknown",
				balance: item.value || "0"
			}));
		} catch (error) {
			console.warn(`⚠️  Error fetching tokens for address ${address}:`, error.message);
			return [];
		}
	}

	async fetchTokenHolders(contractAddress, page, offset) {
		const url = `${this.baseUrl}?module=token&action=getTokenHolders&contractaddress=${contractAddress}&page=${page}&offset=${offset}`;
		
		const response = await fetch(url);
		if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
		
		const data = await response.json();
		return data.result;
	}

	async isSmartContract(address, cache) {
		if (address in cache) {
			return cache[address];
		}
		
		try {
			const url = `${this.baseUrl}/v2/smart-contracts/${address}`;
			const response = await fetch(url, {
				headers: {
					'Accept': 'application/json'
				}
			});
			
			const isContract = response.ok;
			
			cache[address] = isContract;
			
			return isContract;
		} catch (error) {
			cache[address] = false;
			return false;
		}
	}
}

module.exports = BaseAPI;
