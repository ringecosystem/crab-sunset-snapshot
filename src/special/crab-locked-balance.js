const fs = require('fs');
const path = require('path');
const { ApiPromise, WsProvider, HttpProvider } = require('@polkadot/api');

const RPC_HTTP_URL = 'https://crab-rpc.darwinia.network';
const RPC_WS_URL = 'wss://crab-rpc.darwinia.network';
const OUTPUT_FILENAME = 'CRAB_locked.json';

const EXCLUDED_ADDRESSES = new Set([
	'0xb633ad1142941ca2eb9c350579cf88bbe266660d',
	'0x6d6f646c64612f74727372790000000000000000'
]);

function loadJson(outputDir, filename) {
	const filePath = path.join(path.resolve(outputDir), filename);
	return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadLpTokenAddresses(outputDir) {
	const lpFile = path.join(path.resolve(outputDir), 'snow_lps_crab.json');
	if (!fs.existsSync(lpFile)) {
		return new Set();
	}

	try {
		const data = JSON.parse(fs.readFileSync(lpFile, 'utf8'));
		const list = (data.snow_lps || [])
			.map((lp) => (lp.address || '').toLowerCase())
			.filter(Boolean);
		return new Set(list);
	} catch (err) {
		console.warn(`⚠️  Failed to load snow_lps_crab.json: ${err.message}`);
		return new Set();
	}
}

function normalizeAddress(address) {
	return (address || '').split(' (')[0].toLowerCase();
}

function buildIncludedAccounts(outputDir) {
	const native = loadJson(outputDir, 'CRAB_native.json');
	const lpTokens = loadLpTokenAddresses(outputDir);

	const accounts = [];
	for (const address of Object.keys(native.eoa_holders || {})) {
		const normalized = normalizeAddress(address);
		if (!normalized) {
			continue;
		}
		if (EXCLUDED_ADDRESSES.has(normalized)) {
			continue;
		}
		if (lpTokens.has(normalized)) {
			continue;
		}
		accounts.push(normalized);
	}

	return accounts;
}

async function connectApi() {
	try {
		const provider = new WsProvider(RPC_WS_URL);
		const api = await ApiPromise.create({ provider });
		await api.isReady;
		return { api, rpcUrl: RPC_WS_URL };
	} catch (err) {
		console.warn(`⚠️  WS provider failed (${RPC_WS_URL}): ${err.message}`);
		console.warn(`ℹ️  Falling back to HTTP provider (${RPC_HTTP_URL})`);
		const provider = new HttpProvider(RPC_HTTP_URL);
		const api = await ApiPromise.create({ provider });
		await api.isReady;
		return { api, rpcUrl: RPC_HTTP_URL };
	}
}

function sumLocks(locks) {
	let total = 0n;
	for (const lock of locks || []) {
		const amount = lock.amount ? BigInt(lock.amount.toString()) : 0n;
		total += amount;
	}
	return total;
}

async function fetchLockedBalancesBatch(api, accounts) {
	const queries = accounts.map((account) => [api.query.balances.locks, account]);
	const results = await api.queryMulti(queries);
	return results.map((locks) => sumLocks(locks).toString());
}

async function fetchCrabLockedBalanceSnapshot(outputDir) {
	console.log('\n📊 CRAB Locked Balance Snapshot');
	console.log('📍 Crab Network (Substrate)');

	const accounts = buildIncludedAccounts(outputDir);
	console.log(`📊 Fetching locked balances for ${accounts.length} EOA accounts...`);

	const { api, rpcUrl } = await connectApi();
	let snapshotBlock = null;
	try {
		snapshotBlock = (await api.rpc.chain.getHeader()).number.toString();
	} catch (err) {
		console.warn(`⚠️  Failed to fetch snapshot block: ${err.message}`);
	}

	const lockedBalances = {};
	let totalLocked = 0n;

	const BATCH_SIZE = 50;
	for (let offset = 0; offset < accounts.length; offset += BATCH_SIZE) {
		const batch = accounts.slice(offset, offset + BATCH_SIZE);
		let balances = null;

		try {
			balances = await fetchLockedBalancesBatch(api, batch);
		} catch (err) {
			console.warn(`⚠️  Batch query failed at offset=${offset}: ${err.message}`);
			console.warn('ℹ️  Falling back to per-account queries for this batch');
			balances = [];
			for (const account of batch) {
				try {
					const locks = await api.query.balances.locks(account);
					balances.push(sumLocks(locks).toString());
				} catch (innerErr) {
					console.warn(`⚠️  Failed locks query for ${account}: ${innerErr.message}`);
					balances.push('0');
				}
			}
		}

		for (let i = 0; i < batch.length; i++) {
			const account = batch[i];
			const locked = balances[i] || '0';

			const lockedBigInt = BigInt(locked || '0');
			if (lockedBigInt > 0n) {
				lockedBalances[account] = locked;
				totalLocked += lockedBigInt;
			}
		}

		const done = Math.min(offset + batch.length, accounts.length);
		process.stdout.write(`\rLocked queries: ${done}/${accounts.length}`);
		await new Promise((r) => setTimeout(r, 150));
	}

	process.stdout.write('\n');
	await api.disconnect();

	const outputPath = path.resolve(outputDir);
	if (!fs.existsSync(outputPath)) {
		fs.mkdirSync(outputPath, { recursive: true });
	}

	const output = {
		timestamp: new Date().toISOString(),
		rpc_url: rpcUrl,
		snapshot_block: snapshotBlock,
		holders_count: Object.keys(lockedBalances).length,
		total_locked_balance: totalLocked.toString(),
		locked_balances: lockedBalances
	};

	const outputFile = path.join(outputPath, OUTPUT_FILENAME);
	fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));

	console.log(`💾 Saved: ${path.basename(outputFile)}`);
	console.log('✨ Done!\n');

	return output;
}

module.exports = {
	fetchCrabLockedBalanceSnapshot
};
