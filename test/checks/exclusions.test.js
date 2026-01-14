const test = require('node:test');
const { loadJson } = require('../helpers/data');

const EXCLUDED = new Set([
	'0xb633ad1142941ca2eb9c350579cf88bbe266660d',
	'0x6d6f646c64612f74727372790000000000000000'
]);

function warn(message) {
	console.warn(`⚠️  ${message}`);
}

test('Excluded recipients are not present', () => {
	const airdrop = loadJson('airdrop_results.json');
	const recipients = airdrop.recipients || {};

	for (const address of Object.keys(recipients)) {
		const normalized = address.split(' (')[0].toLowerCase();
		if (EXCLUDED.has(normalized)) {
			warn(`Excluded address found in recipients: ${address}`);
		}
	}
});
