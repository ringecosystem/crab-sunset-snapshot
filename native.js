#!/usr/bin/env node

const path = require('path');
const { fetchNativeTokenSnapshot } = require('./scripts/fetch-native-holders');

async function main() {
	// Optional output directory parameter
	const outputDir = process.argv[2] || path.join(__dirname, 'data');

	try {
		await fetchNativeTokenSnapshot(outputDir);
	} catch (error) {
		console.error("❌ Fatal error:", error.message);
		process.exit(1);
	}
}

main();
