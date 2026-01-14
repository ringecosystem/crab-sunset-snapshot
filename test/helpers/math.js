function bigIntToDecimalString(numerator, denominator, decimals = 18) {
	const denom = BigInt(denominator);
	if (denom === 0n) {
		return '0';
	}

	const scale = 10n ** BigInt(decimals);
	const scaled = (BigInt(numerator) * scale) / denom;
	const integerPart = scaled / scale;
	const fractionalPart = scaled % scale;
	const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
	const trimmedFractional = fractionalStr.replace(/0+$/, '');

	if (trimmedFractional === '') {
		return integerPart.toString();
	}

	return `${integerPart}.${trimmedFractional}`;
}

function sumBalances(holders) {
	return Object.values(holders || {}).reduce((sum, value) => {
		return sum + BigInt(value || '0');
	}, 0n);
}

module.exports = {
	bigIntToDecimalString,
	sumBalances
};
