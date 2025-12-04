const fs = require("fs");
const path = require("path");

// Cache file path - store in data folder
const CACHE_FILE = path.join(__dirname, '..', 'data', '.address_cache.json');

// Load cache from file
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

// Save cache to file
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
