#!/usr/bin/env node

const path = require('path');
const { fetchTokenHoldersSnapshot } = require('./scripts/fetch-token-holders');

async function main() {
	// Get contract address from command line
	const contractAddress = process.argv[2];
	if (!contractAddress) {
		console.error("❌ Error: Please provide contract address as parameter");
		console.log("Usage: node main.js <contract_address> [output_dir]");
		process.exit(1);
	}

	// Optional output directory parameter
	const outputDir = process.argv[3] || path.join(__dirname, 'data');

	try {
		await fetchTokenHoldersSnapshot(contractAddress, outputDir);
	} catch (error) {
		console.error("❌ Fatal error:", error.message);
		process.exit(1);
	}
}

main();
