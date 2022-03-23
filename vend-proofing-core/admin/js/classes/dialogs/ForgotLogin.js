
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.dialogs.ForgotLogin = function () {
	/* "imported" classes
		*/
	var StageProxy;
	var Func;
	var Lang;
	var Auth;
	var Cookie;
	/* private properites
		*/
	var _instance = this;
	var _parent;
	var screen;
	var panel_upper;
	var panel_lower;
	var email_address_field;
	var verify_button;
	var error_label1;
	var secret_question_field;
	var secret_question_answer_field;
	var submit_button;
	var error_label2;
	/* private methods
		*/
	function onVerifyEmail (success, data) {
		screen.hide();
		if (!success) {
			error_label1.css("visibility", "visible").html(Lang.lookup(data));
		} else {
			error_label1.css("visibility", "hidden").empty();
			panel_upper.find(".Screen").show();
			panel_lower.find(".Screen").hide();
			secret_question_field.val(data);
		}
	}
	function onResetCredentials (success, data) {
		screen.hide();
		error_label2.css("visibility", "visible").html(Lang.lookup(data));
		if (success) {
			error_label2.addClass("Success");
			error_label2.css("z-index", 2000);
			panel_lower.find(".Screen").show();
		}
	}
	function render () {
		
		var xhtml = '';
			xhtml += '<div class="ForgotLogin DialogForm">';
			xhtml += 	'<div class="Screen"></div>';
			xhtml += 	'<div id="panel_upper">';
			xhtml += 		'<div class="Screen"></div>';
			xhtml += 		'<div class="Group Input">';
			xhtml += 			'<label>' + Lang.lookup("Your Email Address") + '</label>';
			xhtml += 			'<input id="email_address_field" type="input" value="" />';
			xhtml += 		'</div>';
			xhtml += 		'<div class="Submit">';
			xhtml += 			'<input type="submit" id="verify_button" value="' + Lang.lookup("Verify Email Address") + '" />';
			xhtml += 		'</div>';
			xhtml += 		'<div class="Response" id="error_label1">&nbsp;</div>';
			xhtml += 		'<div class="Clear"></div>';
			xhtml += 	'</div>';
			xhtml += 	'<div id="panel_lower">';
			xhtml += 		'<div class="Screen"></div>';
			xhtml += 		'<div class="Group Input">';
			xhtml += 			'<label>' + Lang.lookup("Your Secret Question") + '</label>';
			xhtml += 			'<textarea id="secret_question_field" rows="3" cols="50" readonly></textarea>';
			xhtml += 		'</div>';
			xhtml += 		'<div class="Group Input">';
			xhtml += 			'<label>' + Lang.lookup("Secret Question Answer") + '</label>';
			xhtml += 			'<input id="secret_question_answer_field" type="input" value="" />';
			xhtml += 		'</div>';
			xhtml += 		'<div class="Submit">';
			xhtml += 			'<input type="submit" id="submit_button" value="' + Lang.lookup("Submit") + '" />';
			xhtml += 		'</div>';
			xhtml += 		'<div class="Response" id="error_label2">&nbsp;</div>';
			xhtml += 		'<div class="Clear"></div>';
			xhtml += 	'</div>';
			xhtml += '</div>';
			
		_parent.html(xhtml);
		
		screen = _parent.find('.Screen').first();
		email_address_field = _parent.find('#email_address_field');
		verify_button = _parent.find('#verify_button');
		error_label1 = _parent.find('#error_label1');
		secret_question_field = _parent.find('#secret_question_field');
		secret_question_answer_field = _parent.find('#secret_question_answer_field');
		submit_button = _parent.find('#submit_button');
		error_label2 = _parent.find('#error_label2');
		panel_upper = _parent.find('#panel_upper');
		panel_lower = _parent.find('#panel_lower');
		
		error_label1.css("margin-left", verify_button.outerWidth()+15);
		error_label2.css("margin-left", submit_button.outerWidth()+15);
		
		panel_lower.find(".Screen").show();
		
		verify_button.click(function (event) {
			screen.show();
			Auth.send(this, onVerifyEmail, {
				action: "get_secret_question",
				email_address: email_address_field.val()
			});
			Func.stop(event);
			return false;
		});
		
		submit_button.click(function (event) {
			screen.show();
			Auth.send(this, onResetCredentials, {
				action: "reset_user_credentials",
				email_address: email_address_field.val(),
				secret_question_hash: sha1(md5(NAMESPACE)+md5(secret_question_answer_field.val().toLowerCase()))
			});
			Func.stop(event);
			return false;
		});
		
		screen.click(function (event) {
			Func.stop(event);
			return false;
		});

	}
	/* public methods
		*/
	this.parent = function (obj) {
		_parent = obj;
	};
	this.destroy = function () {
		verify_button.off();
		submit_button.off();
		screen.off();
		_parent.empty();
	};
	this.initialize = function () {
		Auth = classes.data.Auth;
		Func = classes.helpers.Func;
		Lang = classes.data.Lang;
		StageProxy = classes.StageProxy;
		render();
	};
};
