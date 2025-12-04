#!/usr/bin/env node

const path = require('path');
const { fetchSnowLPsSnapshot } = require('./scripts/fetch-snow-lps');

async function main() {
	// Optional output directory parameter
	const outputDir = process.argv[2] || path.join(__dirname, 'data');

	try {
		await fetchSnowLPsSnapshot(outputDir);
	} catch (error) {
		console.error("❌ Fatal error:", error.message);
		process.exit(1);
	}
}

main();
