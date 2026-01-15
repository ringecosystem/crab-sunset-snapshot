const { loadJson } = require('../helpers/data');
const { info, formatDelta } = require('../helpers/log');

function getRuleRecipients(recipients, ruleName) {
	return Object.values(recipients || {}).filter((recipient) => {
		return !!recipient.breakdown?.[ruleName];
	});
}

function checkConstantSupply(ruleRecipients, ruleName) {
	let expected = null;
	for (const recipient of ruleRecipients) {
		const supply = recipient.breakdown?.[ruleName]?.total_supply;
		if (!supply) {
			continue;
		}
		if (expected === null) {
			expected = supply;
			continue;
		}
		if (supply !== expected) {
			throw new Error(`${ruleName} total_supply differs across recipients: expected=${expected} actual=${supply} recipient=${recipient.address}`);
		}
	}
	return expected;
}

test('Group total_supply matches sum of group balances', () => {
	const airdrop = loadJson('airdrop_results.json');
	const stats = airdrop.statistics || {};
	const recipients = airdrop.recipients || {};

	info(`Loaded recipients=${Object.keys(recipients).length}`);

	// CKTON group: total_supply should equal sum(group_balance)
	{
		const ruleName = 'ckton_group';
		const ruleRecipients = getRuleRecipients(recipients, ruleName);
		const expectedSupply = checkConstantSupply(ruleRecipients, ruleName);
		let sumBalances = 0n;
		for (const recipient of ruleRecipients) {
			sumBalances += BigInt(recipient.breakdown[ruleName].group_balance || '0');
		}

		const expected = BigInt(expectedSupply || '0');
		info(`${ruleName} recipients=${ruleRecipients.length} supply=${expected} sum(group_balance)=${sumBalances}`);
		if (expected !== sumBalances) {
			const { delta, direction } = formatDelta(expected.toString(), sumBalances.toString());
			throw new Error(`${ruleName} total_supply mismatch sum(group_balance) (delta=${delta} ${direction})`);
		}

		const statsSupply = BigInt(stats.rule_details?.[ruleName]?.total_supply || '0');
		if (statsSupply !== 0n && statsSupply !== expected) {
			throw new Error(`${ruleName} statistics total_supply mismatch breakdown total_supply: stats=${statsSupply} breakdown=${expected}`);
		}
	}

	// CRAB group: total_supply should equal sum(group_balance)
	{
		const ruleName = 'crab_group';
		const ruleRecipients = getRuleRecipients(recipients, ruleName);
		const expectedSupply = checkConstantSupply(ruleRecipients, ruleName);
		let sumBalances = 0n;
		for (const recipient of ruleRecipients) {
			sumBalances += BigInt(recipient.breakdown[ruleName].group_balance || '0');
		}

		const expected = BigInt(expectedSupply || '0');
		info(`${ruleName} recipients=${ruleRecipients.length} supply=${expected} sum(group_balance)=${sumBalances}`);
		if (expected !== sumBalances) {
			const { delta, direction } = formatDelta(expected.toString(), sumBalances.toString());
			throw new Error(`${ruleName} total_supply mismatch sum(group_balance) (delta=${delta} ${direction})`);
		}

		const statsSupply = BigInt(stats.rule_details?.[ruleName]?.total_supply || '0');
		if (statsSupply !== 0n && statsSupply !== expected) {
			throw new Error(`${ruleName} statistics total_supply mismatch breakdown total_supply: stats=${statsSupply} breakdown=${expected}`);
		}
	}

});
