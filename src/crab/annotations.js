const BaseAPI = require('../base/api');
const BaseCache = require('../base/cache');
const { BaseAnnotations, loadSnowLPAddresses } = require('../base/annotations');

class CrabAnnotations extends BaseAnnotations {
	constructor() {
		super();
	}

	getAll() {
		return this.loadSnowLPs();
	}
}

module.exports = CrabAnnotations;
