const fs = require("fs");
const path = require("path");
const { fetchTokenInfo } = require('./api-darwinia');

// Special addresses that need annotations
const SPECIAL_ADDRESSES = {
	"0x6d6f646c64612f74727372790000000000000000": "Treasury"
};

// Check if a contract is a Snow LP token by fetching its token info
async function checkIsSnowLP(contractAddress) {
	try {
		const tokenInfo = await fetchTokenInfo(contractAddress);
		if (tokenInfo) {
			// Check if token name contains "Snow LP" or symbol is "SNOW-LP"
			const isSnowLP = (tokenInfo.name && tokenInfo.name.includes("Snow LP")) || 
			                (tokenInfo.symbol === "SNOW-LP");
			if (isSnowLP) {
				return true;
			}
		}
	} catch (error) {
		// Skip if error
	}
	return false;
}

// Get all special addresses (basic version without contract checking)
function getAnnotations() {
	const annotations = {};
	for (const [address, annotation] of Object.entries(SPECIAL_ADDRESSES)) {
		annotations[address.toLowerCase()] = annotation;
	}
	return annotations;
}

// Apply annotations to an address
function annotateAddress(address, annotations) {
	const lowerAddress = address.toLowerCase();
	const annotation = annotations[lowerAddress];
	
	if (annotation) {
		return `${address} (${annotation})`;
	}
	return address;
}

// Apply annotations to holders object
function annotateHolders(holders, annotations) {
	const annotated = {};
	
	for (const [address, balance] of Object.entries(holders)) {
		const annotatedAddress = annotateAddress(address, annotations);
		annotated[annotatedAddress] = balance;
	}
	
	return annotated;
}

module.exports = {
	getAnnotations,
	annotateAddress,
	annotateHolders,
	checkIsSnowLP
};
