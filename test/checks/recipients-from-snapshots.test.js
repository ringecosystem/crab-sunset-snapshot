const { loadJson, loadTokenSnapshot } = require('../helpers/data');
const { info } = require('../helpers/log');

const EXCLUDED = new Set([
	'0xb633ad1142941ca2eb9c350579cf88bbe266660d',
	'0x6d6f646c64612f74727372790000000000000000',
	
	// Special system contracts without code (treat as contracts)
	'0x000000000f681d85374225edeeadc25560c1fb3f',
	'0x0000000000000000000000000000000000000000',
	'0x000000000419683a1a03abc21fc9da25fd2b4dd7',
	'0x7369626cd0070000000000000000000000000000',
	'0x0000000000000000000000000000000000000201',
	'0x0000000000000000000000000000000000000101',
	'0x0000000000000000000000000000000000000019',
	'0x0000000000000000000000000000000000000100',
	'0x0000000000000000000000000000000000000200',
	'0x00000005a796df0489b6f16120e9a72bbc954c96'
]);

const TOKEN_PREFIXES = [
	'WCRAB',
	'gCRAB',
	'CKTON',
	'WCKTON',
	'gCKTON',
	'WCRING',
	'xWCRAB'
];

function normalizeAddress(address) {
	return (address || '').split(' (')[0].toLowerCase();
}

function isExcluded(address) {
	const normalized = normalizeAddress(address);
	return !normalized || EXCLUDED.has(normalized);
}

test('Snapshot EOAs appear in recipients (except XRING/XWRING)', () => {
	const airdrop = loadJson('airdrop_results.json');
	const recipients = airdrop.recipients || {};
	const eoaCache = loadJson('eoa-verified-cache.json');
	let checked = 0;
	let missing = 0;

	const crabNative = loadJson('CRAB_native.json');
	for (const [address, balance] of Object.entries(crabNative.eoa_holders || {})) {
		if (isExcluded(address)) {
			continue;
		}
		if (BigInt(balance || '0') === 0n) {
			continue;
		}
		const normalized = normalizeAddress(address);
		if (eoaCache[normalized] !== 'eoa') {
			continue;
		}
		checked += 1;
		if (!recipients[normalized]) {
			missing += 1;
			throw new Error(`Missing recipient for CRAB_native holder: ${normalized}`);
		}
	}

	for (const prefix of TOKEN_PREFIXES) {
		const snapshot = loadTokenSnapshot(prefix);
		if (!snapshot) {
			throw new Error(`Missing token snapshot for ${prefix}`);
		}
		for (const [address, balance] of Object.entries(snapshot.eoa_holders || {})) {
			if (isExcluded(address)) {
				continue;
			}
			if (BigInt(balance || '0') === 0n) {
				continue;
			}
			const normalized = normalizeAddress(address);
			if (eoaCache[normalized] !== 'eoa') {
				continue;
			}
			checked += 1;
			if (!recipients[normalized]) {
				missing += 1;
				throw new Error(`Missing recipient for ${prefix} holder: ${normalized}`);
			}
		}
	}

	info(`Checked holders=${checked} missing=${missing}`);
});
