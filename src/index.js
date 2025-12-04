/**
 * Crab Sunset - Token Holder Snapshot System
 * 
 * Main exports for the Crab Network token holder tracking system.
 */

const { fetchTokenHoldersSnapshot } = require('./fetch-token-holders');
const { fetchNativeTokenSnapshot } = require('./fetch-native-holders');
const { fetchSnowLPsSnapshot } = require('./fetch-snow-lps');
const { fetchEvolutionLandSnapshot } = require('./fetch-evolution-land');
const { getAnnotations, annotateAddress, annotateHolders } = require('./annotations');
const { fetchTokenInfo, isSmartContract } = require('./api');
const { loadCache, saveCache } = require('./cache');

module.exports = {
	// Main snapshot functions
	fetchTokenHoldersSnapshot,
	fetchNativeTokenSnapshot,
	fetchSnowLPsSnapshot,
	fetchEvolutionLandSnapshot,
	
	// Annotation utilities
	getAnnotations,
	annotateAddress,
	annotateHolders,
	
	// API utilities
	fetchTokenInfo,
	isSmartContract,
	
	// Cache utilities
	loadCache,
	saveCache
};
