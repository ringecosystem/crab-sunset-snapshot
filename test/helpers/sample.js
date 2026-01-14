function pickSampleKeys(keys, min = 5, max = 10) {
	if (!Array.isArray(keys) || keys.length === 0) {
		return [];
	}

	const range = Math.max(0, max - min + 1);
	const count = Math.min(keys.length, min + Math.floor(Math.random() * range));
	const shuffled = [...keys].sort(() => Math.random() - 0.5);

	return shuffled.slice(0, count);
}

module.exports = {
	pickSampleKeys
};
