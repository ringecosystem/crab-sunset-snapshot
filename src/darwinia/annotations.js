const BaseAPI = require('../base/api');
const BaseCache = require('../base/cache');
const BaseHolders = require('../base/holders');
const { BaseAnnotations, checkIsSnowLP } = require('../base/annotations');

const fs = require("fs");
const path = require("path");

class DarwiniaAnnotations extends BaseAnnotations {
	constructor(api) {
		super();
		this.api = api;
		this.dynamicAnnotations = {};
	}

	getAll() {
		const baseAnnotations = super.getAll();
		return { ...baseAnnotations, ...this.dynamicAnnotations };
	}

	async loadForContracts(contractAddresses) {
		for (const address of contractAddresses) {
			const tokenInfo = await this.api.fetchTokenInfo(address);
			if (tokenInfo && ((tokenInfo.name && tokenInfo.name.includes("Snow LP")) || tokenInfo.symbol === "SNOW-LP")) {
				this.dynamicAnnotations[address.toLowerCase()] = "Snow LP";
			}
			await new Promise(r => setTimeout(r, 100));
		}
		return { ...this.getAll() };
	}
}

module.exports = DarwiniaAnnotations;
