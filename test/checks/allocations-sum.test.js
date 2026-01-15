const { loadJson } = require('../helpers/data');
const { info, formatDelta } = require('../helpers/log');

const ROUNDING_TOLERANCE = 1000n;

function sumBigInt(values) {
	return (values || []).reduce((sum, value) => sum + BigInt(value || '0'), 0n);
}

test('Rule allocations sum to expected allocations', () => {
	const airdrop = loadJson('airdrop_results.json');
	const distribution = airdrop.distribution || {};
	const stats = airdrop.statistics || {};
	const ruleDetails = stats.rule_details || {};
	const recipients = airdrop.recipients || {};

	info(`Loaded airdrop_results.json recipients=${Object.keys(recipients).length}`);

	// Check: total_airdrop_distributed matches sum of recipients.
	let recipientsSum = 0n;
	for (const recipient of Object.values(recipients)) {
		recipientsSum += BigInt(recipient.total_airdrop || '0');
	}
	const totalDistributed = BigInt(stats.total_airdrop_distributed || '0');
	info(`Recipients sum=${recipientsSum} statistics.total_airdrop_distributed=${totalDistributed}`);
	const { delta, direction } = formatDelta(totalDistributed.toString(), recipientsSum.toString());
	if (recipientsSum !== totalDistributed) {
		throw new Error(`total_airdrop_distributed mismatch (delta=${delta} ${direction})`);
	}

	// Check: group allocations sum to total airdrop treasury.
	const totalTreasury = BigInt(airdrop.total_airdrop_treasury || '0');
	const distributionTotal = sumBigInt(Object.values(distribution).map((d) => d.allocation));
	info(`Distribution total=${distributionTotal} treasury=${totalTreasury}`);
	const distributionDelta = formatDelta(totalTreasury.toString(), distributionTotal.toString());
	if (distributionTotal !== totalTreasury) {
		throw new Error(`distribution allocations sum mismatch (delta=${distributionDelta.delta} ${distributionDelta.direction})`);
	}

	const reserveAllocation = BigInt(distribution.reserve?.allocation || '0');
	const expectedRulesTotal = totalTreasury - reserveAllocation;
	const rulesTotal = sumBigInt(Object.values(ruleDetails).map((d) => d.allocation));
	info(`Rules total=${rulesTotal} (treasury-reserve)=${expectedRulesTotal} reserve=${reserveAllocation}`);
	const rulesDelta = formatDelta(expectedRulesTotal.toString(), rulesTotal.toString());
	if (rulesTotal !== expectedRulesTotal) {
		throw new Error(`rule allocations sum mismatch (delta=${rulesDelta.delta} ${rulesDelta.direction})`);
	}

	['evolution_land', 'ckton_group', 'crab_group'].forEach((ruleName) => {
		const expectedAllocation = BigInt(ruleDetails[ruleName]?.allocation || '0');
		let distributed = 0n;
		let recipientCount = 0;

		for (const recipient of Object.values(recipients)) {
			const breakdown = recipient.breakdown?.[ruleName];
			if (!breakdown) {
				continue;
			}
			recipientCount += 1;
			distributed += BigInt(breakdown.airdrop_amount || '0');
		}

		const { delta, direction } = formatDelta(expectedAllocation.toString(), distributed.toString());
		info(`${ruleName} recipients=${recipientCount} distributed=${distributed} allocation=${expectedAllocation} delta=${delta} (${direction})`);
		const deltaValue = BigInt(delta);
		if (distributed !== expectedAllocation && deltaValue > ROUNDING_TOLERANCE) {
			throw new Error(`${ruleName} distributed sum differs from allocation (delta=${delta} ${direction})`);
		}
	});
});
