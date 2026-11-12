
/*jslint browser: true, continue: true, eqeq: true, plusplus: true, sloppy: true, vars: true, white: true */

// http://www.nonobtrusive.com/2009/07/24/custom-events-in-javascript-by-making-your-own-dispatcher-class/

function EventDispatcher() {
	this.events=[];
}
EventDispatcher.prototype.addEventListener = function(event, callback, caller) {
	this.events[event] = this.events[event] || [];
	if ( this.events[event] ) {
		this.events[event].push({
			callback : callback,
			caller : caller
		});
	}
};
EventDispatcher.prototype.removeEventListener = function(event, callback) {
	if ( this.events[event] ) {
		var listeners = this.events[event];
		var i;
		for ( i = listeners.length-1; i>=0; --i ){
			//console.log(listeners[i]);
			if ( listeners[i].callback === callback ) {
				listeners.splice( i, 1 );
				return true;
			}
		}
	}
	return false;
};
EventDispatcher.prototype.dispatch = function(event, data) {
	data = data || {};
	if(this.events[event]) {
		var listeners = this.events[event];
		var len = listeners.length;
		while(len--) {
			listeners[len].callback(data, listeners[len].caller);
		}
	}
};
