const fs = require('fs');
const path = require('path');
const https = require('https');
const { DATA_DIR } = require('../helpers/data');
const { warn, info } = require('../helpers/log');

const DARWINIA_RPC_URL = 'https://rpc.darwinia.network';
const CRAB_RPC_URL = 'https://crab-rpc.darwinia.network';
const CSV_FILES = [
	'safe_airdrop_part1.csv',
	'safe_airdrop_part2.csv'
];

function requestRpc(body, rpcUrl) {
	return new Promise((resolve, reject) => {
		const data = JSON.stringify(body);
		const request = https.request(
			rpcUrl,
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Content-Length': Buffer.byteLength(data)
				}
			},
			(response) => {
				let payload = '';
				response.on('data', (chunk) => {
					payload += chunk;
				});
				response.on('end', () => {
					try {
						resolve(JSON.parse(payload));
					} catch (error) {
						reject(error);
					}
				});
			}
		);

		request.on('error', reject);
		request.write(data);
		request.end();
	});
}

async function requestRpcWithRetry(body, rpcUrl, attempts = 3) {
	let lastError = null;
	for (let i = 0; i < attempts; i++) {
		try {
			return await requestRpc(body, rpcUrl);
		} catch (error) {
			lastError = error;
			await new Promise((r) => setTimeout(r, 250 * (2 ** i)));
		}
	}
	throw lastError;
}

async function fetchCode(address, rpcUrl) {
	const response = await requestRpcWithRetry({
		jsonrpc: '2.0',
		id: 1,
		method: 'eth_getCode',
		params: [address, 'latest']
	}, rpcUrl);

	if (response.error) {
		throw new Error(`RPC error for eth_getCode(${address}): ${response.error.message}`);
	}

	return response.result || '0x';
}

function parseCsvReceivers(filename) {
	const filePath = path.join(DATA_DIR, filename);
	if (!fs.existsSync(filePath)) {
		throw new Error(`Missing CSV file: ${filename}`);
	}

	const content = fs.readFileSync(filePath, 'utf8');
	const lines = content.split('\n').map((line) => line.trim()).filter(Boolean);
	if (lines.length === 0) {
		return [];
	}

	const header = lines[0];
	if (header !== 'token_address,receiver,amount') {
		throw new Error(`Unexpected CSV header in ${filename}: ${header}`);
	}

	const receivers = [];
	for (const line of lines.slice(1)) {
		const parts = line.split(',');
		if (parts.length < 3) {
			continue;
		}

		const receiver = (parts[1] || '').trim().toLowerCase();
		if (!receiver) {
			continue;
		}
		receivers.push(receiver);
	}

	return receivers;
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

jest.setTimeout(120000);

test('Safe CSV receivers are EOAs (eth_getCode)', async () => {
	const allReceivers = CSV_FILES.flatMap((file) => parseCsvReceivers(file));
	const receivers = Array.from(new Set(allReceivers));
	info(`Loaded CSV receivers=${receivers.length} (deduped) from=${allReceivers.length}`);

	const nonEoas = [];
	const CONCURRENCY = 10;

	await mapWithConcurrency(receivers, CONCURRENCY, async (address, i) => {
		const [darwiniaCode, crabCode] = await Promise.all([
			fetchCode(address, DARWINIA_RPC_URL),
			fetchCode(address, CRAB_RPC_URL)
		]);

		const darwiniaNormalized = (darwiniaCode || '0x').toLowerCase();
		const crabNormalized = (crabCode || '0x').toLowerCase();
		const darwiniaEmpty = darwiniaNormalized === '0x' || darwiniaNormalized === '0x0';
		const crabEmpty = crabNormalized === '0x' || crabNormalized === '0x0';

		if (!darwiniaEmpty || !crabEmpty) {
			warn(`Non-EOA receiver (has code): ${address} crabLen=${crabNormalized.length} darwiniaLen=${darwiniaNormalized.length}`);
			nonEoas.push(address);
		}

		if ((i + 1) % 50 === 0 || i + 1 === receivers.length) {
			process.stdout.write(`\rRPC eth_getCode checks: ${i + 1}/${receivers.length}`);
		}

		await new Promise((r) => setTimeout(r, 20));
	});

	process.stdout.write('\n');
	if (nonEoas.length > 0) {
		warn(`Found non-EOA receivers count=${nonEoas.length}`);
	}

	expect(nonEoas.length).toBe(0);
});
