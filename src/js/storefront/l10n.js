classes.helpers.L10N = (function () {
	function Constructor() {
		var l10n = VEND_CONFIG.language;
		this.get = function (group, node) {
			return l10n[group][node];
		};
	}
	return new Constructor();
}());
