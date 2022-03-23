
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.components.formobjects.DateSelection = function () {
	
	/* "imported" classes
		*/
		
	var Func;
	var Lang;
	var StageProxy;
	
	/* private properites
		*/
		
	var _instance = 			this;
	var _label = 				"";
	var _puid = 				"";
	var _ingest = 				null;
	var _parent = 				null;
	var _uniquid = 				"";
	
	var _enabled = 				false;
	var _showtime = 			true;
	var _toggle = 				null;
	var _date = 				null;
	var _hour = 				null;
	var _minute = 				null;
	var _meridian = 			null;
	var _timezone = 			null;

	/* private methods
		*/
		
	function resize () {
		var sw = _parent.find(".DateSelection").outerWidth();
		var lw = 125;
		var rw = sw-lw-10;
		_date.outerWidth(rw);
		if (sw>480) {
			var lw = _hour.outerWidth() + _minute.outerWidth() + _meridian.outerWidth();
			var rw = sw-lw-21;
			_timezone.outerWidth(rw);
		} else {
			_timezone.outerWidth("100%");
		}
	}
	function toggle (e, active) {
		_enabled = active;
		if (active) {
			_date.show();
			_hour.show();
			_minute.show();
			_meridian.show();
			_timezone.show();
		} else {
			_date.hide();
			_hour.hide();
			_minute.hide();
			_meridian.hide();
			_timezone.hide();
		}
		if (_showtime==false) {
			_hour.hide();
			_minute.hide();
			_meridian.hide();
			_timezone.hide();
		}
		change();
	}
	function change () {
	
		var hour = parseInt(_hour.val(), 10);
		var minute = _showtime ? parseInt(_minute.val()) : 0;
		var meridian = _showtime ? _meridian.val() : "AM";
		
		if ( hour==12 && meridian=="PM" ) {
			hour = 12;
		} else if ( hour==12 && meridian=="AM" ) {
			hour = 0;
		} else {
			if ( meridian=="PM" ) {
				hour += 12;
			}
		}
		if (_showtime==false) {
			hour = 0;
		}
		var selected = _date.datepicker( "getDate" );
		var thedate = new Date(Date.UTC(selected.getFullYear(), selected.getMonth(), selected.getDate(), hour, minute, 0, 0));
		
		var timezone = _enabled ? _timezone.val() : "";
		var offset = _enabled ? _timezone.find(':selected').data('value') : "";
		var value = _enabled ? thedate.getTime() : "";
		
		_ingest._value = value;
		if (_showtime) {
			_ingest._attributes.timezone = timezone;
			_ingest._attributes.offset = offset;
		}
		_instance.dispatch("onChanged");
	}
	function getTimezoneProvider () {
		return [
			{label:"Etc/GMT+12", data:"-12:00"},
			{label:"Pacific/Pago_Pago", data:"-11:00"},
			{label:"America/Adak", data:"-11:00"},
			{label:"Pacific/Apia", data:"-11:00"},
			{label:"Pacific/Honolulu", data:"-10:00"},
			{label:"Pacific/Marquesas", data:"-10:30"},
			{label:"Pacific/Gambier", data:"-09:00"},
			{label:"America/Anchorage", data:"-09:00"},
			{label:"America/Los_Angeles", data:"-08:00"},
			{label:"Pacific/Pitcairn", data:"-08:00"},
			{label:"America/Phoenix", data:"-07:00"},
			{label:"America/Denver", data:"-07:00"},
			{label:"America/Guatemala", data:"-06:00"},
			{label:"America/Chicago", data:"-06:00"},
			{label:"Pacific/Easter", data:"-06:00"},
			{label:"America/Bogota", data:"-05:00"},
			{label:"America/New_York", data:"-05:00"},
			{label:"America/Caracas", data:"-04:30"},
			{label:"America/Halifax", data:"-04:00"},
			{label:"America/Santo_Domingo", data:"-04:00"},
			{label:"America/Asuncion", data:"-04:00"},
			{label:"America/St_Johns", data:"-03:30"},
			{label:"America/Godthab", data:"-03:00"},
			{label:"America/Argentina/Buenos_Aires", data:"-03:00"},
			{label:"America/Montevideo", data:"-03:00"},
			{label:"America/Noronha", data:"-02:00"},
			{label:"Etc/GMT+2", data:"-02:00"},
			{label:"Atlantic/Azores", data:"-01:00"},
			{label:"Atlantic/Cape_Verde", data:"-01:00"},
			{label:"Etc/UTC", data:"00:00"},
			{label:"Europe/London", data:"00:00"},
			{label:"Europe/Berlin", data:"+01:00"},
			{label:"Africa/Lagos", data:"+01:00"},
			{label:"Africa/Windhoek", data:"+01:00"},
			{label:"Asia/Beirut", data:"+02:00"},
			{label:"Africa/Johannesburg", data:"+02:00"},
			{label:"Europe/Moscow", data:"+03:00"},
			{label:"Asia/Baghdad", data:"+03:00"},
			{label:"Asia/Tehran", data:"+03:30"},
			{label:"Asia/Dubai", data:"+04:00"},
			{label:"Asia/Yerevan", data:"+04:00"},
			{label:"Asia/Kabul", data:"+04:30"},
			{label:"Asia/Yekaterinburg", data:"+05:00"},
			{label:"Asia/Karachi", data:"+05:00"},
			{label:"Asia/Kolkata", data:"+05:30"},
			{label:"Asia/Kathmandu", data:"+05:45"},
			{label:"Asia/Dhaka", data:"+06:00"},
			{label:"Asia/Omsk", data:"+06:00"},
			{label:"Asia/Rangoon", data:"+06:30"},
			{label:"Asia/Krasnoyarsk", data:"+07:00"},
			{label:"Asia/Jakarta", data:"+07:00"},
			{label:"Asia/Shanghai", data:"+08:00"},
			{label:"Asia/Irkutsk", data:"+08:00"},
			{label:"Australia/Eucla", data:"+08:45"},
			{label:"Australia/Eucla", data:"+08:45"},
			{label:"Asia/Yakutsk", data:"+09:00"},
			{label:"Asia/Tokyo", data:"+09:00"},
			{label:"Australia/Darwin", data:"+09:30"},
			{label:"Australia/Adelaide", data:"+09:30"},
			{label:"Australia/Brisbane", data:"+10:00"},
			{label:"Asia/Vladivostok", data:"+10:00"},
			{label:"Australia/Sydney", data:"+10:00"},
			{label:"Australia/Lord_Howe", data:"+10:30"},
			{label:"Asia/Kamchatka", data:"+11:00"},
			{label:"Pacific/Noumea", data:"+11:00"},
			{label:"Pacific/Norfolk", data:"+11:30"},
			{label:"Pacific/Auckland", data:"+12:00"},
			{label:"Pacific/Tarawa", data:"+12:00"},
			{label:"Pacific/Chatham", data:"+12:45"},
			{label:"Pacific/Tongatapu", data:"+13:00"},
			{label:"Pacific/Kiritimati", data:"+14:00"}
		];
	}
	function render () {
		
		_uniquid = "FO" + Func.uniquid();
		
		var now = new Date();
		var year_val = now.getFullYear();
		var month_val = now.getMonth() + 6;
		if (month_val>11) {
			++year_val;
			month_val -= 12;
		}
			month_val += 1;
			month_val = month_val<10 ? "0"+month_val : month_val;
		var day_val = now.getDate();
			day_val = day_val<10 ? "0"+day_val : day_val;
		var timezone_index = -1;
		var timezones = getTimezoneProvider();
		var timezone = _ingest._attributes.timezone;
		_showtime = timezone!=undefined;
		if (_ingest._attributes.time) {
			_showtime = _ingest._attributes.time=="true";
		}
		if ( timezone && timezone!="" ) {
			for (var i=0; i<timezones.length; ++i) {
				if (timezones[i].label==timezone) {
					timezone_index = i;
					break;
				}
			}
		}
		if (timezone_index==-1) {
			var system_offset = (now.getTimezoneOffset()/60)*-1;
			for (var i=0; i<timezones.length; ++i) {
				var offset = timezones[i].data;
					offset = offset.split(":");
					offset[0] = parseInt(offset[0], 10);
					offset[1] = (parseInt(offset[1], 10)/60)*100;
					offset = parseInt(offset.join("."), 10);
				if (offset==system_offset) {
					timezone_index = i;
					break;
				}
			}
		}
		
		var epochtime = parseInt(_ingest._value, 10);
		var hour_index = 12;
		var minute_index = 0;
		var meridian_index = 0;
		
		if ( isNaN(epochtime) || epochtime==0 ) {
		} else {
			var thedate = new Date(epochtime);
			year_val = thedate.getUTCFullYear();
			month_val = thedate.getUTCMonth();
				month_val += 1;
				month_val = month_val<10 ? "0"+month_val : month_val;
			day_val = thedate.getUTCDate();
				day_val = day_val<10 ? "0"+day_val : day_val;
			_enabled = true;
			var hours = thedate.getUTCHours();
				if (hours==0) hours = 12;
			hour_index = hours>12 ? (hours-12) : hours;
			minute_index = thedate.getUTCMinutes();
			meridian_index = thedate.getUTCHours()>=12 ? 1 : 0;
		}
		
		var value = year_val + "-" + month_val + "-" + day_val;
		
		var xhtml = '';
			xhtml += '<div id="' + _uniquid + '" class="FormObject DateSelection">';
			xhtml += 	'<div class="Label">' + _label + '</div>';
			xhtml += 	'<div class="toggle toggle-modern"></div>';
			xhtml += 	'<input class="Date" type="text" value="' + value + '" />';
			xhtml += 	'<div class="Clear"></div>';
			xhtml += 	'<select class="Hour">';
		for (var i=1; i<13; ++i) {
			xhtml += 		'<option ' + (i==hour_index?"selected":"") + ' value="' + i +'">' + (i<10?"0"+i:i) + '</option>';
		}
			xhtml += 	'</select>';
			xhtml += 	'<select class="Minute">';
		for (var i=0; i<59; ++i) {
			xhtml += 		'<option ' + (i==minute_index?"selected":"") + ' value="' + i +'">' + (i<10?"0"+i:i) + '</option>';
		}
			xhtml += 	'</select>';
			xhtml += 	'<select class="Meridian">';
			xhtml += 		'<option ' + (0==meridian_index?"selected":"") + ' value="AM">AM</option>';
			xhtml += 		'<option ' + (1==meridian_index?"selected":"") + ' value="PM">PM</option>';
			xhtml += 	'</select>';
			xhtml += 	'<select class="Timezone">';
		for (var i=0; i<timezones.length; ++i) {
			xhtml += 		'<option ' + (i==timezone_index?"selected":"") + ' data-value="' + timezones[i].data +'">' + timezones[i].label + '</option>';
		}
			xhtml += 	'</select>';
			xhtml += '</div>';
		_parent.append(xhtml);
		
		_toggle = _parent.find("#" + _uniquid + " .toggle");
		_date = _parent.find("#" + _uniquid + " .Date");
		_hour = _parent.find("#" + _uniquid + " .Hour");
		_minute = _parent.find("#" + _uniquid + " .Minute");
		_meridian = _parent.find("#" + _uniquid + " .Meridian");
		_timezone = _parent.find("#" + _uniquid + " .Timezone");
		
		_date.change(change);
		_hour.change(change);
		_minute.change(change);
		_meridian.change(change);
		_timezone.change(change);
		_date.datepicker({
			dateFormat: "yy-mm-dd"
		});
		
		_toggle.toggles({
			drag: false,
			click: true,
			text: {
				on: Lang.lookup("Enabled"),
				off: Lang.lookup("Disabled")
			},
			on: _enabled,
			width: 125,
			height: 40
		});
		_toggle.on('toggle', toggle);
		
		if (_showtime==false) {
			_hour.hide();
			_minute.hide();
			_meridian.hide();
			_timezone.hide();
		}
		
		if (_enabled==false) {
			_date.hide();
			_hour.hide();
			_minute.hide();
			_meridian.hide();
			_timezone.hide();
		}
		
		StageProxy.addEventListener("onResize", resize);
		resize();
		
	}
	/* public methods
		*/
	this.label = function (str) {
		if (str) {
			_label = str;
		}
		return _label;
	};
	this.parent = function (obj) {
		if (obj) {
			_parent = obj;
		}
		return _parent;
	};
	this.ingest = function (obj) {
		if (obj) {
			_ingest = obj;
		}
		return _ingest;
	};
	this.puid = function (str) {
		if (str) {
			_puid = str;
		}
		return _puid;
	};
	this.destroy = function () {
		_toggle.off();
		_date.off();
		_hour.off();
		_minute.off();
		_meridian.off();
		_timezone.off();
		try {
			_date.datepicker( "destroy" );
		}
		catch(err) {}
		if (_parent!=null) {
			_parent.empty();
		}
	};
	this.initialize = function () {
		StageProxy = classes.StageProxy;
		Func = classes.helpers.Func;
		Lang = classes.data.Lang;
		render();
	};
};

classes.components.formobjects.DateSelection.prototype = new EventDispatcher();
