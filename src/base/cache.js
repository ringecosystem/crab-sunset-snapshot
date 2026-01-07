const fs = require("fs");
const path = require("path");

class BaseCache {
	constructor(cacheFileName) {
		this.cacheFile = path.join(__dirname, '..', '..', 'data', cacheFileName);
	}

	load() {
		try {
			if (fs.existsSync(this.cacheFile)) {
				const cacheData = fs.readFileSync(this.cacheFile, 'utf8');
				return JSON.parse(cacheData);
			}
		} catch (error) {
			console.warn('⚠️  Could not load cache:', error.message);
		}
		return {};
	}

	save(cache) {
		try {
			// Filter out the cacheFile key if it exists (legacy/metadata)
			const cleanCache = { ...cache };
			delete cleanCache.cacheFile;
			
			fs.writeFileSync(this.cacheFile, JSON.stringify(cleanCache, null, 2));
		} catch (error) {
			console.warn('⚠️  Could not save cache:', error.message);
		}
	}
}

module.exports = BaseCache;
