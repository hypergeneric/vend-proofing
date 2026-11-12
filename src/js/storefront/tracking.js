$(document).ready(function() {
	
	if (typeof fbq == 'function') { 
		fbq('track', 'PageView');
	}
	if (typeof ga == 'function') { 
		ga('set', 'page', document.location);
		ga('send', 'pageview');
	}
	
});
