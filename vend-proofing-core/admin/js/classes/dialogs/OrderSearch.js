
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.dialogs.OrderSearch = function () {
	
	/* "imported" classes
		*/
		
	var Func;
	var Lang;
	var Auth;
	var Admin;
	
	/* private properites
		*/
		
	var _instance = 		this;
	var _uniquid = 			classes.helpers.Func.uniquid();
	var _parent = 			null;
	
	var _range = 			{ start:"", end:"" };
	var _type = 			"";
	var _orderid = 			"";
	var _setid = 			"";
	var _name = 			"";
	var _email = 			"";
	
	var _input_startdate = 	null;
	var _input_enddate = 	null;
	var _input_setid = 		null;
	var _input_orderid = 	null;
	var _input_name = 		null;
	var _input_email = 		null;
	var _input_type = 		null;
	
	/* private methods
		*/
		
	function change () {
		var value = $(this).val();
		if ( $(this).is(_input_type) ) {
			_type = value;
		} else if ( $(this).is(_input_setid) ) {
			_setid = value;
		} else if ( $(this).is(_input_orderid) ) {
			_orderid = value;
		} else if ( $(this).is(_input_email) ) {
			_email = value;
		} else if ( $(this).is(_input_name) ) {
			_name = value;
		}
	}
	function datechange () {
		var value = $(this).datepicker( "getDate" );
			var year = value.getFullYear();
			var month = value.getMonth();
			var day = value.getDate();
		if ( $(this).is(_input_startdate) ) {
			_range.start = year + "/" + (month+1) + "/" + day;
		} else if ( $(this).is(_input_enddate) ) {
			_range.end = year + "/" + (month+1) + "/" + day;
		}
	}

	function render () {
		
		_uniquid = "DO" + Func.uniquid();
		
		var xhtml = '';
			xhtml += '<div id="' + _uniquid + '" class="DialogForm">';
			xhtml += 	'<div class="Group2">';
			xhtml += 		'<div class="Col">';
			xhtml += 			'<div class="Group Input StartDate">';
			xhtml += 				'<label>' + Lang.lookup("Choose Start Date") + '</label>';
			xhtml += 				'<input type="text" value="' + _range.start + '" />';
			xhtml += 			'</div>';
			xhtml += 		'</div>';
			xhtml += 		'<div class="Col">';
			xhtml += 			'<div class="Group Input EndDate">';
			xhtml += 				'<label>' + Lang.lookup("Choose End Date") + '</label>';
			xhtml += 				'<input type="text" value="' + _range.end + '" />';
			xhtml += 			'</div>';
			xhtml += 		'</div>';
			xhtml += 	'</div>';
			xhtml += 	'<div class="Group2">';
			xhtml += 		'<div class="Col">';
			xhtml += 			'<div class="Group Input Name">';
			xhtml += 				'<label>' + Lang.lookup("Purchaser Name") + '</label>';
			xhtml += 				'<input type="input" value="' + _name + '" />';
			xhtml += 			'</div>';
			xhtml += 		'</div>';
			xhtml += 		'<div class="Col">';
			xhtml += 			'<div class="Group Input Email">';
			xhtml += 				'<label>' + Lang.lookup("Purchaser Email") + '</label>';
			xhtml += 				'<input type="input" value="' + _email + '" />';
			xhtml += 			'</div>';
			xhtml += 		'</div>';
			xhtml += 	'</div>';
			xhtml += 	'<div class="Group2">';
			xhtml += 		'<div class="Col">';
			xhtml += 			'<div class="Group Input SetID">';
			xhtml += 				'<label>' + Lang.lookup("Set ID") + '</label>';
			xhtml += 				'<input type="input" value="' + _setid + '" />';
			xhtml += 			'</div>';
			xhtml += 		'</div>';
			xhtml += 		'<div class="Col">';
			xhtml += 			'<div class="Group Input OrderID">';
			xhtml += 				'<label>' + Lang.lookup("Order ID") + '</label>';
			xhtml += 				'<input type="input" value="' + _orderid + '" />';
			xhtml += 			'</div>';
			xhtml += 		'</div>';
			xhtml += 	'</div>';
			xhtml += 	'<div class="Group Input Type">';
			xhtml += 		'<label>' + Lang.lookup("Payment Type") + '</label>';
			xhtml += 		'<select></select>';
			xhtml += 	'</div>';
			xhtml += 	'<div class="Clear"></div>';
			xhtml += '</div>';
			
		_parent.html(xhtml);
		
		_input_type = _parent.find("#" + _uniquid + " .Type select");
		_input_startdate = _parent.find("#" + _uniquid + " .StartDate input");
		_input_enddate = _parent.find("#" + _uniquid + " .EndDate input");
		_input_setid = _parent.find("#" + _uniquid + " .SetID input");
		_input_orderid = _parent.find("#" + _uniquid + " .OrderID input");
		_input_name = _parent.find("#" + _uniquid + " .Name input");
		_input_email = _parent.find("#" + _uniquid + " .Email input");
		
		_input_startdate.datepicker({
			dateFormat: 'yy/mm/dd',
			changeMonth: true,
			changeYear: true
		});
		_input_enddate.datepicker({
			dateFormat: 'yy/mm/dd',
			changeMonth: true,
			changeYear: true
		});
		
		var provider = [{
				data: "",
				label: Lang.lookup("None Selected")
			},{
				data: "offline",
				label: Lang.lookup("Offline Payments")
			},{
				data: "paypal",
				label: Lang.lookup("Paypal Standard Payments")
			},{
				data: "merchant",
				label: Lang.lookup("Credit Card Payments")
		}];
		for (var i=0; i<provider.length; ++i) {
			var selected = provider[i].data==_type;
			_input_type.append('<option value="' + provider[i].data + '" ' + (selected?"selected":"") + '>' + provider[i].label + '</option>');
		}
		
		_input_type.change(change);
		_input_startdate.change(datechange);
		_input_enddate.change(datechange);
		_input_setid.on("input", change);
		_input_orderid.on("input", change);
		_input_name.on("input", change);
		_input_email.on("input", change);

	}
	
	/* public methods
		*/
		
	this.range = function (obj) {
		if (obj) {
			_range = obj;
		}
		return _range;
	};
	this.type = function (str) {
		if (str) {
			_type = str;
		}
		return _type;
	};
	this.orderid = function (str) {
		if (str) {
			_orderid = str;
		}
		return _orderid;
	};
	this.setid = function (str) {
		if (str) {
			_setid = str;
		}
		return _setid;
	};
	this.name = function (str) {
		if (str) {
			_name = str;
		}
		return _name;
	};
	this.email = function (str) {
		if (str) {
			_email = str;
		}
		return _email;
	};

	this.parent = function (obj) {
		_parent = obj;
	};
	this.destroy = function () {
		_input_startdate.datepicker( "destroy" );
		_input_enddate.datepicker( "destroy" );
		_input_startdate.off();
		_input_enddate.off();
		_input_setid.off();
		_input_orderid.off();
		_input_name.off();
		_input_email.off();
		_input_type.off();
		_parent.empty();
	};
	this.initialize = function (obj) {
		Admin = classes.Admin;
		Auth = classes.data.Auth;
		Func = classes.helpers.Func;
		Lang = classes.data.Lang;
		for (var prop in obj) {
			this[prop](obj[prop]);
		}
		render();
	};
	
};
