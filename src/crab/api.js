const BaseAPI = require('../base/api');
const BaseCache = require('../base/cache');
const { loadSnowLPAddresses } = require('./annotations');

class CrabAPI extends BaseAPI {
	constructor() {
		super("https://crab-scan.darwinia.network/api");
		this.cache = new BaseCache('.address_cache_crab.json');
	}

	getCache() {
		return this.cache.load();
	}

	getCacheManager() {
		return this.cache;
	}

	saveCache(cache) {
		this.cache.save(cache);
	}
}

module.exports = CrabAPI;
