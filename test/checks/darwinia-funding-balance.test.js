const https = require('https');
const { loadJson } = require('../helpers/data');

const RPC_URL = 'https://rpc.darwinia.network';
const RING_TOKEN = '0xE7578598Aac020abFB918f33A20faD5B71d670b4';
const FUNDING_ACCOUNT = '0xa64D1c284280b22f921E7B2A55040C7bbfD4d9d0';

function sumBalances(holders) {
	return Object.values(holders || {}).reduce((sum, balance) => {
		return sum + BigInt(balance || '0');
	}, 0n);
}

function pow10(exp) {
	return 10n ** BigInt(exp);
}

function normalizeBalance(balance, fromDecimals, toDecimals) {
	const value = BigInt(balance || '0');
	if (fromDecimals === toDecimals) {
		return value;
	}
	if (fromDecimals < toDecimals) {
		return value * pow10(toDecimals - fromDecimals);
	}
	return value / pow10(fromDecimals - toDecimals);
}

function requestRpc(body) {
	return new Promise((resolve, reject) => {
		const data = JSON.stringify(body);
		const request = https.request(
			RPC_URL,
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

async function fetchTokenDecimals() {
	const response = await requestRpc({
		jsonrpc: '2.0',
		id: 1,
		method: 'eth_call',
		params: [
			{
				to: RING_TOKEN,
				data: '0x313ce567'
			},
			'latest'
		]
	});

	if (response.error) {
		throw new Error(`RPC decimals error: ${response.error.message}`);
	}
	if (!response.result) {
		throw new Error('Missing decimals result from RPC');
	}

	return Number(BigInt(response.result));
}

async function fetchTokenBalance(address) {
	const normalized = address.toLowerCase().replace(/^0x/, '');
	const data = `0x70a08231${normalized.padStart(64, '0')}`;
	const response = await requestRpc({
		jsonrpc: '2.0',
		id: 2,
		method: 'eth_call',
		params: [
			{
				to: RING_TOKEN,
				data
			},
			'latest'
		]
	});

	if (response.error) {
		throw new Error(`RPC balance error: ${response.error.message}`);
	}
	if (!response.result) {
		throw new Error('Missing balance result from RPC');
	}

	return BigInt(response.result);
}

jest.setTimeout(20000);

test('Darwinia funding account covers xRING + xWRING airdrop', async () => {
	const xring = loadJson('xRING_0x7399Ea6C9d35124d893B8d9808930e9d3F211501.json');
	const xwring = loadJson('xWRING_0x273131F7CB50ac002BDd08cA721988731F7e1092.json');

	const tokenDecimals = await fetchTokenDecimals();
	const xringSupply = normalizeBalance(
		sumBalances(xring.eoa_holders || {}),
		Number(xring.decimals || 0),
		tokenDecimals
	);
	const xwringSupply = normalizeBalance(
		sumBalances(xwring.eoa_holders || {}),
		Number(xwring.decimals || 0),
		tokenDecimals
	);
	const requiredAirdrop = xringSupply + xwringSupply;
	const fundingBalance = await fetchTokenBalance(FUNDING_ACCOUNT);

	expect(fundingBalance >= requiredAirdrop).toBe(true);
});
