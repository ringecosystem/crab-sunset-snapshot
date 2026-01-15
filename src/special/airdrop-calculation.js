const path = require("path");
const fs = require("fs");
const { createPublicClient, http } = require('viem');
const { getRule } = require('./rules');

const DARWINIA_RPC_URL = 'https://rpc.darwinia.network';
const TREASURY_ADDRESS = '0xC665138b8AC77086af08d83cfc6410501624FFAa';
const EXCLUDED_RECIPIENTS = new Set([
	'0xb633ad1142941ca2eb9c350579cf88bbe266660d',
	'0x6d6f646c64612f74727372790000000000000000'
]);

function loadLpTokenAddressesForExclusion() {
	const lpFile = path.join(path.resolve(__dirname, '..', '..'), 'data', 'snow_lps_crab.json');
	if (!fs.existsSync(lpFile)) {
		return [];
	}
	try {
		const data = JSON.parse(fs.readFileSync(lpFile, 'utf8'));
		return (data.snow_lps || []).map((lp) => (lp.address || '').toLowerCase()).filter(Boolean);
	} catch (err) {
		console.warn('⚠️  Failed to load LP addresses for exclusion', err.message);
		return [];
	}
}

function buildExcludedRecipients() {
	const set = new Set(EXCLUDED_RECIPIENTS);
	for (const addr of loadLpTokenAddressesForExclusion()) {
		set.add(addr);
	}
	return set;
}

function normalizeAddress(address) {
	const base = (address || '').split(' (')[0].toLowerCase();
	return base;
}

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
			allocation: crabGroup.toString(),
			allocation_with_decimal: formatTokenAmount(crabGroup.toString(), 18)
		},
		ckton_group: {
			percentage: DISTRIBUTION_PERCENTAGES.ckton_group,
			allocation: cktonGroup.toString(),
			allocation_with_decimal: formatTokenAmount(cktonGroup.toString(), 18)
		},
		evolution_land: {
			percentage: DISTRIBUTION_PERCENTAGES.evolution_land,
			allocation: evolutionLand.toString(),
			allocation_with_decimal: formatTokenAmount(evolutionLand.toString(), 18)
		},
		reserve: {
			percentage: DISTRIBUTION_PERCENTAGES.reserve,
			allocation: reserve.toString(),
			allocation_with_decimal: formatTokenAmount(reserve.toString(), 18),
			recipient: TREASURY_ADDRESS
		}
	};
}

async function calculateAirdrop(outputDir, config = {}) {
	const totalTreasury = await fetchTreasuryBalance();
	const distribution = buildDistribution(totalTreasury);
	const excludedRecipients = buildExcludedRecipients();

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
			const normalized = normalizeAddress(address);
			if (!normalized || excludedRecipients.has(normalized)) {
				continue;
			}

			const existing = allRecipients.get(normalized) || {
				address: normalized,
				breakdown: {},
				total_airdrop: "0",
				total_airdrop_decimal: "0"
			};

			existing.breakdown[ruleConfig.name] = buildBreakdown(ruleConfig.name, result, normalized);
			existing.total_airdrop = (BigInt(existing.total_airdrop) + BigInt(data.amount)).toString();
			existing.total_airdrop_decimal = formatTokenAmount(existing.total_airdrop, 18);
			allRecipients.set(normalized, existing);
		}
	}

	const rulesApplied = rules
		.filter((r) => r.enabled)
		.map((r) => {
			const metadata = getRule(r.name).getMetadata();
			const result = ruleResults[r.name];

			return {
				name: metadata.name,
				description: metadata.description,
				allocationPercentage: metadata.allocationPercentage,
				total_supply: result?.totalSupply || '0',
				components: metadata.components
			};
		});

	const statistics = buildStatistics(allRecipients, ruleResults, excludedRecipients);

	const sortedRecipients = Array.from(allRecipients.values()).sort((a, b) => {
		const amountA = BigInt(a.total_airdrop || '0');
		const amountB = BigInt(b.total_airdrop || '0');
		if (amountA > amountB) return -1;
		if (amountA < amountB) return 1;
		return 0;
	});

	const output = {
		timestamp: new Date().toISOString(),
		total_airdrop_treasury: totalTreasury,
		total_airdrop_treasury_with_decimal: formatTokenAmount(totalTreasury, 18),
		treasury_address: TREASURY_ADDRESS,
		distribution: distribution,
		rules_applied: rulesApplied,
		statistics: statistics,
		recipients: Object.fromEntries(sortedRecipients.map((entry) => [entry.address, entry]))
	};

	const outputFile = path.join(outputPath, 'airdrop_results.json');
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

function formatRatio(numerator, denominator, decimals = 18) {
	const denom = BigInt(denominator || '0');
	if (denom === 0n) {
		return '0';
	}

	const num = BigInt(numerator || '0');
	const scale = 10n ** BigInt(decimals);
	const scaled = (num * scale) / denom;
	const integerPart = scaled / scale;
	const fractionalPart = scaled % scale;
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

		const crabBalance = raw.crab[address] || '0';
		const wcrabBalance = raw.wcrab[address] || '0';
		const gcrabBalance = raw.gcrab[address] || '0';
		const wcringBalance = raw.wcring[address] || '0';
		const xwcrabBalance = raw.xwcrab[address] || '0';
		const virtualCrabBalance = raw.virtual_crab[address] || '0';
		const virtualWcrabBalance = raw.virtual_wcrab[address] || '0';
		const virtualGcrabBalance = raw.virtual_gcrab[address] || '0';
		const virtualXwcrabBalance = raw.virtual_xwcrab[address] || '0';
		const virtualWcringBalance = raw.virtual_wcring[address] || '0';
		const crabStakingRewards = raw.crab_staking_rewards[address] || '0';
		const cktonStakingRewards = raw.ckton_staking_rewards[address] || '0';
		const crabDepositBalance = raw.crab_deposit_balance[address] || '0';
		const cktonTreasuryCrabAddonAmount = raw.ckton_treasury_crab_addon[address] || '0';

		const totalGroupBalance = (
			BigInt(crabBalance) +
			BigInt(wcrabBalance) +
			BigInt(gcrabBalance) +
			BigInt(wcringBalance) +
			BigInt(xwcrabBalance) +
			BigInt(virtualCrabBalance) +
			BigInt(virtualWcrabBalance) +
			BigInt(virtualGcrabBalance) +
			BigInt(virtualXwcrabBalance) +
			BigInt(virtualWcringBalance) +
			BigInt(crabStakingRewards) +
			BigInt(cktonStakingRewards) +
			BigInt(crabDepositBalance) +
			BigInt(cktonTreasuryCrabAddonAmount)
		).toString();

		const cktonTreasuryGroupBalance = result.cktonTreasuryGroupBalances?.[address] || '0';
		const cktonTreasuryGroupSupply = result.cktonTreasuryGroupSupply || '0';
		const cktonTreasuryCrabBalance = result.cktonTreasuryCrabBalance || '0';

		return {
			rule_name: ruleName,
			description: result.description,
			total_supply: result.totalSupply,
			group_balance: totalGroupBalance,
			proportion: data.proportion,
			proportion_fraction: `(${totalGroupBalance}/${result.totalSupply})`,
			airdrop_amount: data.amount,

			crab_balance: crabBalance,
			wcrab_balance: wcrabBalance,
			gcrab_balance: gcrabBalance,
			wcring_balance: wcringBalance,
			xwcrab_balance: xwcrabBalance,
			virtual_crab_from_lp: virtualCrabBalance,
			virtual_wcrab_from_lp: virtualWcrabBalance,
			virtual_gcrab_from_lp: virtualGcrabBalance,
			virtual_xwcrab_from_lp: virtualXwcrabBalance,
			virtual_wcring_from_lp: virtualWcringBalance,
			virtual_from_ckton_treasury: {
				ckton_treasury_crab_balance: cktonTreasuryCrabBalance,
				amount: cktonTreasuryCrabAddonAmount,
				portion: formatRatio(cktonTreasuryGroupBalance, cktonTreasuryGroupSupply, 18),
				portion_fraction: `(${cktonTreasuryGroupBalance}/${cktonTreasuryGroupSupply})`,
				ckton_group_total_supply: cktonTreasuryGroupSupply
			},
			crab_staking_rewards: crabStakingRewards,
			ckton_staking_rewards: cktonStakingRewards,
			crab_deposit_balance: crabDepositBalance
		};
	}


	if (ruleName === 'ckton_group') {
		const raw = result.rawBalances;

		const cktonBalance = raw.ckton[address] || '0';
		const wcktonBalance = raw.wckton[address] || '0';
		const gcktonBalance = raw.gckton[address] || '0';
		const virtualCktonBalance = raw.virtual_ckton[address] || '0';
		const virtualWcktonBalance = raw.virtual_wckton[address] || '0';
		const virtualGcktonBalance = raw.virtual_gckton[address] || '0';

		const totalGroupBalance = (
			BigInt(cktonBalance) +
			BigInt(wcktonBalance) +
			BigInt(gcktonBalance) +
			BigInt(virtualCktonBalance) +
			BigInt(virtualWcktonBalance) +
			BigInt(virtualGcktonBalance)
		).toString();

		return {
			rule_name: ruleName,
			description: result.description,
			total_supply: result.totalSupply,
			group_balance: totalGroupBalance,
			proportion: data.proportion,
			proportion_fraction: `(${totalGroupBalance}/${result.totalSupply})`,
			airdrop_amount: data.amount,

			ckton_balance: cktonBalance,
			wckton_balance: wcktonBalance,
			gckton_balance: gcktonBalance,
			virtual_ckton_balance: virtualCktonBalance,
			virtual_wckton_balance: virtualWcktonBalance,
			virtual_gckton_balance: virtualGcktonBalance
		};
	}

	if (ruleName === 'evolution_land') {
		details.land_allocations = result.landAllocations || {};
		details.land_supplies = result.componentSupplies || {};
		details.land_breakdown = data.lands || {};
	}

	return details;
}

function buildStatistics(recipients, ruleResults, excludedRecipients) {
	let totalAirdrop = 0n;
	const topRecipients = Array.from(recipients.values())
		.sort((a, b) => {
			const amountA = BigInt(a.total_airdrop || '0');
			const amountB = BigInt(b.total_airdrop || '0');
			if (amountA > amountB) return -1;
			if (amountA < amountB) return 1;
			return 0;
		})
		.slice(0, 20)
		.map((recipient) => ({
			address: recipient.address,
			total_airdrop: recipient.total_airdrop,
			total_airdrop_decimal: recipient.total_airdrop_decimal
		}));

	for (const recipient of recipients.values()) {
		totalAirdrop += BigInt(recipient.total_airdrop || '0');
	}

	const statistics = {
		total_recipients: recipients.size,
		total_airdrop_distributed: totalAirdrop.toString(),
		total_airdrop_distributed_with_decimal: formatTokenAmount(totalAirdrop.toString(), 18),
		top_20_recipients: topRecipients,
		rule_details: {}
	};

	for (const [ruleName, result] of Object.entries(ruleResults)) {
		const recipientCount = Object.keys(result.airdropPerAddress).filter((address) => {
			const normalized = normalizeAddress(address);
			return normalized && !excludedRecipients.has(normalized);
		}).length;

		statistics.rule_details[ruleName] = {
			total_supply: result.totalSupply,
			allocation: result.allocation,
			allocation_percentage: result.allocationPercentage,
			component_supplies: result.componentSupplies,
			recipient_count: recipientCount
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
