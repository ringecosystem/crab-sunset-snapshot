const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');

function loadJson(relativePath) {
	const filePath = path.join(DATA_DIR, relativePath);
	return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function findTokenFile(prefix) {
	const files = fs.readdirSync(DATA_DIR);
	const match = files.find((file) => file.startsWith(`${prefix}_`) && file.endsWith('.json'));
	if (!match) {
		return null;
	}
	return match;
}

function loadTokenSnapshot(prefix) {
	const filename = findTokenFile(prefix);
	if (!filename) {
		return null;
	}
	return loadJson(filename);
}

module.exports = {
	DATA_DIR,
	loadJson,
	loadTokenSnapshot
};
