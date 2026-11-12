$.fn.progress = function(kill) {
	this.each(function() {
		var $this = $(this),
			data = $this.data(),
			opts = {
				lines: 12,
				length: 5,
				width: 2,
				radius: 5,
				corners: .5,
				rotate: 2,
				color: $this.css('color')
			};
		if (data.spinner) {
			data.spinner.stop();
			delete data.spinner;
			if (kill===true) return;
		}
		if (kill===true) return;
		data.spinner = new Spinner(opts).spin(this);
	});
	return this;
};