const fs = require('fs');
const path = require('path');

const INPUT_FILENAME = 'airdrop_results.json';
const OUTPUT_PART1 = 'safe_airdrop_part1.csv';
const OUTPUT_PART2 = 'safe_airdrop_part2.csv';
const RING_DECIMALS = 18;

function formatTokenAmount(amount, decimals = 18) {
	const value = BigInt(amount || '0');
	const scale = 10n ** BigInt(decimals);
	const integerPart = value / scale;
	const fractionalPart = value % scale;
	const fractional = fractionalPart.toString().padStart(decimals, '0').replace(/0+$/, '');

	return fractional.length > 0 ? `${integerPart}.${fractional}` : integerPart.toString();
}

function buildCsvRows(recipients) {
	const rows = ['token_address,receiver,amount'];
	for (const recipient of recipients) {
		const address = (recipient?.address || '').toLowerCase();
		if (!address) {
			continue;
		}

		const amountWei = recipient.total_airdrop || '0';
		if (BigInt(amountWei) === 0n) {
			continue;
		}

		const amount = formatTokenAmount(amountWei, RING_DECIMALS);
		rows.push(`,${address},${amount}`);
	}
	return rows.join('\n') + '\n';
}

function writeCsv(outputDir, filename, content) {
	const outputPath = path.resolve(outputDir);
	if (!fs.existsSync(outputPath)) {
		fs.mkdirSync(outputPath, { recursive: true });
	}

	const outputFile = path.join(outputPath, filename);
	fs.writeFileSync(outputFile, content);
	return outputFile;
}

function splitRecipients(recipients, firstCount) {
	return {
		part1: recipients.slice(0, firstCount),
		part2: recipients.slice(firstCount)
	};
}

function generateSafeAirdropCsvFiles(outputDir, options = {}) {
	const firstCount = Number.isFinite(options.firstCount) ? options.firstCount : 350;

	const outputPath = path.resolve(outputDir);
	const inputFile = path.join(outputPath, INPUT_FILENAME);
	if (!fs.existsSync(inputFile)) {
		throw new Error(`Missing input file: ${INPUT_FILENAME}`);
	}

	const data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
	const recipients = Object.values(data.recipients || {});

	const { part1, part2 } = splitRecipients(recipients, firstCount);

	const csv1 = buildCsvRows(part1);
	const csv2 = buildCsvRows(part2);

	const out1 = writeCsv(outputDir, OUTPUT_PART1, csv1);
	const out2 = writeCsv(outputDir, OUTPUT_PART2, csv2);

	return {
		input: inputFile,
		outputs: [out1, out2],
		recipients_total: recipients.length,
		recipients_part1: part1.length,
		recipients_part2: part2.length
	};
}

module.exports = {
	generateSafeAirdropCsvFiles
};
