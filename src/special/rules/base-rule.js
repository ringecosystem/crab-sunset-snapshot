const path = require("path");

class BaseAirdropRule {
	constructor(name, description, config = {}) {
		this.name = name;
		this.description = description;
		this.config = config;
	}

	/**
	 * Calculate airdrop amount for each address
	 * @param {Object} existingRecipients - Map of address -> recipient data
	 * @param {Object} options - Rule-specific options
	 * @returns {Object} { ruleName, allocationPercentage, totalGroupSupply, airdropPerAddress }
	 */
	async calculate(existingRecipients, options = {}) {
		throw new Error('calculate() must be implemented by subclass');
	}

	/**
	 * Load JSON data file from data directory
	 * @param {string} filename - JSON file name
	 * @returns {Object} Parsed JSON data
	 */
	loadDataFile(filename) {
		const dataDir = path.join(__dirname, '..', '..', '..', 'data');
		const filePath = path.join(dataDir, filename);
		
		if (!require("fs").existsSync(filePath)) {
			throw new Error(`Data file not found: ${filename}`);
		}
		
		const content = require("fs").readFileSync(filePath, 'utf8');
		return JSON.parse(content);
	}

	/**
	 * Get rule metadata
	 */
	getMetadata() {
		return {
			name: this.name,
			description: this.description
		};
	}

	/**
	 * Filter holders to only EOAs using address cache
	 * Handles annotated addresses like "0xaddr (Snow LP)"
	 * Normalizes addresses to lowercase for consistent aggregation
	 * @param {Object} holders - Map of address -> balance
	 * @param {Object} addressCache - Map of address -> isContract
	 * @returns {Object} Map of lowercase address -> balance (EOAs only)
	 */
	filterEOAs(holders, addressCache) {
		const eoaHolders = {};
		for (const [address, balance] of Object.entries(holders)) {
			// Strip annotation and normalize to lowercase (e.g., "0xaddr (Snow LP)" -> "0xaddr")
			const normalizedAddress = address.split(' (')[0].toLowerCase();
			const isContract = addressCache[normalizedAddress];
			
			if (isContract === undefined || isContract === false) {
				eoaHolders[normalizedAddress] = balance;
			}
		}
		return eoaHolders;
	}

	/**
	 * Aggregate balances from multiple holder sources
	 * Normalizes addresses to lowercase to avoid duplicates
	 * @param {Object} sources - Object containing multiple holder maps
	 * @returns {Object} Map of lowercase address -> total balance
	 */
	aggregateBalances(sources) {
		const aggregated = {};
		
		for (const sourceName of Object.keys(sources)) {
			const holders = sources[sourceName];
			for (const [address, balance] of Object.entries(holders)) {
				// Normalize to lowercase (preserving annotation if present)
				const normalizedAddress = address.toLowerCase();
				
				if (!aggregated[normalizedAddress]) {
					aggregated[normalizedAddress] = "0";
				}
				aggregated[normalizedAddress] = (BigInt(aggregated[normalizedAddress]) + BigInt(balance)).toString();
			}
		}
		
		return aggregated;
	}

	/**
	 * Calculate airdrop proportional to balance
	 * Uses decimal strings to avoid scientific notation
	 * @param {Object} balances - Map of address -> balance
	 * @param {string} allocation - Total allocation for this rule (BigInt string)
	 * @returns {Object} Map of address -> airdrop amount
	 */
	calculateProportionalAirdrop(balances, allocation) {
		const airdropPerAddress = {};
		const totalSupply = Object.values(balances).reduce((sum, b) => sum + BigInt(b), 0n);
		const allocationBigInt = BigInt(allocation);
		
		for (const [address, balance] of Object.entries(balances)) {
			const balanceBigInt = BigInt(balance);
			
			if (totalSupply > 0n) {
				// Use decimal string to avoid scientific notation
				const proportion = this.bigIntToDecimalString(balanceBigInt, totalSupply, 18);
				const airdropAmount = (balanceBigInt * allocationBigInt) / totalSupply;
				
				airdropPerAddress[address] = {
					amount: airdropAmount.toString(),
					proportion: proportion
				};
			} else {
				airdropPerAddress[address] = {
					amount: "0",
					proportion: "0"
				};
			}
		}
		
		return {
			airdropPerAddress,
			totalSupply: totalSupply.toString()
		};
	}

	/**
	 * Convert BigInt division to decimal string without scientific notation
	 * @param {BigInt} numerator - Numerator value
	 * @param {BigInt} denominator - Denominator value
	 * @param {number} decimals - Number of decimal places
	 * @returns {string} Decimal string representation
	 */
	bigIntToDecimalString(numerator, denominator, decimals = 18) {
		if (denominator === 0n) return "0";
		
		const scale = 10n ** BigInt(decimals);
		const scaled = (numerator * scale) / denominator;
		
		const integerPart = scaled / scale;
		const fractionalPart = scaled % scale;
		
		// Format with leading zeros for fractional part
		const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
		
		// Remove trailing zeros for cleaner output
		const trimmedFractional = fractionalStr.replace(/0+$/, '');
		
		if (trimmedFractional === '') {
			return integerPart.toString();
		}
		
		return `${integerPart}.${trimmedFractional}`;
	}
}

module.exports = BaseAirdropRule;
