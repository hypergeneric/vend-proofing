<?php

// Synthetic theme settings only; no bootstrap, database, or integration services.
class CssThemeFixture {
	public function __construct(private array $settings) {}

	protected function getTypedValue($type, $group, $key) {
		return $this->settings[$key];
	}

	protected function unpackFont($asset, $fallback) {
		if ($asset['source'] === '') return $fallback;
		echo '@font-face { font-family: "fixture"; src: url("fixture.woff"); }';
		return '"fixture", ' . $fallback;
	}

	public function render() {
		ob_start();
		include __DIR__ . '/../vend-proofing-core/tmpl/html/2.theme.tmpl';
		return ob_get_clean();
	}
}

function checkCss($condition, $message) {
	if (!$condition) throw new RuntimeException($message);
}

define('SA_NAMESPACE', 'vend-proofing');
$build = __DIR__ . '/../vend-proofing-core/css/';
$required = [];
foreach (glob($build . '*.css') as $file) {
	$css = file_get_contents($file);
	checkCss(!str_contains($css, '<?'), 'PHP in static stylesheet: ' . $file);
	preg_match_all('/var\((--vend-[a-z0-9-]+)\)/', $css, $matches);
	$required = array_merge($required, $matches[1]);
	$map = json_decode(file_get_contents($file . '.map'), true, 512, JSON_THROW_ON_ERROR);
	foreach ($map['sources'] as $source) {
		checkCss(is_file($build . $source), 'Missing source-map target: ' . $source);
	}
}

$count = 0;
foreach (['light', 'dark'] as $theme) {
	foreach ([0, 30] as $scale) {
		foreach ([false, true] as $print) {
			foreach (['sans', 'serif'] as $font) {
				foreach (['', 'fixture.woff'] as $fontSource) {
					$fixture = new CssThemeFixture([
						'color_theme' => $theme, 'font_size_scale_num' => $scale,
						'font_style' => $font, 'font_asset' => ['source' => $fontSource],
						'invoice_logo_asset' => ['width' => 303, 'height' => 153],
						'splash_logo_margin_num' => 17, 'tile_gutter_width_num' => 9,
						'highlight_color' => ['css' => '#336699', 'value' => '336699'],
						'orderview_print_images_bool' => $print,
					]);
					$html = $fixture->render();
					foreach (array_unique($required) as $property) {
						checkCss(str_contains($html, $property . ':'), 'Undefined property: ' . $property);
					}
					$background = $theme === 'light' ? '#FFF' : '#000';
					$fontSize = 14 * (1 + $scale / 200);
					checkCss(str_contains($html, '--vend-background-color: ' . $background . ';'), 'Theme color');
					checkCss(str_contains($html, '--vend-font-size-14: ' . $fontSize . 'px;'), 'Font scaling');
					checkCss(str_contains($html, '--vend-invoice-logo-width: 101px;'), 'Invoice width');
					checkCss(str_contains($html, '--vend-invoice-logo-height: 51px;'), 'Invoice height');
					checkCss(str_contains($html, '--vend-print-images-display: ' . ($print ? 'block' : 'none') . ';'), 'Print setting');
					checkCss(str_contains($html, '@font-face') === ($fontSource !== ''), 'Custom font');
					checkCss(str_contains($html, '-gateway.php?action=image_colorize&image=vend-icon-sprite.png'), 'Sprite URL');
					$count++;
				}
			}
		}
	}
}
echo "PASS $count synthetic theme combinations, static CSS, and source-map targets\n";
