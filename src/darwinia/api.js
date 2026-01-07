const BaseAPI = require('../base/api');
const BaseCache = require('../base/cache');
const { BaseAnnotations, checkIsSnowLP } = require('../base/annotations');

class DarwiniaAPI extends BaseAPI {
	constructor() {
		super("https://explorer.darwinia.network/api");
		this.cache = new BaseCache('.address_cache_darwinia.json');
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

module.exports = DarwiniaAPI;
