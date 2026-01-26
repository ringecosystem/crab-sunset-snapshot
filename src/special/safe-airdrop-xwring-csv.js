const fs = require('fs');
const path = require('path');

const INPUT_FILENAME = 'airdrop_xwring.json';
const OUTPUT_FILENAME = 'safe_airdrop_xwring.csv';

function normalizeDecimalString(value) {
	const trimmed = value.trim();
	if (!trimmed) {
		return '0';
	}
	return trimmed.replace(/\.0+$/, '').replace(/(\.[0-9]*?)0+$/, '$1').replace(/\.$/, '') || '0';
}

function toPlainDecimalString(value) {
	const text = value.toString();
	if (!/[eE]/.test(text)) {
		return text;
	}

	const [rawCoefficient, rawExponent] = text.split(/[eE]/);
	const exponent = Number(rawExponent);
	if (!Number.isFinite(exponent)) {
		return '0';
	}

	let coefficient = rawCoefficient;
	let sign = '';
	if (coefficient.startsWith('-')) {
		sign = '-';
		coefficient = coefficient.slice(1);
	}

	let [integerPart, fractionPart = ''] = coefficient.split('.');

	if (exponent >= 0) {
		const paddedFraction = fractionPart.padEnd(exponent, '0');
		const whole = integerPart + paddedFraction.slice(0, exponent);
		const remainder = paddedFraction.slice(exponent);
		return sign + whole + (remainder ? `.${remainder}` : '');
	}

	const zeros = '0'.repeat(Math.abs(exponent) - 1);
	return sign + `0.${zeros}${integerPart}${fractionPart}`;
}

function formatAmount(amount) {
	if (typeof amount === 'string') {
		const plain = toPlainDecimalString(amount.trim());
		return normalizeDecimalString(plain);
	}

	if (typeof amount !== 'number' || !Number.isFinite(amount)) {
		return '0';
	}

	const plain = toPlainDecimalString(amount);
	return normalizeDecimalString(plain);
}

function buildCsvRows(items) {
	const rows = ['token_address,receiver,amount'];
	for (const item of items) {
		if (!item || item.isEOA !== true) {
			continue;
		}

		const address = (item.account || '').toLowerCase();
		if (!address) {
			continue;
		}

		const amount = formatAmount(item.amount);
		if (!amount || Number(amount) === 0) {
			continue;
		}

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

function generateSafeAirdropXwringCsvFile(outputDir) {
	const outputPath = path.resolve(outputDir);
	const inputFile = path.join(outputPath, INPUT_FILENAME);
	if (!fs.existsSync(inputFile)) {
		throw new Error(`Missing input file: ${INPUT_FILENAME}`);
	}

	const data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
	const items = Array.isArray(data.details) ? data.details : [];
	const csv = buildCsvRows(items);
	const outputFile = writeCsv(outputDir, OUTPUT_FILENAME, csv);

	const totalReceivers = csv.split('\n').filter(Boolean).length - 1;
	return {
		input: inputFile,
		output: outputFile,
		recipients_total: totalReceivers
	};
}

module.exports = {
	generateSafeAirdropXwringCsvFile
};
