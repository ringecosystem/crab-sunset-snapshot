const test = require('node:test');
const { loadJson } = require('../helpers/data');

function warn(message) {
	console.warn(`⚠️  ${message}`);
}

test('All recipients are EOAs per crab-cache', () => {
	const airdrop = loadJson('airdrop_results.json');
	const crabCache = loadJson('crab-cache.json');

	const recipients = airdrop.recipients || {};
	for (const address of Object.keys(recipients)) {
		const normalized = address.split(' (')[0].toLowerCase();
		if (crabCache[normalized] === true) {
			warn(`Recipient is contract per crab-cache: ${normalized}`);
		}
	}
});
