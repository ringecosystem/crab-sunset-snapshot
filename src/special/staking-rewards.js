const fs = require('fs');
const path = require('path');
const { createPublicClient, http } = require('viem');

const GRAPH_URL = 'https://thegraph.darwinia.network/dip7/subgraphs/name/dip7index-crab';
const RPC_URL = 'https://crab-rpc.darwinia.network';
const OUTPUT_FILENAME = 'CRAB_staking_rewards.json';
const PAGE_SIZE = 1000;

const EARNED_ABI = [
	{
		name: 'earned',
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
	console.log('📊 Fetching staking events from The Graph...');
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

function buildUniquePairs(stakeds) {
	const pairs = new Map();
	for (const record of stakeds) {
		if (!record.pool || !record.account) {
			continue;
		}

		const pool = record.pool.toLowerCase();
		const account = record.account.toLowerCase();
		const key = `${pool}-${account}`;
		if (!pairs.has(key)) {
			pairs.set(key, { pool, account });
		}
	}

	return Array.from(pairs.values());
}

async function fetchRewardsSnapshot() {
	const stakeds = await fetchAllStakeds();
	const uniquePairs = buildUniquePairs(stakeds);

	console.log(`📊 Fetching unclaimed rewards for ${uniquePairs.length} pairs...`);

	const client = createPublicClient({
		transport: http(RPC_URL)
	});

	const snapshotBlock = await client.getBlockNumber();
	const rewards = [];

	for (let i = 0; i < uniquePairs.length; i++) {
		const pair = uniquePairs[i];

		try {
			const reward = await client.readContract({
				address: pair.pool,
				abi: EARNED_ABI,
				functionName: 'earned',
				args: [pair.account],
				blockNumber: snapshotBlock
			});

			rewards.push({
				pool: pair.pool,
				account: pair.account,
				reward: reward.toString()
			});
		} catch (error) {
			console.warn(`⚠️  Failed reward query for ${pair.account} @ ${pair.pool}: ${error.message}`);
			rewards.push({
				pool: pair.pool,
				account: pair.account,
				reward: '0',
				error: error.message
			});
		}

		if ((i + 1) % 10 === 0 || i + 1 === uniquePairs.length) {
			process.stdout.write(`\rReward queries: ${i + 1}/${uniquePairs.length}`);
		}

		await new Promise((r) => setTimeout(r, 200));
	}

	process.stdout.write('\n');

	const nonZeroRewards = rewards.filter((entry) => entry.reward !== '0');
	const zeroRewards = rewards.filter((entry) => entry.reward === '0');

	nonZeroRewards.sort((a, b) => {
		const rewardA = BigInt(a.reward);
		const rewardB = BigInt(b.reward);
		if (rewardA > rewardB) return -1;
		if (rewardA < rewardB) return 1;
		return 0;
	});

	const sortedRewards = nonZeroRewards.concat(zeroRewards);

	return {
		timestamp: new Date().toISOString(),
		rpc_url: RPC_URL,
		snapshot_block: snapshotBlock.toString(),
		staked_events_count: stakeds.length,
		reward_pairs_count: uniquePairs.length,
		non_zero_rewards_count: nonZeroRewards.length,
		zero_rewards_count: zeroRewards.length,
		staked_events: stakeds,
		rewards: sortedRewards
	};
}

async function fetchStakingRewardsSnapshot(outputDir) {
	console.log('\n📊 Staking Rewards Snapshot');
	console.log('📍 Crab Network');

	const output = await fetchRewardsSnapshot();

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
	fetchStakingRewardsSnapshot
};
