classes.panels.OrderStats = function () {
	
	/* "imported" classes
		*/
		
	var Admin;
	var SetList;
	var SiteBar;
	var Func;
	var Dialog;
	var Lang;
	var Auth;
	
	/* private properites
		*/
		
	var _instance = 			this;
	var _panel = 				null;
	var _controller = 			null;
	var _uniquid = 				"FO" + classes.helpers.Func.uniquid();
	
	var _breakdown_table = 		null;
	var _tax_table = 			null;
	var _obj_checks = 			null;
	var _obj_graph = 			null;
	var _obj_search = 			null;
	var _obj_start = 			null;
	var _obj_end = 				null;
	
	var _search_range = 		{ start:"", end:"" };
	var _breakdown = 			[];
	var _graph_array = 			[];
	var _graph_max = 			0;

	/* private methods
		*/
		
	function searchClick () {
		if ( $(this).hasClass("Disabled") ) return;
		_obj_search.addClass("Disabled");
		loadStatsData();
	}
	
	function datechange () {
		var changed = false;
		_obj_search.addClass("Disabled");
		var value = $(this).datepicker( "getDate" );
			var year = value.getFullYear();
			var month = value.getMonth();
			var day = value.getDate();
		if ( $(this).is(_obj_start) ) {
			var datestr = year + "/" + (month+1) + "/" + day;
			if ( datestr!=_search_range.start ) {
				changed = true;
				_search_range.start = datestr;
			}
		} else if ( $(this).is(_obj_end) ) {
			var datestr = year + "/" + (month+1) + "/" + day;
			if ( datestr!=_search_range.end ) {
				changed = true;
				_search_range.end = datestr;
			}
		}
		if ( changed ) {
			_obj_search.removeClass("Disabled");
		}
	}

	function onDataLoaded (success, data) {
		/* manage the tab panel
			*/
		_panel.screen(false);
		/*
			parse it all out
			*/
		_breakdown = [{
				name: "Subtotal",
				value: 0
			},{
				name: "Discount",
				value: 0
			},{
				name: "Shipping",
				value: 0
			},{
				name: "Handling",
				value: 0
			},{
				name: "Tax GST VAT",
				value: 0
			},{
				name: "Gross Sales",
				value: 0
			},{
				name: "Net Profit",
				value: 0
		}];
		var tax_lookup = {};
		var graph_lookup = {};
		var lines = !data || data=="" ? [] : data.split("\n");
		for (var i=0; i<lines.length; ++i) {
			var line = lines[i];
			var values = line.split("\t");
				var timestamp = values[0];
					timestamp_clean = timestamp.split("/").join("_");
				var region = values[1]
				var subtotal = Number(values[3]);
					subtotal = isNaN(subtotal) ? 0 : subtotal;
				var discount = Number(values[4]);
					discount = isNaN(discount) ? 0 : discount;
				var shipping = Number(values[5]);
					shipping = isNaN(shipping) ? 0 : shipping;
				var handling = Number(values[6]);
					handling = isNaN(handling) ? 0 : handling;
				var tax = Number(values[7]);
					tax = isNaN(tax) ? 0 : tax;
				var gross = Number(values[2]);
					gross = isNaN(gross) ? 0 : gross;
				var net = subtotal-discount;
			// do the breakdown table
			_breakdown[0].value += subtotal;
			_breakdown[1].value += discount;
			_breakdown[2].value += shipping;
			_breakdown[3].value += handling;
			_breakdown[4].value += tax;
			_breakdown[5].value += gross;
			_breakdown[6].value += net;
			// do the tax table
			if (!tax_lookup[region]) {
				tax_lookup[region] = 0;
			}
			tax_lookup[region] += tax;
			// do the graph stuff
			if (!graph_lookup[timestamp_clean]) {
				graph_lookup[timestamp_clean] = [0, 0, 0, 0, 0, 0, 0, 0];
			}
			graph_lookup[timestamp_clean][1] += subtotal;
			graph_lookup[timestamp_clean][2] += discount;
			graph_lookup[timestamp_clean][3] += shipping;
			graph_lookup[timestamp_clean][4] += handling;
			graph_lookup[timestamp_clean][5] += tax;
			graph_lookup[timestamp_clean][6] += gross;
			graph_lookup[timestamp_clean][7] += net;
		}
		_breakdown[1].value *= -1;
		/* clear the table, add new rows, then redraw
			*/
		_breakdown_table.clear();
		_breakdown_table.rows.add(_breakdown);
		_breakdown_table.draw(false);
		/*
			parse it all out again for taxes
			*/
		var tax_list = [];
		for (var region in tax_lookup) {
			tax_list.push({
				region: region,
				value: tax_lookup[region]
			});
		}
		/* clear the table, add new rows, then redraw
			*/
		_tax_table.clear();
		_tax_table.rows.add(tax_list);
		_tax_table.draw(false);
		/* clear the table, add new rows, then redraw
			*/
		_graph_array = [];
		_graph_max = 0;
		for (var timestamp_clean in graph_lookup) {
			var timestamp_bits = timestamp_clean.split("_");
			var timestamp_date = new Date(timestamp_bits[0], timestamp_bits[1]-1, timestamp_bits[2]);
			var day_arr = graph_lookup[timestamp_clean];
			for (var i=0; i<day_arr.length; ++i) {
				if (day_arr[i]>_graph_max) _graph_max = day_arr[i];
			}
			day_arr[0] = timestamp_date;
			_graph_array.push(day_arr);
		}
		_graph_max = _graph_max*1.1;
		drawGraph();
	}
	
	function drawGraph () {
		/* clear out the overlay
			*/
		var overlay = _obj_graph.find(".Overlay");
			overlay.empty();
		/* draw up the graph scales
			*/
		var thirdsindex = Math.round(_graph_array.length/3);
		var twothirdsindex = Math.round((_graph_array.length/3)*2);
		var dateleft = (_graph_array[0][0].getMonth()+1) + "/" + _graph_array[0][0].getDate() + "/" + _graph_array[0][0].getFullYear();
		var date3 = (_graph_array[thirdsindex][0].getMonth()+1) + "/" + _graph_array[thirdsindex][0].getDate() + "/" + _graph_array[thirdsindex][0].getFullYear();
		var date23 = (_graph_array[twothirdsindex][0].getMonth()+1) + "/" + _graph_array[twothirdsindex][0].getDate() + "/" + _graph_array[twothirdsindex][0].getFullYear();
		var TL = _obj_graph.find(".TL");
			TL.html(Math.round((_graph_max/3)*2));
		var CL = _obj_graph.find(".CL");
			CL.html(Math.round(_graph_max/3));
		var BL = _obj_graph.find(".BL");
			BL.html(dateleft);
		var BC = _obj_graph.find(".BC");
			BC.html(date3);
		var BR = _obj_graph.find(".BR");
			BR.html(date23);
		/* redraw the graph lines
			*/
		var lines = _obj_graph.find(".Lines");
			lines.empty();
		var width = Math.max(_graph_array.length, _obj_graph.width());
		var height = 197;
		var xstep = width/_graph_array.length;
		var graphs = ["statgraph-subtotal", "statgraph-discount", "statgraph-shipping", "statgraph-handling", "statgraph-tax", "statgraph-gross", "statgraph-net"];
		var colors = ["#000000", "#660066", "#33CC00", "#33CC00", "#FFCC00", "#0033FF", "#CC0000"];
		var ratio = height/_graph_max;
		for (var i=0; i<graphs.length; ++i) {
			var canvas = $('<canvas/>', { id: graphs[i] }).prop({ width: width, height: height });
			lines.append(canvas);
			var canvas = document.getElementById(graphs[i]);
			var context = canvas.getContext('2d');
			context.strokeStyle = colors[i];
			context.lineWidth = 2;
			context.beginPath();
			var xpos = 0;
			for (var j=0; j<_graph_array.length; ++j) {
				var column = _graph_array[j];
				var ypos = column[(i+1)];
					ypos = height-(ypos*ratio)-1;
				if (j==0) context.moveTo(xpos, ypos);
				context.lineTo(xpos, ypos);
				xpos += xstep;
			}
			context.stroke();
		}
		/* redraw the graph lines
			*/
		updateVisiblegraphs();
		
		/* we will do this another time
		// draw the hotspots
		var colwidth = 901/(columns.length-1);
		graph_display.overlay.createMovieClip("hotspots", null, 0, 0, MCV001.id);
		graph_display.overlay.hotspots._x = 0;
		graph_display.overlay.hotspots._x -= colwidth/2;
		for (var i=0; i<columns.length; ++i) {
			var column = columns[i];
			var hotspot = graph_display.overlay.hotspots.createMovieClip("hotspot"+i, null, i*colwidth, -1, Box.id, {
				_alpha: 0,
				width: colwidth,
				height: 202,
				linetype: [1, 0xcccccc, 100],
				filltype: [0xffffff, 100]
			});
			if (i==0) {
				hotspot._width = (colwidth/2)+1;
				hotspot._x += (colwidth/2)-1;
			}
			if (i==columns.length-1) {
				hotspot._width = (colwidth/2)+1;
			}
			hotspot.tiptext = column[0].getMonth() + "/" + column[0].getDate() + "/" + column[0].getFullYear();
			hotspot.breakdown = [{
				name: "stats subtotal",
				value: column[1]
			},{
				name: "stats discount",
				value: column[2]*-1
			},{
				name: "stats shipping",
				value: column[3]
			},{
				name: "stats handling",
				value: column[4]
			},{
				name: "stats tax",
				value: column[5]
			},{
				name: "stats gross",
				value: column[6]
			},{
				name: "stats net",
				value: column[7]
			}]
			hotspot.onRollOver = hotspot.onDragOver = function () {
				instance.breakdown_display.provider = this.breakdown;
				OrderPane.createToolTip(this.tiptext);
				this._alpha = 100;
			}
			hotspot.onRollOut = hotspot.onDragOut = function () {
				instance.breakdown_display.provider = instance.breakdown;
				OrderPane.killToolTip();
				this._alpha = 0;
			}
		}
		*/
	}
	
	function updateVisiblegraphs () {
		_obj_checks.each(function () {
			var checked = $(this).prop("checked");
			var key = $(this).data("key");
			if ( checked ) {
				$( "#"+key ).show();
			} else {
				$( "#"+key ).hide();
			}
		});
	}
	
	function loadStatsData () {
		_panel.screen(true);
		Auth.send(this, onDataLoaded, {
			action: "order_stats_search",
			start: _search_range.start,
			end: _search_range.end
		});
	}
	
	function resize () {
		drawGraph();
	}
	
	function render () {
		
		var today = new Date();
			var year = today.getFullYear();
			var month = today.getMonth();
			var day = today.getDate();
		var todayclean = new Date(year, month, day+1, 0, 0, 0, 0);
			var year = todayclean.getFullYear();
			var month = todayclean.getMonth();
			var day = todayclean.getDate();
		_search_range.end = year + "/" + (month+1) + "/" + day;
		var monthago = new Date(year, month, day-30, 0, 0, 0, 0);
			var year = monthago.getFullYear();
			var month = monthago.getMonth();
			var day = monthago.getDate();
		_search_range.start = (year) + "/" + (month+1) + "/" + day;
		
		var parent = _panel.body();
		var xhtml = '';
			xhtml += '<div id="' + _uniquid + '" class="StatsPanel">';
			xhtml += 	'<div class="Toolbar">';
			xhtml += 		'<div class="DateSelect Start"><label>' + Lang.lookup("Choose Start Date") + '</label><input type="input" value="' + _search_range.start + '" /></div>';
			xhtml += 		'<div class="DateSelect End"><label>' + Lang.lookup("Choose End Date") + '</label><input type="input" value="' + _search_range.end + '" /></div>';
			xhtml += 		'<div class="Button Disabled Search"><span class="glyphicon glyphicon-search" aria-hidden="true"></span> ' + Lang.lookup("Search") + '</div>';
			xhtml += 		'<div class="Clear"></div>';
			xhtml += 	'</div>';
			xhtml += 	'<div class="GraphWrapper">';
			xhtml += 		'<div class="Graph">';
			xhtml += 			'<div class="Underlay">';
			xhtml += 				'<table><tbody><tr>';
			xhtml += 					'<td class="TL">&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>';
			xhtml += 				'</tr><tr>';
			xhtml += 					'<td class="CL">&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>';
			xhtml += 				'</tr><tr>';
			xhtml += 					'<td class="BL">&nbsp;</td><td class="BC">&nbsp;</td><td class="BR">&nbsp;</td>';
			xhtml += 				'</tr></tbody></table>';
			xhtml += 			'</div>';
			xhtml += 			'<div class="Overlay"></div>';
			xhtml += 			'<div class="Lines"></div>';
			xhtml += 		'</div>';
			xhtml += 		'<div class="Options">';
			xhtml += 			'<div class="Check"><input data-key="statgraph-subtotal" type="checkbox" />&nbsp;&nbsp;' + Lang.lookup("Cart Total") + '</div>';
			xhtml += 			'<div class="Check"><input data-key="statgraph-discount" type="checkbox" />&nbsp;&nbsp;' + Lang.lookup("Discount") + '</div>';
			xhtml += 			'<div class="Check"><input data-key="statgraph-shipping" type="checkbox" />&nbsp;&nbsp;' + Lang.lookup("Shipping") + '</div>';
			xhtml += 			'<div class="Check"><input data-key="statgraph-handling" type="checkbox" />&nbsp;&nbsp;' + Lang.lookup("Handling") + '</div>';
			xhtml += 			'<div class="Check"><input data-key="statgraph-tax" type="checkbox" />&nbsp;&nbsp;' + Lang.lookup("Tax GST VAT") + '</div>';
			xhtml += 			'<div class="Check"><input data-key="statgraph-gross" type="checkbox" />&nbsp;&nbsp;' + Lang.lookup("Gross Sales") + '</div>';
			xhtml += 			'<div class="Check"><input data-key="statgraph-net" type="checkbox" checked />&nbsp;&nbsp;' + Lang.lookup("Net Profit") + '</div>';
			xhtml += 			'<div class="Clear"></div>';
			xhtml += 		'</div>';
			xhtml += 	'</div>';
			xhtml += 	'<div class="Clear"></div>';
			xhtml += 	'<div class="Left">';
			xhtml += 		'<table class="table table-striped table-bordered" width="100%" cellspacing="0"></table>';
			xhtml += 	'</div>';
			xhtml += 	'<div class="Right">';
			xhtml += 		'<table class="table table-striped table-bordered" width="100%" cellspacing="0"></table>';
			xhtml += 	'</div>';
			xhtml += 	'<div class="Clear"></div>';
			xhtml += '</div>';
		parent.html(xhtml);
		
		_obj_graph = parent.find("#" + _uniquid + " .Graph");
		_obj_search = parent.find("#" + _uniquid + " .Search");
		_obj_start = parent.find("#" + _uniquid + " .Start input");
		_obj_end = parent.find("#" + _uniquid + " .End input");
		_obj_checks = parent.find("#" + _uniquid + " .Check input");
		
		_obj_search.click(searchClick);
		_obj_start.change(datechange);
		_obj_end.change(datechange);
		_obj_checks.change(updateVisiblegraphs);
		
		_obj_start.datepicker({
			dateFormat: 'yy/mm/dd',
			changeMonth: true,
			changeYear: true
		});
		_obj_end.datepicker({
			dateFormat: 'yy/mm/dd',
			changeMonth: true,
			changeYear: true
		});
		
		/* create the datatable
			*/
		_breakdown_table = $('#' + _uniquid + " .Left table").DataTable( {
			searching: false,
			ordering: false,
			paging: false,
			info: false,
			responsive: {
				details: false
			},
			data: [],
			columns: [
				{
					title: "",
					data: "name"	
				},{
					title: Lang.lookup("Subtotal"),
					data: "value",
					width: "33%",
					render: function ( data, type, row ) {
						data = Number(data);
						if ( isNaN(data) ) data = 0;
						return Func.toFixed(data, 2);
					}	
				}
			]
		});
		_tax_table = $('#' + _uniquid + " .Right table").DataTable( {
			searching: false,
			ordering: false,
			paging: false,
			info: false,
			responsive: {
				details: false
			},
			data: [],
			columns: [
				{
					title: Lang.lookup("Tax Region"),
					data: "region"	
				},{
					title: Lang.lookup("Total Collected"),
					data: "value",
					width: "33%",
					render: function ( data, type, row ) {
						data = Number(data);
						if ( isNaN(data) ) data = 0;
						return Func.toFixed(data, 2);
					}	
				}
			]
		});
		
		/* start up our dataset
			*/
		loadStatsData();
		
		/* listen for stage events
			*/
		StageProxy.addEventListener("onResize", resize);

	}
	
	/* public methods
		*/
		
	this.option = function (key) {
		doOption(key);
	};
	this.panel = function (obj) {
		_panel = obj;
	};
	this.controller = function (obj) {
		_controller = obj;
	};
	this.destroy = function () {
		_obj_checks.off();
		_obj_search.off();
		_obj_start.datepicker( "destroy" );
		_obj_end.datepicker( "destroy" );
		_obj_start.off();
		_obj_end.off();
		_breakdown_table.destroy(true);
		_tax_table.destroy(true);
		StageProxy.removeEventListener("onResize", resize);
	};
	this.initialize = function () {
		Admin = classes.Admin;
		Auth = classes.data.Auth;
		Lang = classes.data.Lang;
		Dialog = classes.components.Dialog;
		Func = classes.helpers.Func;
		SetList = classes.components.SetList;
		SiteBar = classes.components.SiteBar;
		StageProxy = classes.StageProxy;
		render();
	};
	
};

classes.panels.OrderStats.prototype = new EventDispatcher();