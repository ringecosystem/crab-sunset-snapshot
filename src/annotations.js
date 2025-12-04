const fs = require("fs");
const path = require("path");

// Special addresses that need annotations
const SPECIAL_ADDRESSES = {
	"0x6d6f646c64612f74727372790000000000000000": "Treasury"
};

// Load Snow LP addresses from the snapshot file
function loadSnowLPAddresses() {
	const snapshotPath = path.resolve(__dirname, '../data/snow_lps_snapshot.json');
	
	if (!fs.existsSync(snapshotPath)) {
		console.log("⚠️  Snow LPs snapshot not found. Run 'npm run snow-lps' first.");
		return {};
	}

	const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'));
	const lpAddresses = {};
	
	// Add each Snow LP contract address
	snapshot.snow_lps?.forEach(lp => {
		const address = lp.address.toLowerCase();
		lpAddresses[address] = `Snow LP`;
	});

	return lpAddresses;
}

// Load Evolution Land token addresses from the chain (via snapshot output if present)
function loadEvolutionLandAddresses() {
	const snapshotPath = path.resolve(__dirname, '../data/evolution_land_snapshot.json');
	if (!fs.existsSync(snapshotPath)) {
		return {};
	}
	try {
		const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'));
		const evoAddresses = {};
		(snapshot.evolution_tokens || []).forEach(t => {
			if (t.address) evoAddresses[(t.address || '').toLowerCase()] = 'Evolution Land';
		});
		return evoAddresses;
	} catch (_) {
		return {};
	}
}

// Get all special addresses with annotations
function getAnnotations() {
	const snowLPs = loadSnowLPAddresses();
	const evoTokens = loadEvolutionLandAddresses();
	
	// Merge special addresses and Snow LPs
	const annotations = {};
	
	// Add predefined special addresses
	for (const [address, annotation] of Object.entries(SPECIAL_ADDRESSES)) {
		annotations[address.toLowerCase()] = annotation;
	}
	
	// Add Snow LP addresses
	for (const [address, annotation] of Object.entries(snowLPs)) {
		annotations[address] = annotation;
	}

	// Add Evolution Land token addresses
	for (const [address, annotation] of Object.entries(evoTokens)) {
		annotations[address] = annotation;
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
	loadSnowLPAddresses,
	loadEvolutionLandAddresses
};
