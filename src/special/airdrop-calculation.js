const path = require("path");
const fs = require("fs");
const { createPublicClient, http } = require('viem');
const { getRule } = require('./rules');

const DARWINIA_RPC_URL = 'https://rpc.darwinia.network';
const TREASURY_ADDRESS = '0xC665138b8AC77086af08d83cfc6410501624FFAa';

const DISTRIBUTION_PERCENTAGES = {
	crab_group: "0.60",
	ckton_group: "0.20",
	evolution_land: "0.15",
	reserve: "0.05"
};

async function fetchTreasuryBalance() {
	const client = createPublicClient({
		transport: http(DARWINIA_RPC_URL)
	});

	const balance = await client.getBalance({
		address: TREASURY_ADDRESS
	});

	return balance.toString();
}

function buildDistribution(totalTreasury) {
	// Calculate allocations from the on-chain treasury balance.
	const total = BigInt(totalTreasury);

	const reserve = (total * 5n) / 100n;
	const evolutionLand = (total * 15n) / 100n;
	const cktonGroup = (total * 20n) / 100n;
	const crabGroup = total - reserve - evolutionLand - cktonGroup;

	return {
		crab_group: {
			percentage: DISTRIBUTION_PERCENTAGES.crab_group,
			allocation: crabGroup.toString()
		},
		ckton_group: {
			percentage: DISTRIBUTION_PERCENTAGES.ckton_group,
			allocation: cktonGroup.toString()
		},
		evolution_land: {
			percentage: DISTRIBUTION_PERCENTAGES.evolution_land,
			allocation: evolutionLand.toString()
		},
		reserve: {
			percentage: DISTRIBUTION_PERCENTAGES.reserve,
			allocation: reserve.toString(),
			recipient: TREASURY_ADDRESS
		}
	};
}

async function calculateAirdrop(outputDir, config = {}) {
	const totalTreasury = await fetchTreasuryBalance();
	const distribution = buildDistribution(totalTreasury);

	console.log(`\n💰 Airdrop Calculation`);
	console.log(`📍 Crab Network`);
	console.log(`💵 Total Treasury: ${totalTreasury} RING\n`);

	const outputPath = path.resolve(outputDir);
	if (!fs.existsSync(outputPath)) {
		fs.mkdirSync(outputPath, { recursive: true });
	}

	const rules = [
		{
			name: 'evolution_land',
			enabled: config.enableEvolutionLand !== false,
			allocation: distribution.evolution_land.allocation
		},
		{
			name: 'ckton_group',
			enabled: config.enableCktonGroup !== false,
			allocation: distribution.ckton_group.allocation
		},
		{
			name: 'crab_group',
			enabled: config.enableCrabGroup !== false,
			allocation: distribution.crab_group.allocation
		}
	];

	const ruleResults = {};
	const allRecipients = new Map();

	for (const ruleConfig of rules) {
		if (!ruleConfig.enabled) {
			console.log(`⏭️  Skipping ${ruleConfig.name}`);
			continue;
		}

		const RuleClass = getRule(ruleConfig.name, {
			allocation: ruleConfig.allocation,
			totalTreasury: totalTreasury
		});

		const result = await RuleClass.calculate(allRecipients, {
			existingRecipients: allRecipients
		});

		ruleResults[ruleConfig.name] = result;

		for (const [address, data] of Object.entries(result.airdropPerAddress)) {
			const existing = allRecipients.get(address) || {
				address,
				is_contract: data.isContract || false,
				breakdown: {},
				total_airdrop: "0",
				total_airdrop_decimal: "0"
			};

			existing.breakdown[ruleConfig.name] = buildBreakdown(ruleConfig.name, result, address);
			existing.total_airdrop = (BigInt(existing.total_airdrop) + BigInt(data.amount)).toString();
			existing.total_airdrop_decimal = formatTokenAmount(existing.total_airdrop, 18);
			allRecipients.set(address, existing);
		}
	}

	const rulesApplied = rules
		.filter(r => r.enabled)
		.map(r => getRule(r.name).getMetadata());

	const statistics = buildStatistics(allRecipients, ruleResults);

	const sortedRecipients = Array.from(allRecipients.values()).sort((a, b) => {
		const amountA = BigInt(a.total_airdrop || '0');
		const amountB = BigInt(b.total_airdrop || '0');
		if (amountA > amountB) return -1;
		if (amountA < amountB) return 1;
		return 0;
	});

	const output = {
		timestamp: new Date().toISOString(),
		snapshot_height: config.snapshotHeight || null,
		total_airdrop_treasury: totalTreasury,
		treasury_address: TREASURY_ADDRESS,
		distribution: distribution,
		rules_applied: rulesApplied,
		statistics: statistics,
		recipients: Object.fromEntries(sortedRecipients.map((entry) => [entry.address, entry]))
	};

	const outputFile = path.join(outputPath, 'crab_sunset_airdrop_distribution.json');
	fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));

	console.log(`\n✅ Airdrop calculation complete!`);
	console.log(`📊 Total recipients: ${statistics.total_recipients}`);
	console.log(`💾 Saved to: ${path.basename(outputFile)}`);

	return {
		outputFile,
		statistics: statistics
	};
}

function formatTokenAmount(amount, decimals = 18) {
	const value = BigInt(amount || '0');
	const scale = 10n ** BigInt(decimals);
	const integerPart = value / scale;
	const fractionalPart = value % scale;
	const fractional = fractionalPart.toString().padStart(decimals, '0').replace(/0+$/, '');

	return fractional.length > 0 ? `${integerPart}.${fractional}` : integerPart.toString();
}

function buildBreakdown(ruleName, result, address) {
	const data = result.airdropPerAddress[address];
	const details = {
		rule_name: ruleName,
		description: result.description,
		total_supply: result.totalSupply,
		proportion: data.proportion,
		airdrop_amount: data.amount
	};

	if (ruleName === 'crab_group') {
		const raw = result.rawBalances;
		details.crab_balance = raw.crab[address] || "0";
		details.wcrab_balance = raw.wcrab[address] || "0";
		details.gcrab_balance = raw.gcrab[address] || "0";
		details.wcring_balance = raw.wcring[address] || "0";
		details.xwcrab_balance = raw.xwcrab[address] || "0";
		details.virtual_crab_balance = raw.virtual_crab[address] || "0";
		details.virtual_wcrab_balance = raw.virtual_wcrab[address] || "0";
		details.virtual_gcrab_balance = raw.virtual_gcrab[address] || "0";
		details.virtual_xwcrab_balance = raw.virtual_xwcrab[address] || "0";
		details.virtual_wcring_balance = raw.virtual_wcring[address] || "0";
		details.crab_staking_rewards = raw.crab_staking_rewards[address] || "0";
		details.ckton_staking_rewards = raw.ckton_staking_rewards[address] || "0";
		details.crab_deposit_balance = raw.crab_deposit_balance[address] || "0";
		details.total_group_balance = (
			BigInt(details.crab_balance) +
			BigInt(details.wcrab_balance) +
			BigInt(details.gcrab_balance) +
			BigInt(details.wcring_balance) +
			BigInt(details.xwcrab_balance) +
			BigInt(details.virtual_crab_balance) +
			BigInt(details.virtual_wcrab_balance) +
			BigInt(details.virtual_gcrab_balance) +
			BigInt(details.virtual_xwcrab_balance) +
			BigInt(details.virtual_wcring_balance) +
			BigInt(details.crab_staking_rewards) +
			BigInt(details.ckton_staking_rewards) +
			BigInt(details.crab_deposit_balance)
		).toString();
	}

	if (ruleName === 'ckton_group') {
		const raw = result.rawBalances;
		details.ckton_balance = raw.ckton[address] || "0";
		details.wckton_balance = raw.wckton[address] || "0";
		details.gckton_balance = raw.gckton[address] || "0";
		details.virtual_ckton_balance = raw.virtual_ckton[address] || "0";
		details.virtual_wckton_balance = raw.virtual_wckton[address] || "0";
		details.virtual_gckton_balance = raw.virtual_gckton[address] || "0";
		details.total_group_balance = (
			BigInt(details.ckton_balance) +
			BigInt(details.wckton_balance) +
			BigInt(details.gckton_balance) +
			BigInt(details.virtual_ckton_balance) +
			BigInt(details.virtual_wckton_balance) +
			BigInt(details.virtual_gckton_balance)
		).toString();
	}

	if (ruleName === 'evolution_land') {
		details.land_allocations = result.landAllocations || {};
		details.land_supplies = result.componentSupplies || {};
		details.land_breakdown = data.lands || {};
	}

	return details;
}

function buildStatistics(recipients, ruleResults) {
	let totalAirdrop = "0";
	let eoaCount = 0;
	let contractCount = 0;
	let eoaMax = 0n;
	const eoaRecipients = [];

	for (const recipient of recipients.values()) {
		totalAirdrop = (BigInt(totalAirdrop) + BigInt(recipient.total_airdrop)).toString();
		if (recipient.is_contract) {
			contractCount++;
		} else {
			eoaCount++;
			const amount = BigInt(recipient.total_airdrop || '0');
			if (amount > eoaMax) {
				eoaMax = amount;
			}
			eoaRecipients.push({
				address: recipient.address,
				total_airdrop: recipient.total_airdrop,
				total_airdrop_decimal: recipient.total_airdrop_decimal
			});
		}
	}

	const topRecipients = eoaRecipients
		.sort((a, b) => {
			const amountA = BigInt(a.total_airdrop || '0');
			const amountB = BigInt(b.total_airdrop || '0');
			if (amountA > amountB) return -1;
			if (amountA < amountB) return 1;
			return 0;
		})
		.slice(0, 20);

	const statistics = {
		total_recipients: recipients.size,
		eoa_recipients: eoaCount,
		contract_recipients: contractCount,
		total_airdrop_distributed: totalAirdrop,
		eoa_airdrop_max: eoaMax.toString(),
		eoa_airdrop_max_decimal: formatTokenAmount(eoaMax.toString(), 18),
		top_20_recipients: topRecipients,
		rule_details: {}
	};

	for (const [ruleName, result] of Object.entries(ruleResults)) {
		statistics.rule_details[ruleName] = {
			total_supply: result.totalSupply,
			allocation: result.allocation,
			allocation_percentage: result.allocationPercentage,
			component_supplies: result.componentSupplies,
			recipient_count: Object.keys(result.airdropPerAddress).length
		};
	}

	return statistics;
}

module.exports = {
	calculateAirdrop,
	DISTRIBUTION_PERCENTAGES,
	TREASURY_ADDRESS,
	DARWINIA_RPC_URL
};
