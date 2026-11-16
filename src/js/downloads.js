/* Invoice preparation stays browser-driven; a failed request waits for an explicit retry. */
(function ($) {
	var panel = $("#download-process");
	if (!panel.length) return;
	var config = JSON.parse(panel.attr("data-config"));
	var button = $("#download-button");
	var text = $("#download-text");

	function ready(action) {
		button.data("action", action).text(config.labels[action]).prop("disabled", false);
		text.text(config.hints[action]);
	}

	function request(action) {
		button.prop("disabled", true);
		function failed(message) {
			ready(action);
			text.text(message || config.error);
		}
		$.ajax({ url: config.url + action + "/", type: "POST", dataType: action === "reset" ? "text" : "json" })
			.done(function (result) {
				if (action === "reset") {
					if (result !== "1") { failed(); return; }
					button.text(config.sent);
					text.text(config.reply);
					return;
				}
				if (!result.success) { failed(result.error); return; }
				if (action === "start" || action === "next") {
					if (result.progress === 1) { ready("download"); return; }
					button.data("action", "next").text(config.processing);
					text.text(config.progress.split("{PERCENT}").join(Math.round((result.progress || 0) * 100)));
					setTimeout(function () { request("next"); }, 100);
				} else if (action === "download") {
					if (!result.links.length) { ready("reset"); return; }
					text.empty();
					result.links.forEach(function (url, index) {
						var label = config.link.split("{COUNT}").join(index + 1).split("{TOTAL}").join(result.links.length);
						$("<a>").attr({ href: url, target: "_blank", rel: "noopener" }).text(label).appendTo(text);
					});
				}
			}).fail(function () { failed(); });
	}

	button.on("click", function () { request(button.data("action")); });
})(jQuery);
