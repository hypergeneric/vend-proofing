/*! mousewheelStopPropagation.js v1.3.0
 * (c) 2014, Benoit Asselin contact(at)ab-d.fr
 * MIT License
 */
!function(a,b,c){"use strict";var d={duration:200,easing:"linear"};a.fn.mousewheelStopPropagation=function(b){function c(a){a.preventDefault(),a.stopPropagation(),"function"==typeof b.wheelstop&&b.wheelstop(a)}function e(a,c){b.emulateNaturalScrolling?a.stop(!0).animate({scrollTop:c},d):a.get(0).scrollTop=c}b=a.extend({wheelstop:null,emulateNaturalScrolling:!0},b);var f=navigator.userAgent.toLowerCase(),g=/(trident|msie)/.test(f),h=document.documentElement,i="mousewheel";return"onmousewheel"in h?i="mousewheel":"onwheel"in h?i="wheel":"DOMMouseScroll"in h&&(i="DOMMouseScroll"),i?this.each(function(){var b=this,d=a(b);d.on(i,function(a){var f=a.originalEvent,h=b.scrollTop,i=b.scrollHeight-d.outerHeight(),j=-f.wheelDelta;isNaN(j)&&(j=f.deltaY);var k=0>j;k&&0>=h||!k&&h>=i?c(a):g&&(k&&-j>h?(e(d,0),c(a)):!k&&j>i-h&&(e(d,i),c(a)))})}):this}}(jQuery,window);

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