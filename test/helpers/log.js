function info(message) {
	console.log(`ℹ️  ${message}`);
}

function warn(message) {
	console.warn(`⚠️  ${message}`);
}

function formatDelta(expected, actual) {
	const exp = BigInt(expected || '0');
	const act = BigInt(actual || '0');
	const delta = act >= exp ? act - exp : exp - act;
	return {
		delta: delta.toString(),
		direction: act >= exp ? 'over' : 'under'
	};
}

module.exports = {
	info,
	warn,
	formatDelta
};
