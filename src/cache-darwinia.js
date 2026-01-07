const fs = require("fs");
const path = require("path");

const CACHE_FILE = path.join(__dirname, '..', 'data', '.address_cache_darwinia.json');

function loadCache() {
	try {
		if (fs.existsSync(CACHE_FILE)) {
			const cacheData = fs.readFileSync(CACHE_FILE, 'utf8');
			return JSON.parse(cacheData);
		}
	} catch (error) {
		console.warn('⚠️  Could not load cache:', error.message);
	}
	return {};
}

function saveCache(cache) {
	try {
		fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
	} catch (error) {
		console.warn('⚠️  Could not save cache:', error.message);
	}
}

module.exports = {
	loadCache,
	saveCache
};
