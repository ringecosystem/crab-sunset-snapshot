const fs = require('fs');
const path = require('path');
const { loadJson, DATA_DIR } = require('../helpers/data');

const CSV_FILENAME = 'safe_airdrop_xwring.csv';

function parseCsvAmounts(filename) {
	const filePath = path.join(DATA_DIR, filename);
	if (!fs.existsSync(filePath)) {
		throw new Error(`Missing CSV file: ${filename}`);
	}

	const content = fs.readFileSync(filePath, 'utf8');
	const lines = content.split('\n').map((line) => line.trim()).filter(Boolean);
	if (lines.length === 0) {
		return [];
	}

	const header = lines[0];
	if (header !== 'token_address,receiver,amount') {
		throw new Error(`Unexpected CSV header in ${filename}: ${header}`);
	}

	const amounts = [];
	for (const line of lines.slice(1)) {
		const parts = line.split(',');
		if (parts.length < 3) {
			continue;
		}
		const amount = Number((parts[2] || '').trim());
		if (!Number.isFinite(amount)) {
			throw new Error(`Invalid amount in ${filename}: ${parts[2]}`);
		}
		amounts.push(amount);
	}

	return amounts;
}

test('safe_airdrop_xwring.csv total amount equals airdrop_xwring.json statistics.TotalEOA', () => {
	const airdrop = loadJson('airdrop_xwring.json');
	const expected = Number(airdrop?.statistics?.TotalEOA);
	if (!Number.isFinite(expected)) {
		throw new Error('Missing/invalid airdrop_xwring.json statistics.TotalEOA');
	}

	const amounts = parseCsvAmounts(CSV_FILENAME);
	const sum = amounts.reduce((acc, value) => acc + value, 0);
	const delta = Math.abs(sum - expected);

	expect(delta).toBeLessThan(1e-9);
});
