const fs = require("fs");
const path = require("path");

const SPECIAL_ADDRESSES = {
	"0x6d6f646c64612f74727372790000000000000000": "Treasury"
};

function loadSnowLPAddresses() {
	const snapshotPath = path.resolve(__dirname, '..', '..', 'data', 'snow_lps_snapshot.json');
	
	if (!fs.existsSync(snapshotPath)) {
		console.log("⚠️  Snow LPs snapshot not found. Run 'npm run fetch:crab' first.");
		return {};
	}

	const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
	const lpAddresses = {};
	
	snapshot.snow_lps?.forEach(lp => {
		const address = lp.address.toLowerCase();
		lpAddresses[address] = `Snow LP`;
	});

	return lpAddresses;
}

function loadEvolutionLandAddresses() {
	const snapshotPath = path.resolve(__dirname, '..', '..', 'data', 'evolution_land_snapshot.json');
	if (!fs.existsSync(snapshotPath)) {
		return {};
	}
	try {
		const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
		const evoAddresses = {};
		(snapshot.evolution_tokens || []).forEach(t => {
			if (t.address) evoAddresses[(t.address || '').toLowerCase()] = 'Evolution Land';
		});
		return evoAddresses;
	} catch (_) {
		return {};
	}
}

class BaseAnnotations {
	constructor() {
		// Load base special addresses
		for (const [address, annotation] of Object.entries(SPECIAL_ADDRESSES)) {
			this.annotations = {
				[address.toLowerCase()]: annotation
			};
		}
	}

	loadSnowLPs() {
		const snowLPs = loadSnowLPAddresses();
		
		for (const [address, annotation] of Object.entries(snowLPs)) {
			this.annotations[address] = annotation;
		}
		
		return this.annotations;
	}

	loadEvolutionLandTokens() {
		const evoTokens = loadEvolutionLandAddresses();
		
		for (const [address, annotation] of Object.entries(evoTokens)) {
			this.annotations[address] = annotation;
		}
		
		return this.annotations;
	}

	getAll() {
		this.loadSnowLPs();
		this.loadEvolutionLandTokens();
		return this.annotations;
	}

	annotateAddress(address) {
		const lowerAddress = address.toLowerCase();
		const annotation = this.annotations[lowerAddress];
		
		if (annotation) {
			return `${address} (${annotation})`;
		}
		return address;
	}

	annotateHolders(holders) {
		const annotated = {};
		
		for (const [address, balance] of Object.entries(holders)) {
			const annotatedAddress = this.annotateAddress(address);
			annotated[annotatedAddress] = balance;
		}
		
		return annotated;
	}
}

module.exports = {
	BaseAnnotations,
	loadSnowLPAddresses,
	loadEvolutionLandAddresses
};
