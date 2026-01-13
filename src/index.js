const fs = require("fs");
const path = require("path");

const BaseCache = require('./base/cache');
const { BaseAPI } = require('./base/api');
const { BaseHolders } = require('./base/holders');

const CrabAPI = require('./crab/api');
const CrabAnnotations = require('./crab/annotations');
const { fetchTokenHoldersSnapshot as fetchCrabTokenSnapshot } = require('./crab/fetch-token');
const { fetchSnowLPsSnapshot } = require('./fetch-snow-lps');
const { fetchNativeTokenSnapshot } = require('./fetch-native-holders');
const { fetchEvolutionLandSnapshot } = require('./fetch-evolution-land');
const { fetchStakingRewardsSnapshot } = require('./special/staking-rewards');

const DarwiniaAPI = require('./darwinia/api');
const DarwiniaAnnotations = require('./darwinia/annotations');
const { fetchTokenHoldersSnapshot as fetchDarwiniaTokenSnapshot } = require('./darwinia/fetch-token');

module.exports = {
	BaseAPI,
	BaseHolders,
	BaseCache,
	BaseAnnotations,
	
	CrabAPI,
	CrabAnnotations,
	fetchCrabTokenSnapshot,
	fetchSnowLPsSnapshot,
	fetchNativeTokenSnapshot,
	fetchEvolutionLandSnapshot,
	fetchStakingRewardsSnapshot,
	
	DarwiniaAPI,
	DarwiniaAnnotations,
	fetchDarwiniaTokenSnapshot
};
