const CrabGroupRule = require('./crab-group-rule');
const CktonGroupRule = require('./ckton-group-rule');

const ruleRegistry = {
	crab_group: CrabGroupRule,
	ckton_group: CktonGroupRule
};

function getRule(name, config = {}) {
	const RuleClass = ruleRegistry[name];
	if (!RuleClass) {
		throw new Error(`Unknown airdrop rule: ${name}`);
	}
	return new RuleClass(config);
}

function listRules() {
	return Object.keys(ruleRegistry);
}

function getRuleMetadata(name) {
	const RuleClass = ruleRegistry[name];
	if (!RuleClass) {
		return null;
	}
	const instance = new RuleClass();
	return instance.getMetadata();
}

module.exports = {
	ruleRegistry,
	getRule,
	listRules,
	getRuleMetadata
};
