const { loadJson } = require('../helpers/data');

test('All recipients are EOAs per crab-cache', () => {
	const airdrop = loadJson('airdrop_results.json');
	const crabCache = loadJson('crab-cache.json');

	const recipients = airdrop.recipients || {};
	for (const address of Object.keys(recipients)) {
		const normalized = address.split(' (')[0].toLowerCase();
		expect(crabCache[normalized] === true).toBe(false);
	}
});
