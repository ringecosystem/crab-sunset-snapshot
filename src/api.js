const BASE_URL = "https://crab-scan.darwinia.network/api";

async function fetchTokenInfo(address) {
	try {
		const url = `${BASE_URL}/v2/tokens/${address}`;
		
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

async function fetchTokenHolders(contractAddress, page, offset) {
	const url = `${BASE_URL}?module=token&action=getTokenHolders&contractaddress=${contractAddress}&page=${page}&offset=${offset}`;
	
	const response = await fetch(url);
	if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
	
	const data = await response.json();
	return data.result;
}

async function isSmartContract(address, cache) {
	// Check cache first
	if (address in cache) {
		return cache[address];
	}
	
	try {
		const url = `${BASE_URL}/v2/smart-contracts/${address}`;
		const response = await fetch(url, {
			headers: {
				'Accept': 'application/json'
			}
		});
		
		// If we get a 200 response, it's a smart contract
		// If we get a 404 or other error, it's likely an EOA
		const isContract = response.ok;
		
		// Cache the result
		cache[address] = isContract;
		
		return isContract;
	} catch (error) {
		// On error, assume it's an EOA and cache it
		cache[address] = false;
		return false;
	}
}

module.exports = {
	fetchTokenInfo,
	fetchTokenHolders,
	isSmartContract
};
