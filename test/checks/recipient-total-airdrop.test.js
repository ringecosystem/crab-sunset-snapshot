const { loadJson } = require('../helpers/data');

const AIRDROP_TOLERANCE = 1000n;

function assertWithinTolerance(message, expected, actual) {
	const expectedValue = BigInt(expected || '0');
	const actualValue = BigInt(actual || '0');
	const delta = expectedValue >= actualValue ? expectedValue - actualValue : actualValue - expectedValue;
	if (delta > AIRDROP_TOLERANCE) {
		throw new Error(`${message} expected=${expected} actual=${actual} delta=${delta}`);
	}
}

test('Recipient total_airdrop equals sum of breakdown amounts', () => {
	const airdrop = loadJson('airdrop_results.json');
	const recipients = airdrop.recipients || {};

	for (const recipient of Object.values(recipients)) {
		const breakdowns = recipient.breakdown || {};
		const totalBreakdown = Object.values(breakdowns).reduce((sum, breakdown) => {
			return sum + BigInt(breakdown?.airdrop_amount || '0');
		}, 0n);

		assertWithinTolerance(
			`Total airdrop mismatch for ${recipient.address}`,
			totalBreakdown.toString(),
			recipient.total_airdrop
		);
	}
});
