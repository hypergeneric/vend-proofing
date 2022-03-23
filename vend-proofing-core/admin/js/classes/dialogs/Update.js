
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.dialogs.Update = function () {
	/* "imported" classes
		*/
	var Lang;
	var Admin;
	/* private properites
		*/
	var _instance = this;
	var _description = '';
	var _parent;
	/* private methods
		*/
	function render () {
		
		var converter = new showdown.Converter();
		var changelog = converter.makeHtml(Admin.productinfo().data.product.ChangeLog._value);
		
		var xhtml = '';
			xhtml += '<div class="Update DialogForm">';
			xhtml += 	'<div class="Text">';
			xhtml += 		'<div>' + _description + '</div>';
			xhtml += 	'</div>';
			xhtml += 	'<div style="height:' + (IS_MOBILE?"auto":"200px") + '" class="Group Changelog">';
			xhtml += 		'<div>' + changelog + '</div>';
			xhtml += 	'</div>';
			xhtml += '</div>';
			
		_parent.html(xhtml);
		
	}
	/* public methods
		*/
	this.parent = function (obj) {
		_parent = obj;
	};
	this.destroy = function () {
		_parent.empty();
	};
	this.initialize = function (obj) {
		Admin = classes.Admin;
		Lang = classes.data.Lang;
		_description = obj.description;
		render();
	};
};
