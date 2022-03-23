
/*jslint browser: true, continue: true, eqeq: true, evil: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.dialogs.ImageSort = function () {
	
	/* "imported" classes
		*/
		
	var StageProxy;
	var Func;
	var Lang;
	var Auth;
	var Cookie;
	var Dialog;
	
	/* private properites
		*/
		
	var _instance = 		this;
	var _parent = 			null;
	var _innerheight = 		100;
	
	var _key = 				"asset";
	var _suid = 			"";
	var _provider = 		[];
	var _positions = 		[];
	var _last_pressed =	 	null;
	var _index_array = 		[];
	var _selected = 		[];
	var _selection_start = 	-1;
	var _selection_end = 	-1;
	var _drop_index = 		-1;
	var _shifted = 			false;
	var _dragger = 			null;
	
	var _dragimages = 		null;
	var _imagegrid = 		null;
	var _btn_alphaasc = 	null;
	var _btn_alphadesc = 	null;
	var _btn_randomize = 	null;

	/* private methods
		*/
		
	function sortAscending () {
		_positions.sort(function(a, b){
			var nameA=a.filename, nameB=b.filename;
			if (nameA < nameB) return -1
			if (nameA > nameB) return 1
			return 0;
		})
		for (var i=0; i<_positions.length; ++i) {
			_positions[i].newindex = i;
			_positions[i].finalindexes[1] = _index_array[i];
		}
		_selection_start = -1;
		_selection_end = -1;
		_drop_index = -1;
		setSelected();
		updateView();
	}
	function sortDescending () {
		_positions.sort(function(a, b){
			var nameA=a.filename, nameB=b.filename;
			if (nameA < nameB) return 1
			if (nameA > nameB) return -1
			return 0;
		})
		for (var i=0; i<_positions.length; ++i) {
			_positions[i].newindex = i;
			_positions[i].finalindexes[1] = _index_array[i];
		}
		_selection_start = -1;
		_selection_end = -1;
		_drop_index = -1;
		setSelected();
		updateView();
	}
	function randomize () {
		var len = _positions.length;
		var rand, temp, i;
		for (i=0; i<len; i++) {
			rand = Math.floor(Math.random() * len);
			temp = _positions[i];
			_positions[i] = _positions[rand];
			_positions[rand] = temp;
		}
		for (var i=0; i<_positions.length; ++i) {
			_positions[i].newindex = i;
			_positions[i].finalindexes[1] = _index_array[i];
		}
		_selection_start = -1;
		_selection_end = -1;
		_drop_index = -1;
		setSelected();
		updateView();
	}
	
	function setSelected () {
		for (var i=0; i<_positions.length; ++i) {
			var item = _positions[i];
			var obj = $(item.id);
			obj.find(".RollOver").hide();
		}
		_selected = new Array();
		if (_selection_start==-1||_selection_end==-1) {
			return;
		}
		if (_selection_start>_selection_end) {
			var temp = _selection_start;
			_selection_start = _selection_end;
			_selection_end = temp;
		}
		for (var i=_selection_start; i<=_selection_end; ++i) {
			var item = _positions[i];
			var obj = $(item.id);
			obj.find(".RollOver").show();
			_selected.push(item);
		}
	}
	function updateView () {
		for (var i=0; i<_positions.length; ++i) {
			var item = _positions[i];
			var obj = $(item.id);
			_imagegrid.append(obj);
		}
	}
	
	function getItemById (id) {
		for (var i=0; i<_positions.length; ++i) {
			var item = _positions[i];
			if (item.id=="#"+id) {
				return item;
			}
		}
	}
	function mousedown () {
		var item = getItemById($(this).attr("id"));
		_last_pressed = item.newindex;
	}
	function onclick () {
		var item = getItemById($(this).attr("id"));
		if (_shifted) {
			_selection_end = item.newindex;
			setSelected();
		} else {
			if ( _selection_start==item.newindex && _selection_end==item.newindex ) {
				_selection_start = -1;
				_selection_end = -1;
			} else {
				_selection_start = item.newindex;
				_selection_end = item.newindex;
			}
			setSelected();
		}
	}
	function drawHelper () {
		var xhtml = '<div id="ImageSortHelper">';
		if (_selected.length==0) {
			_selection_start = _last_pressed;
			_selection_end = _last_pressed;
			setSelected();
		}
		for (var i=0; i<_selected.length; ++i) {
			var item = _selected[i];
			var obj = $(item.id);
			obj.css("opacity", .25);
			var opacity = 50 - (i*5);
			if (opacity>0) {
				xhtml += '<div style="opacity:' + opacity/100 + '" class="DragImage">';
				xhtml += 	'<img src="' + item.imagepath + '" width="100" height="100" />';
				xhtml += '</div>';
			}
		}
		xhtml += '</div>';
		return xhtml;
	}
	function dropOver () {
		$(this).find(".Highlight").show();
	}
	function dropOut () {
		$(this).find(".Highlight").hide();
	}
	function drop () {
		$(this).find(".Highlight").hide();
		var item = getItemById($(this).attr("id"));
		_drop_index = item.newindex;
		if (_drop_index>=_selection_start-1&&_drop_index<=_selection_end) {
			_drop_index = -1;
		}
		if (_drop_index>-1) {
			if (_drop_index<=_selection_start) {
				var selection = _positions.splice(_selection_start, _selected.length);
				Array.prototype.splice.apply(_positions, [_drop_index+1, 0].concat(selection));
				_selection_start = _drop_index+1;
				_selection_end = _drop_index+_selected.length;
			} else {
				Array.prototype.splice.apply(_positions, [_drop_index+1, 0].concat(_selected));
				_positions.splice(_selection_start, _selected.length);
				_selection_start = _drop_index-_selected.length+1;
				_selection_end = _selection_start+_selected.length-1;
			}
			for (var i=0; i<_positions.length; ++i) {
				_positions[i].newindex = i;
				_positions[i].finalindexes[1] = _index_array[i];
			}
			_selection_start = -1;
			_selection_end = -1;
			_drop_index = -1;
			setSelected();
			updateView();
		}
	}
	function dragStop () {
		_dragimages.css("opacity", 1);
	}
	
	function render () {
		
		_positions = new Array();
		_index_array = new Array();
		
		var xhtml = '';
			xhtml += '<div class="DialogForm ImageSort">';
			xhtml += 	'<div class="Submit">';
			xhtml += 		'<input type="submit" class="AlphaASC" value="' + Lang.lookup("Sort Alphabetically ASC") + '" />';
			xhtml += 	'</div>'
			xhtml += 	'<div class="Submit">';
			xhtml += 		'<input type="submit" class="AlphaDESC" value="' + Lang.lookup("Sort Alphabetically DESC") + '" />';
			xhtml += 	'</div>'
			xhtml += 	'<div class="Submit">';
			xhtml += 		'<input type="submit" class="Randomize" value="' + Lang.lookup("Randomize") + '" />';
			xhtml += 	'</div>'
			xhtml += 	'<div class="Info">';
			xhtml += 		Lang.lookup("Shift Click to Select Multiple Images");
			xhtml += 	'</div>'
			xhtml += 	'<div class="ImageGrid">';
		for (var i=0; i<_provider.length; ++i) {
			var obj = _provider[i];
			var ext = obj.filename.split(".").pop().toLowerCase();
			var URI = Auth.basepath() + NAMESPACE + "-resample.php?q=";
				var query = "";
				query += (_suid==""?_key:_suid) + ":" + obj.filename + ((ext=="flv"||ext=="mp4")?".snapshot.jpg":"") + ":"; // the folder:file combo
				query += 100 + ":"; // the width
				query += 100 + ":"; // the height
				query += 1; // the thumbnail it
				query = escape(query);
			_index_array.push(obj.index);
			var item = {
				id: '#drag-img-' + i,
				imagepath: URI+query,
				filename: obj.filename,
				index: i,
				newindex: i,
				finalindexes: [obj.index, obj.index]
			}
			_positions.push(item);
			xhtml += 		'<div class="DragImage" id="drag-img-' + i + '">';
			xhtml += 			'<div class="Highlight"></div>';
			xhtml += 			'<div class="RollOver"></div>';
			xhtml += 			'<img src="' + URI+query + '" width="100" height="100" />';
			xhtml += 		'</div>'
		}
			xhtml += 	'</div>'
			xhtml += '</div>';
			
		_parent.html(xhtml);
		
		_imagegrid = _parent.find('.ImageGrid');
		_dragimages = _parent.find('.DragImage');
		
		_imagegrid.height(_innerheight);
		
		_btn_alphaasc = _parent.find('.AlphaASC');
		_btn_alphadesc = _parent.find('.AlphaDESC');
		_btn_randomize = _parent.find('.Randomize');
		
		_dragimages.draggable({
			appendTo: $('.ImageGrid'),
			containment: _imagegrid,
			revert: "invalid",
			revertDuration: 200,
			helper: drawHelper,
			stop: dragStop
		});
		_dragimages.droppable({
			tolerance: "pointer",
			out: dropOut,
			over: dropOver,
			drop: drop
		});
		_dragimages.mousedown(mousedown);
		_dragimages.click(onclick);
		
		_btn_alphaasc.click(sortAscending);
		_btn_alphadesc.click(sortDescending);
		_btn_randomize.click(randomize);
		$(document).on('keyup keydown', function(e){ 
			_shifted = e.shiftKey;
		});

	}
	
	/* public methods
		*/
		
	this.provider = function (arr) {
		if (arr) {
			_provider = arr;
		}
		return _provider;
	};
	this.suid = function (str) {
		if (str) {
			_suid = str;
		}
		return _suid;
	};
	this.key = function (str) {
		if (str) {
			_key = str;
		}
		return _key;
	};
	this.indices = function () {
		var result = new Array();
		for (var i=0; i<_positions.length; ++i) {
			result.push(_positions[i].finalindexes);
		}
		return result;
	};
	this.parent = function (obj) {
		_parent = obj;
	};
	this.resize = function () {
		_innerheight = _parent.height() - 80 - 20;
		_imagegrid.height(_innerheight);
	};
	this.destroy = function () {
		_btn_alphaasc.off();
		_btn_alphadesc.off();
		_btn_randomize.off();
		_dragimages.off();
		_dragimages.draggable( "destroy" );
		_dragimages.droppable( "destroy" );
		$(document).off('keyup keydown');
		_parent.empty();
	};
	this.initialize = function (obj) {
		Dialog = classes.components.Dialog;
		Auth = classes.data.Auth;
		Cookie = classes.helpers.Cookie;
		Func = classes.helpers.Func;
		Lang = classes.data.Lang;
		StageProxy = classes.StageProxy;
		for (var prop in obj) {
			this[prop](obj[prop]);
		}
		render();
	};
	
};
