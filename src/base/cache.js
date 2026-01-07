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
			fs.writeFileSync(this.cacheFile, JSON.stringify(cache, null, 2));
		} catch (error) {
			console.warn('⚠️  Could not save cache:', error.message);
		}
	}
}

module.exports = BaseCache;
