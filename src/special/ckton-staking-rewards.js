const fs = require('fs');
const path = require('path');
const { createPublicClient, http, parseAbiItem } = require('viem');

const RPC_URL = 'https://crab-rpc.darwinia.network';
const OUTPUT_FILENAME = 'CKTON_staking_rewards.json';
const CONTRACT_ADDRESS = '0x000000000419683a1a03AbC21FC9da25fd2B4dD7';

const STAKED_EVENT = parseAbiItem('event Staked(address indexed user, uint256 amount)');
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

async function fetchStakedEvents(client) {
	console.log('📊 Fetching CKTON Staked events from RPC...');
	const logs = await client.getLogs({
		address: CONTRACT_ADDRESS,
		event: STAKED_EVENT,
		fromBlock: 0n,
		toBlock: 'latest'
	});

	console.log(`✅ Fetched ${logs.length} staked events`);
	return logs.map((log) => ({
		user: (log.args?.user || '').toLowerCase(),
		amount: log.args?.amount ? log.args.amount.toString() : '0',
		blockNumber: log.blockNumber ? log.blockNumber.toString() : null,
		transactionHash: log.transactionHash,
		logIndex: log.logIndex ? log.logIndex.toString() : null
	}));
}

function buildUniqueUsers(events) {
	const users = new Set();
	for (const event of events) {
		if (event.user) {
			users.add(event.user);
		}
	}

	return Array.from(users);
}

async function fetchRewardsSnapshot() {
	const client = createPublicClient({
		transport: http(RPC_URL)
	});

	const snapshotBlock = await client.getBlockNumber();
	const stakedEvents = await fetchStakedEvents(client);
	const users = buildUniqueUsers(stakedEvents);

	console.log(`📊 Fetching CKTON rewards for ${users.length} users...`);
	const rewards = [];

	for (let i = 0; i < users.length; i++) {
		const user = users[i];

		try {
			const reward = await client.readContract({
				address: CONTRACT_ADDRESS,
				abi: EARNED_ABI,
				functionName: 'earned',
				args: [user],
				blockNumber: snapshotBlock
			});

			rewards.push({
				contract: CONTRACT_ADDRESS.toLowerCase(),
				account: user,
				reward: reward.toString()
			});
		} catch (error) {
			console.warn(`⚠️  Failed reward query for ${user}: ${error.message}`);
			rewards.push({
				contract: CONTRACT_ADDRESS.toLowerCase(),
				account: user,
				reward: '0',
				error: error.message
			});
		}

		if ((i + 1) % 10 === 0 || i + 1 === users.length) {
			process.stdout.write(`\rReward queries: ${i + 1}/${users.length}`);
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
		contract_address: CONTRACT_ADDRESS.toLowerCase(),
		snapshot_block: snapshotBlock.toString(),
		staked_events_count: stakedEvents.length,
		reward_accounts_count: users.length,
		non_zero_rewards_count: nonZeroRewards.length,
		zero_rewards_count: zeroRewards.length,
		staked_events: stakedEvents,
		rewards: sortedRewards
	};
}

async function fetchCktonStakingRewardsSnapshot(outputDir) {
	console.log('\n📊 CKTON Staking Rewards Snapshot');
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
	fetchCktonStakingRewardsSnapshot
};
