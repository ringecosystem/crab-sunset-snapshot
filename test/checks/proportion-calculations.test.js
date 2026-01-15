const { loadJson } = require('../helpers/data');
const { bigIntToDecimalString } = require('../helpers/math');
const { pickSampleKeys } = require('../helpers/sample');
const { info } = require('../helpers/log');

function normalizeDecimalString(value) {
	const trimmed = (value || '').toString();
	if (!trimmed.includes('.')) {
		return trimmed;
	}
	const normalized = trimmed.replace(/0+$/, '').replace(/\.$/, '');
	return normalized === '' ? '0' : normalized;
}

function assertMatch(message, expected, actual) {
	const normalizedExpected = normalizeDecimalString(expected);
	const normalizedActual = normalizeDecimalString(actual);
	if (normalizedExpected !== normalizedActual) {
		throw new Error(`${message} expected=${expected} actual=${actual}`);
	}
}

function validateGroupProportions(recipients, ruleName) {
	const eligible = Object.values(recipients || {}).filter((recipient) => {
		return !!recipient.breakdown?.[ruleName];
	});
	const sampleAddresses = pickSampleKeys(eligible.map((recipient) => recipient.address));
	if (sampleAddresses.length === 0) {
		throw new Error(`No recipients for ${ruleName} proportions`);
	}

	const first = eligible.find((recipient) => recipient.breakdown?.[ruleName]);
	const totalSupply = first?.breakdown?.[ruleName]?.total_supply || '0';

	info(`${ruleName} proportion samples=${sampleAddresses.length} supply=${totalSupply}`);

	sampleAddresses.forEach((address) => {
		const recipient = recipients[address];
		const breakdown = recipient?.breakdown?.[ruleName];
		if (!breakdown) {
			return;
		}
		const expected = bigIntToDecimalString(breakdown.group_balance || '0', totalSupply, 18);
		const actual = breakdown.proportion ?? '0';
		if (expected !== actual) {
			assertMatch(`${ruleName} proportion for ${address}`, expected, actual);
		}
	});
}

test('Airdrop distribution percentages match allocations', () => {
	const airdrop = loadJson('airdrop_results.json');
	const distribution = airdrop.distribution || {};
	const totalTreasury = BigInt(airdrop.total_airdrop_treasury || '0');

	Object.entries(distribution).forEach(([name, entry]) => {
		const allocation = BigInt(entry.allocation || '0');
		const expectedRatio = bigIntToDecimalString(allocation, totalTreasury, 18);
		if (expectedRatio !== entry.percentage) {
			assertMatch(`Distribution percentage for ${name}`, expectedRatio, entry.percentage);
		}
	});
});

test('Group proportions match balances', () => {
	const airdrop = loadJson('airdrop_results.json');
	const recipients = airdrop.recipients || {};

	validateGroupProportions(recipients, 'crab_group');
	validateGroupProportions(recipients, 'ckton_group');
});
