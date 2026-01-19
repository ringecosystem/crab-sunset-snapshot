const fs = require('fs');
const path = require('path');
const { createPublicClient, http, isAddress } = require('viem');

const CACHE_FILENAME = 'eoa-verified-cache.json';
const CRAB_RPC_URL = 'https://crab-rpc.darwinia.network';
const DARWINIA_RPC_URL = 'https://rpc.darwinia.network';

const FORCED_CONTRACT_ADDRESSES = new Set([
	// Special system contracts without code (treat as contracts)
	'0x000000000f681d85374225edeeadc25560c1fb3f',
	'0x0000000000000000000000000000000000000000',
	'0x000000000419683a1a03abc21fc9da25fd2b4dd7',
	'0x7369626cd0070000000000000000000000000000',
	'0x0000000000000000000000000000000000000201',
	'0x0000000000000000000000000000000000000101',
	'0x0000000000000000000000000000000000000019',
	'0x0000000000000000000000000000000000000100',
	'0x0000000000000000000000000000000000000200',
	'0x00000005a796df0489b6f16120e9a72bbc954c96'
]);

function getCacheFilePath() {
	return path.join(__dirname, '..', '..', 'data', CACHE_FILENAME);
}

function loadCache() {
	const cacheFile = getCacheFilePath();
	try {
		if (fs.existsSync(cacheFile)) {
			return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
		}
	} catch (error) {
		console.warn(`⚠️  Failed to load ${CACHE_FILENAME}: ${error.message}`);
	}
	return {};
}

function saveCache(cache) {
	const cacheFile = getCacheFilePath();
	try {
		fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2));
	} catch (error) {
		console.warn(`⚠️  Failed to save ${CACHE_FILENAME}: ${error.message}`);
	}
}

function normalizeAddress(address) {
	return (address || '').split(' (')[0].toLowerCase();
}

function isEmptyCode(code) {
	const normalized = (code || '0x').toLowerCase();
	return normalized === '0x' || normalized === '0x0';
}

function createClients() {
	return {
		crab: createPublicClient({ transport: http(CRAB_RPC_URL) }),
		darwinia: createPublicClient({ transport: http(DARWINIA_RPC_URL) })
	};
}

async function fetchHasCode(client, address) {
	const bytecode = await client.getBytecode({ address });
	return !isEmptyCode(bytecode);
}

async function verifyAddressStatus(address, clients, attempts = 3) {
	const normalized = normalizeAddress(address);
	if (!normalized) {
		return { address: normalized, status: 'contract', reason: 'empty' };
	}
	if (!isAddress(normalized)) {
		return { address: normalized, status: 'contract', reason: 'invalid' };
	}
	if (FORCED_CONTRACT_ADDRESSES.has(normalized)) {
		return { address: normalized, status: 'contract', reason: 'forced' };
	}

	let lastError = null;
	for (let i = 0; i < attempts; i++) {
		try {
			const [hasCodeCrab, hasCodeDarwinia] = await Promise.all([
				fetchHasCode(clients.crab, normalized),
				fetchHasCode(clients.darwinia, normalized)
			]);
			const status = hasCodeCrab || hasCodeDarwinia ? 'contract' : 'eoa';
			return { address: normalized, status };
		} catch (error) {
			lastError = error;
			await new Promise((r) => setTimeout(r, 250 * (2 ** i)));
		}
	}

	throw lastError;
}

async function mapWithConcurrency(items, concurrency, fn) {
	const results = new Array(items.length);
	let index = 0;

	async function worker() {
		while (true) {
			const current = index;
			index += 1;
			if (current >= items.length) {
				break;
			}
			results[current] = await fn(items[current], current);
		}
	}

	const workers = [];
	for (let i = 0; i < concurrency; i++) {
		workers.push(worker());
	}

	await Promise.all(workers);
	return results;
}

async function ensureStatuses(addresses, options = {}) {
	const concurrency = Number.isFinite(options.concurrency) ? options.concurrency : 10;
	const cache = loadCache();
	const clients = createClients();

	const normalized = addresses
		.map((a) => normalizeAddress(a))
		.filter(Boolean);

	const unique = Array.from(new Set(normalized));
	const toCheck = unique.filter((addr) => cache[addr] !== 'eoa' && cache[addr] !== 'contract');

	if (toCheck.length === 0) {
		return cache;
	}

	process.stdout.write(`\rEOA verify (both chains): 0/${toCheck.length}`);

	await mapWithConcurrency(toCheck, concurrency, async (addr, i) => {
		const result = await verifyAddressStatus(addr, clients);
		cache[result.address] = result.status;

		if ((i + 1) % 50 === 0 || i + 1 === toCheck.length) {
			process.stdout.write(`\rEOA verify (both chains): ${i + 1}/${toCheck.length}`);
		}

		await new Promise((r) => setTimeout(r, 20));
	});

	process.stdout.write('\n');
	saveCache(cache);
	return cache;
}

async function filterBalancesByVerifiedEoa(balances, options = {}) {
	const entries = Object.entries(balances || {});
	const addresses = entries.map(([address]) => address);
	const cache = await ensureStatuses(addresses, options);

	const filtered = {};
	for (const [address, balance] of entries) {
		const normalized = normalizeAddress(address);
		if (!normalized) {
			continue;
		}
		if (cache[normalized] !== 'eoa') {
			continue;
		}
		filtered[normalized] = balance;
	}

	return filtered;
}

async function filterManyBalanceMapsByVerifiedEoa(balanceMaps, options = {}) {
	const maps = balanceMaps || {};
	const allAddresses = [];
	for (const holders of Object.values(maps)) {
		for (const address of Object.keys(holders || {})) {
			allAddresses.push(address);
		}
	}

	const cache = await ensureStatuses(allAddresses, options);
	const filteredMaps = {};
	for (const [name, holders] of Object.entries(maps)) {
		const filtered = {};
		for (const [address, balance] of Object.entries(holders || {})) {
			const normalized = normalizeAddress(address);
			if (!normalized) {
				continue;
			}
			if (cache[normalized] !== 'eoa') {
				continue;
			}
			filtered[normalized] = balance;
		}
		filteredMaps[name] = filtered;
	}

	return { cache, filteredMaps };
}

module.exports = {
	CACHE_FILENAME,
	CRAB_RPC_URL,
	DARWINIA_RPC_URL,
	FORCED_CONTRACT_ADDRESSES,
	loadCache,
	saveCache,
	normalizeAddress,
	ensureStatuses,
	filterBalancesByVerifiedEoa,
	filterManyBalanceMapsByVerifiedEoa
};
