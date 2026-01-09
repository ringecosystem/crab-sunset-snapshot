const path = require("path");
const fs = require("fs");
const { getRule } = require('./rules');

const TOTAL_AIRDROP_TREASURY = "35800929963600661161044805";

const DISTRIBUTION = {
	crab_group: {
		percentage: "0.60",
		allocation: "21480557978160396696626883",
		components: ["CRAB", "WCRAB", "gCRAB", "xWCRAB"]
	},
	ckton_group: {
		percentage: "0.20",
		allocation: "7160185992720132232208961",
		components: ["CKTON", "WCKTON", "gCKTON"]
	},
	evolution_land: {
		percentage: "0.15",
		allocation: "5370139494540099174156727"
	},
	reserve: {
		percentage: "0.05",
		allocation: "1790046498180033305805225"
	}
};

async function calculateAirdrop(outputDir, config = {}) {
	console.log(`\n💰 Airdrop Calculation`);
	console.log(`📍 Crab Network`);
	console.log(`💵 Total Treasury: ${TOTAL_AIRDROP_TREASURY} RING\n`);

	const outputPath = path.resolve(outputDir);
	if (!fs.existsSync(outputPath)) {
		fs.mkdirSync(outputPath, { recursive: true });
	}

	const rules = [
		{
			name: 'crab_group',
			enabled: config.enableCrabGroup !== false,
			allocation: DISTRIBUTION.crab_group.allocation
		},
		{
			name: 'ckton_group',
			enabled: config.enableCktonGroup !== false,
			allocation: DISTRIBUTION.ckton_group.allocation
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
			totalTreasury: TOTAL_AIRDROP_TREASURY
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
				total_airdrop: "0"
			};

			existing.breakdown[ruleConfig.name] = buildBreakdown(ruleConfig.name, result, address);
			existing.total_airdrop = (BigInt(existing.total_airdrop) + BigInt(data.amount)).toString();
			allRecipients.set(address, existing);
		}
	}

	const rulesApplied = rules
		.filter(r => r.enabled)
		.map(r => getRule(r.name).getMetadata());

	const statistics = buildStatistics(allRecipients, ruleResults);

	const output = {
		timestamp: new Date().toISOString(),
		snapshot_height: 9623885,
		total_airdrop_treasury: TOTAL_AIRDROP_TREASURY,
		distribution: DISTRIBUTION,
		rules_applied: rulesApplied,
		recipients: Object.fromEntries(allRecipients),
		statistics: statistics
	};

	const outputFile = path.join(outputPath, 'airdrop_snapshot.json');
	fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));

	console.log(`\n✅ Airdrop calculation complete!`);
	console.log(`📊 Total recipients: ${statistics.total_recipients}`);
	console.log(`💾 Saved to: ${path.basename(outputFile)}`);

	return {
		outputFile,
		statistics: statistics
	};
}

function buildBreakdown(ruleName, result, address) {
	const data = result.airdropPerAddress[address];
	const details = {
		rule_name: ruleName,
		description: result.description,
		proportion: data.proportion,
		airdrop_amount: data.amount
	};

	if (ruleName === 'crab_group') {
		const raw = result.rawBalances;
		details.crab_balance = raw.crab[address] || "0";
		details.wcrab_balance = raw.wcrab[address] || "0";
		details.gcrab_balance = raw.gcrab[address] || "0";
		details.xwcrab_balance = raw.xwcrab[address] || "0";
		details.total_group_balance = (
			BigInt(details.crab_balance) +
			BigInt(details.wcrab_balance) +
			BigInt(details.gcrab_balance) +
			BigInt(details.xwcrab_balance)
		).toString();
	}

	if (ruleName === 'ckton_group') {
		const raw = result.rawBalances;
		details.ckton_balance = raw.ckton[address] || "0";
		details.wckton_balance = raw.wckton[address] || "0";
		details.gckton_balance = raw.gckton[address] || "0";
		details.total_group_balance = (
			BigInt(details.ckton_balance) +
			BigInt(details.wckton_balance) +
			BigInt(details.gckton_balance)
		).toString();
	}

	return details;
}

function buildStatistics(recipients, ruleResults) {
	let totalAirdrop = "0";
	let eoaCount = 0;
	let contractCount = 0;

	for (const recipient of recipients.values()) {
		totalAirdrop = (BigInt(totalAirdrop) + BigInt(recipient.total_airdrop)).toString();
		if (recipient.is_contract) {
			contractCount++;
		} else {
			eoaCount++;
		}
	}

	const statistics = {
		total_recipients: recipients.size,
		eoa_recipients: eoaCount,
		contract_recipients: contractCount,
		total_airdrop_distributed: totalAirdrop,
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
	TOTAL_AIRDROP_TREASURY,
	DISTRIBUTION
};
