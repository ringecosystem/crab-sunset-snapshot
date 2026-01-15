const { loadJson } = require('../helpers/data');

const EXPECTED_RANGES = [
	'<1',
	'1-10',
	'10-100',
	'100-1k',
	'1k-10k',
	'10k-100k',
	'100k-1M',
	'1M+'
];

test('Airdrop amount ranges cover all recipients', () => {
	const airdrop = loadJson('airdrop_results.json');
	const stats = airdrop.statistics || {};
	const ranges = stats.airdrop_amount_ranges || [];

	expect(ranges.length).toBe(EXPECTED_RANGES.length);
	const totalFromRanges = ranges.reduce((sum, range, index) => {
		expect(range.range).toBe(EXPECTED_RANGES[index]);
		expect(typeof range.count).toBe('number');
		expect(range.count).toBeGreaterThanOrEqual(0);
		return sum + range.count;
	}, 0);

	expect(totalFromRanges).toBe(stats.total_recipients);
});
