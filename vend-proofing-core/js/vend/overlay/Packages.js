
/*jslint browser: true, continue: true, eqeq: true, plusplus: true, sloppy: true, vars: true, white: true */

classes.overlay.Packages = (function () {
	function Constructor () {
		/* "imported" classes
			*/
		/* private properites
			*/
		var instance = 			this;
		var packages_packages = null;
		var packages_products = null;
		/* private methods
			*/
		function select (t, i, id) {
			var ui = t=="package" ? packages_packages : packages_products;
			$(".LineItem").removeClass("Active");
			$("#"+id).addClass("Active");
			instance.dispatch("onPackageSelected", { type:t, index:i, key:$("#"+id).data("value") });
		}
		function draw () {
			packages_packages = $("#packages-packages");
			packages_products = $("#packages-products");
			packages_packages.find(".LineItem").click(function () {
				select("package", $(this).index(), $(this).attr('id'));
			});
			packages_products.find(".LineItem").click(function () {
				select("product", $(this).index(), $(this).attr('id'));
			});
		}
		function render () {
			draw();
		}
		/* public methods
			*/
		this.initialize = function() {
			render();
		};
	}
	Constructor.prototype = new EventDispatcher();
	return new Constructor();
}());
