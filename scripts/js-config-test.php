<?php

// Synthetic configuration only: no application bootstrap, database, or services.
class Func {
	public static function getBaseUrl() { return 'https://fixture.invalid/subdirectory'; }
}
class AppConfig {
	public static function adminConfig() { return ['setup' => ['product_title' => ['_value' => 'A "title" </script>']]]; }
}
class JsConfigDocument {
	public function __construct(private array $values) {}
	public function getNodeVal($path) { return $this->values[$path] ?? ''; }
	public function toArray() {
		return ['data' => [
			'_value' => '', '_attributes' => [],
			'general' => [
				'_value' => '', '_attributes' => [],
				'plain' => ['_value' => "Quotes ' \" \\ </script> café", '_attributes' => []],
				'lines' => ['_value' => "First\nSecond\r", '_attributes' => ['lines' => 'true']],
				'markdown' => ['_value' => "Owner's\n**text**", '_attributes' => ['markdown' => 'true']],
			],
		]];
	}
}
class JsConfigFixture {
	protected function getData($name) {
		return new JsConfigDocument([
			'data.settings.resampling_quality_num' => '87',
			'data.settings.resample_sharpen_bool' => 'true',
			'data.settings.resample_use_imagick_bool' => 'false',
			'data.watermarking.watermark_bool' => 'true',
			'data.watermarking.watermark_asset' => 'asset/owner.png',
			'data.watermarking.watermark_x_num' => '12.5',
			'data.watermarking.watermark_y_num' => '-4',
			'data.watermarking.watermark_alpha_num' => '75',
			'data.watermarking.crosshairs_bool' => 'false',
			'data.watermarking.crosshairs_color' => '0xABCDEF',
			'data.watermarking.crosshairs_alpha_num' => '25',
			'data.private.mail_password' => 'must-never-appear',
		]);
	}
	protected function doMarkdown($value) { return "<p>$value</p>\n"; }
	public function lookup($key) { return $key . "'\"</script>"; }
	public function render($type) {
		global $LANG;
		ob_start();
		include __DIR__ . '/../vend-proofing-core/tmpl/html/2.config-' . $type . '.tmpl';
		$html = ob_get_clean();
		if (substr_count($html, '</script>') !== 1) throw new RuntimeException('Unsafe script closing tag');
		if (str_contains($html, 'must-never-appear')) throw new RuntimeException('Private configuration leaked');
		preg_match('/window\.VEND_CONFIG = (.*);/', $html, $match);
		return json_decode($match[1], true, 512, JSON_THROW_ON_ERROR);
	}
}
function checkJs($condition, $message) {
	if (!$condition) throw new RuntimeException($message);
}
define('SA_NAMESPACE', 'vend-proofing');
$LANG = new JsConfigFixture();
$config = $LANG->render('storefront');
checkJs($config['namespace'] === 'vend-proofing', 'Namespace');
checkJs($config['baseUrl'] === Func::getBaseUrl(), 'Base URL');
checkJs($config['uri']['page'] === $LANG->lookup('uri_page_identifier'), 'Escaped URI label round trip');
checkJs($config['graphics']['quality'] === 87, 'Numeric quality');
checkJs($config['graphics']['sharpen'] === true && $config['graphics']['imagick'] === false, 'Boolean settings');
checkJs($config['graphics']['watermarkAsset'] === 'owner.png', 'Watermark basename');
checkJs($config['graphics']['watermarkX'] === 12.5 && $config['graphics']['watermarkY'] === -4, 'Numeric offsets');
checkJs($config['graphics']['crosshairsColor'] === 'abcdef', 'Crosshairs color');
checkJs($config['language']['general']['plain'] === htmlspecialchars("Quotes ' \" \\ </script> café", ENT_QUOTES), 'Escaped plain translation');
checkJs($config['language']['general']['lines'] === 'First<br />Second', 'Multiline translation');
checkJs($config['language']['general']['markdown'] === "<p>Owner's**text**</p>", 'Markdown translation');
checkJs(!isset($config['language']['general']['_value']), 'Internal language fields');
checkJs($LANG->render('admin')['adminConfig'] === AppConfig::adminConfig(), 'Admin config');
echo "PASS inline runtime configuration, typed settings, translations, escaping, and private-field exclusion\n";
