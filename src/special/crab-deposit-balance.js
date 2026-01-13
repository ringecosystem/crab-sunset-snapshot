const fs = require('fs');
const path = require('path');
const { createPublicClient, http } = require('viem');

const GRAPH_URL = 'https://thegraph.darwinia.network/dip7/subgraphs/name/dip7index-crab';
const RPC_URL = 'https://crab-rpc.darwinia.network';
const OUTPUT_FILENAME = 'CRAB_deposit_balance.json';
const PAGE_SIZE = 1000;
const HUB_ADDRESS = '0xa4ffac7a5da311d724ed47393848f694baee7930';

const BALANCE_OF_ABI = [
	{
		name: 'balanceOf',
		type: 'function',
		stateMutability: 'view',
		inputs: [
			{ name: 'user', type: 'address' }
		],
		outputs: [
			{ type: 'uint256' }
		]
	}
];

const DEPOSIT_ABI = [
	{
		name: 'tokenOfOwnerByIndex',
		type: 'function',
		stateMutability: 'view',
		inputs: [
			{ name: 'user', type: 'address' },
			{ name: 'index', type: 'uint256' }
		],
		outputs: [
			{ type: 'uint256' }
		]
	},
	{
		name: 'assetsOf',
		type: 'function',
		stateMutability: 'view',
		inputs: [
			{ name: 'tokenId', type: 'uint256' }
		],
		outputs: [
			{ type: 'uint256' }
		]
	}
];

const DEPOSIT_CONTRACT = '0x46275d29113f065c2aac262f34C7a3d8a8B7377D';

async function fetchStakedPage(skip) {
	const query = `query QueryStakeds {
		stakeds(first: ${PAGE_SIZE}, skip: ${skip}) {
			account
			pool
			assets
			id
			collator
			blockTimestamp
			blockNumber
			transactionHash
		}
	}`;

	const response = await fetch(GRAPH_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Accept': 'application/json'
		},
		body: JSON.stringify({
			query
		})
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`GraphQL HTTP Error: ${response.status} ${errorText}`);
	}

	const data = await response.json();
	if (data.errors && data.errors.length > 0) {
		throw new Error(data.errors[0].message || 'GraphQL error');
	}

	return data.data?.stakeds || [];
}

async function fetchAllStakeds() {
	console.log('📊 Fetching staked events from The Graph...');
	const allStakeds = [];
	let skip = 0;
	let page = 1;

	while (true) {
		const stakeds = await fetchStakedPage(skip);
		if (stakeds.length === 0) {
			break;
		}

		allStakeds.push(...stakeds);
		process.stdout.write(`\rFetching stakeds: ${allStakeds.length} found (page ${page})...`);

		skip += PAGE_SIZE;
		page += 1;

		await new Promise((r) => setTimeout(r, 200));
	}

	process.stdout.write('\n');
	console.log(`✅ Fetched ${allStakeds.length} staked events`);
	return allStakeds;
}

function buildUniqueUsers(stakeds) {
	const users = new Set();
	for (const record of stakeds) {
		if (!record.account) {
			continue;
		}

		const account = record.account.toLowerCase();
		if (account === HUB_ADDRESS) {
			continue;
		}

		users.add(account);
	}

	return Array.from(users);
}

async function fetchDepositBalanceSnapshot() {
	const stakeds = await fetchAllStakeds();
	const users = buildUniqueUsers(stakeds);

	console.log(`📊 Fetching CRAB deposit balances for ${users.length} users...`);

	const client = createPublicClient({
		transport: http(RPC_URL)
	});

	const snapshotBlock = await client.getBlockNumber();
	const balances = [];

	for (let i = 0; i < users.length; i++) {
		const user = users[i];

		try {
			const depositCount = await client.readContract({
				address: DEPOSIT_CONTRACT,
				abi: BALANCE_OF_ABI,
				functionName: 'balanceOf',
				args: [user],
				blockNumber: snapshotBlock
			});

			let totalBalance = BigInt(0);
			for (let index = 0n; index < depositCount; index++) {
				const tokenId = await client.readContract({
					address: DEPOSIT_CONTRACT,
					abi: DEPOSIT_ABI,
					functionName: 'tokenOfOwnerByIndex',
					args: [user, index],
					blockNumber: snapshotBlock
				});

				const crabBalance = await client.readContract({
					address: DEPOSIT_CONTRACT,
					abi: DEPOSIT_ABI,
					functionName: 'assetsOf',
					args: [tokenId],
					blockNumber: snapshotBlock
				});

				totalBalance += crabBalance;
			}

			balances.push({
				account: user,
				deposit_count: depositCount.toString(),
				total_balance: totalBalance.toString()
			});
		} catch (error) {
			console.warn(`⚠️  Failed deposit query for ${user}: ${error.message}`);
			balances.push({
				account: user,
				deposit_count: '0',
				total_balance: '0',
				error: error.message
			});
		}

		if ((i + 1) % 10 === 0 || i + 1 === users.length) {
			process.stdout.write(`\rDeposit queries: ${i + 1}/${users.length}`);
		}

		await new Promise((r) => setTimeout(r, 200));
	}

	process.stdout.write('\n');

	const nonZeroBalances = balances.filter((entry) => entry.total_balance !== '0');
	const zeroBalances = balances.filter((entry) => entry.total_balance === '0');

	nonZeroBalances.sort((a, b) => {
		const balanceA = BigInt(a.total_balance);
		const balanceB = BigInt(b.total_balance);
		if (balanceA > balanceB) return -1;
		if (balanceA < balanceB) return 1;
		return 0;
	});

	const sortedBalances = nonZeroBalances.concat(zeroBalances);
	const totalDepositBalance = sortedBalances.reduce((sum, entry) => {
		return sum + BigInt(entry.total_balance || '0');
	}, BigInt(0)).toString();

	return {
		timestamp: new Date().toISOString(),
		rpc_url: RPC_URL,
		deposit_contract: DEPOSIT_CONTRACT.toLowerCase(),
		snapshot_block: snapshotBlock.toString(),
		excluded_hub: HUB_ADDRESS,
		staked_events_count: stakeds.length,
		deposit_accounts_count: users.length,
		non_zero_balances_count: nonZeroBalances.length,
		zero_balances_count: zeroBalances.length,
		total_deposit_balance: totalDepositBalance,
		staked_events: stakeds,
		balances: sortedBalances
	};
}

async function fetchCrabDepositBalanceSnapshot(outputDir) {
	console.log('\n📊 CRAB Deposit Balance Snapshot');
	console.log('📍 Crab Network');

	const output = await fetchDepositBalanceSnapshot();

	const outputPath = path.resolve(outputDir);
	if (!fs.existsSync(outputPath)) {
		fs.mkdirSync(outputPath, { recursive: true });
	}

	const outputFile = path.join(outputPath, OUTPUT_FILENAME);
	fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));

	console.log(`💾 Saved: ${path.basename(outputFile)}`);
	console.log('✨ Done!\n');

	return output;
}

module.exports = {
	fetchCrabDepositBalanceSnapshot
};
