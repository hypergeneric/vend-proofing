<?php

	class Func {

		protected static function nomalizeServerVars() {
			$default_server_values = array(
				'SERVER_SOFTWARE' => '',
				'REQUEST_URI' => ''
			);
			$_SERVER = array_merge( $default_server_values, $_SERVER );
			// Fix for IIS when running with PHP ISAPI
			if ( empty( $_SERVER['REQUEST_URI'] ) || ( php_sapi_name() != 'cgi-fcgi' && preg_match( '/^Microsoft-IIS\//', $_SERVER['SERVER_SOFTWARE'] ) ) ) {
				// IIS Mod-Rewrite
				if ( isset( $_SERVER['HTTP_X_ORIGINAL_URL'] ) ) {
					$_SERVER['REQUEST_URI'] = $_SERVER['HTTP_X_ORIGINAL_URL'];
				}
				// IIS Isapi_Rewrite
				else if ( isset( $_SERVER['HTTP_X_REWRITE_URL'] ) ) {
					$_SERVER['REQUEST_URI'] = $_SERVER['HTTP_X_REWRITE_URL'];
				} else {
					// Use ORIG_PATH_INFO if there is no PATH_INFO
					if ( !isset( $_SERVER['PATH_INFO'] ) && isset( $_SERVER['ORIG_PATH_INFO'] ) )
						$_SERVER['PATH_INFO'] = $_SERVER['ORIG_PATH_INFO'];
					// Some IIS + PHP configurations puts the script-name in the path-info (No need to append it twice)
					if ( isset( $_SERVER['PATH_INFO'] ) ) {
						if ( $_SERVER['PATH_INFO'] == $_SERVER['SCRIPT_NAME'] )
							$_SERVER['REQUEST_URI'] = $_SERVER['PATH_INFO'];
						else
							$_SERVER['REQUEST_URI'] = $_SERVER['SCRIPT_NAME'] . $_SERVER['PATH_INFO'];
					}
					// Append the query string if it exists and isn't null
					if ( ! empty( $_SERVER['QUERY_STRING'] ) ) {
						$_SERVER['REQUEST_URI'] .= '?' . $_SERVER['QUERY_STRING'];
					}
				}
			}
			// Fix for PHP as CGI hosts that set SCRIPT_FILENAME to something ending in php.cgi for all requests
			if ( isset( $_SERVER['SCRIPT_FILENAME'] ) && ( strpos( $_SERVER['SCRIPT_FILENAME'], 'php.cgi' ) == strlen( $_SERVER['SCRIPT_FILENAME'] ) - 7 ) )
				$_SERVER['SCRIPT_FILENAME'] = $_SERVER['PATH_TRANSLATED'];
			// Fix for Dreamhost and other PHP as CGI hosts
			if ( strpos( $_SERVER['SCRIPT_NAME'], 'php.cgi' ) !== false )
				unset( $_SERVER['PATH_INFO'] );
			// Fix empty PHP_SELF
			$PHP_SELF = $_SERVER['PHP_SELF'];
			if ( empty( $PHP_SELF ) )
				$_SERVER['PHP_SELF'] = $PHP_SELF = preg_replace( '/(\?.*)?$/', '', $_SERVER["REQUEST_URI"] );
		}

		public static function isIESSL() {
			if ((!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']=='off')||$_SERVER['SERVER_PORT']==80) return false;
			@$match=preg_match('/MSIE ([0-9]\.[0-9])/', $_SERVER['HTTP_USER_AGENT'], $reg);
			if ($match==0) return false;
			if (floatval($reg[1])<9) return true;
		}

		public static function validEmail($email) {
			$isValid = true;
			$atIndex = strrpos($email, "@");
			if (is_bool($atIndex) && !$atIndex) {
				$isValid = false;
			} else {
				$domain = substr($email, $atIndex+1);
				$local = substr($email, 0, $atIndex);
				$localLen = strlen($local);
				$domainLen = strlen($domain);
				if ($localLen < 1 || $localLen > 64) { // local part length exceeded
					$isValid = false;
				} else if ($domainLen < 1 || $domainLen > 255) { // domain part length exceeded
					$isValid = false;
				} else if ($local[0] == '.' || $local[$localLen-1] == '.') { // local part starts or ends with '.'
					$isValid = false;
				} else if (preg_match('/\\.\\./', $local)) { // local part has two consecutive dots
					$isValid = false;
				} else if (!preg_match('/^[A-Za-z0-9\\-\\.]+$/', $domain)) { // character not valid in domain part
					$isValid = false;
				} else if (preg_match('/\\.\\./', $domain)) { // domain part has two consecutive dots
					$isValid = false;
				} else if (!preg_match('/^(\\\\.|[A-Za-z0-9!#%&`_=\\/$\'*+?^{}|~.-])+$/', str_replace("\\\\","",$local))) { // character not valid in local part unless
					if (!preg_match('/^"(\\\\"|[^"])+"$/', str_replace("\\\\","",$local))) { // local part is quoted
						$isValid = false;
					}
				}
				if (function_exists("checkdnsrr")) {
					if ($isValid && !(checkdnsrr($domain,"MX") || checkdnsrr($domain,"A"))) { // domain not found in DNS
						$isValid = false;
					}
				}
			}
			return $isValid;
		}

		public static function init ($bool) {
			Func::nomalizeServerVars();
			if ($bool==false) return;
			global $CONFIG, $LANG;
			$product_key = $CONFIG->getNodeVal("setup.product_key");
			$product_key = strtolower($product_key);
			$product_key = str_replace("-", "", $product_key);
			// get the real install base
			$server_port = isset($_SERVER["SERVER_PORT"]) ? $_SERVER["SERVER_PORT"] : "80";
			$server_protocol = $server_port=="80" ? "http://" : "https://";
			$server_name = isset($_SERVER["HTTP_HOST"]) ? $_SERVER["HTTP_HOST"] : $_SERVER["HOST_NAME"];
			if (substr($server_name, -4)==":443") $server_name = substr($server_name, 0, -4);
			if (substr($server_name, -3)==":80") $server_name = substr($server_name, 0, -3);
			$script_name = isset($_SERVER["SCRIPT_NAME"]) ? $_SERVER["SCRIPT_NAME"] : substr($_SERVER['PHP_SELF'], 0, strrpos($_SERVER['PHP_SELF'], ".php")+4);
			if (strpos($script_name, 'cgi-bin')!==false) $script_name = substr($_SERVER['PHP_SELF'], 0, strrpos($_SERVER['PHP_SELF'], ".php")+4);
			if (strpos($script_name, 'system-cgi')!==false) $script_name = substr($_SERVER['PHP_SELF'], 0, strrpos($_SERVER['PHP_SELF'], ".php")+4);
			if (strpos($script_name, 'global-bin')!==false) $script_name = substr($_SERVER['PHP_SELF'], 0, strrpos($_SERVER['PHP_SELF'], ".php")+4);
			$install_uri = $server_protocol . $server_name . $script_name;
				$install_uri = explode("/", $install_uri);
				array_pop($install_uri);
				if ( SA_BASEPATH=="../../../" ) {
					array_pop($install_uri);
					array_pop($install_uri);
					array_pop($install_uri);
				}
				$install_uri = implode("/", $install_uri);
			if (substr($install_uri, 0, 7)=="http://") $install_uri = substr($install_uri, 7);
			if (substr($install_uri, 0, 8)=="https://") $install_uri = substr($install_uri, 8);
			if (substr($install_uri, 0, 4)=="www.") $install_uri = substr($install_uri, 4);
			if (substr($install_uri, -8)=="wp-admin") $install_uri = substr($install_uri, 0, -9);
			$install_key = md5($CONFIG->getNodeVal("setup.install_id"));
			$install_key .= md5($CONFIG->getNodeVal("setup.product"));
			$install_key .= md5($install_uri);
			$install_key = sha1($install_key);
			if ($install_key!==$product_key) {
				print $LANG->lookup("Installation Invalid");
				exit();
			}
		}

		public static function homogenize($str) {
			$str = html_entity_decode($str);
			$str = str_replace(" ", "-", $str);
			$str = strtolower($str);
			$result = "";
			for ($i=0; $i<strlen($str); $i++) {
				$char = substr($str, $i, 1);
				$code = ord($char);
				if (($code>47&&$code<58)||($code>96&&$code<123)||$code==45) $result .= $char;
			}
			return $result;
		}

		public static function getBaseUrl ($pop=1, $drop=true) {
			$server_port = isset($_SERVER["SERVER_PORT"]) ? $_SERVER["SERVER_PORT"] : "80";
				if (isset($_SERVER["HTTP_X_FORWARDED_PORT"])) $server_port = $_SERVER["HTTP_X_FORWARDED_PORT"];
			$server_protocol = $server_port=="80" ? "http://" : "https://";
			$server_name = isset($_SERVER["HTTP_HOST"]) ? $_SERVER["HTTP_HOST"] : $_SERVER["HOST_NAME"];
				if (isset($_SERVER["HTTP_X_FORWARDED_HOST"])) $server_name = $_SERVER["HTTP_X_FORWARDED_HOST"];
			$request_uri = isset($_SERVER["REQUEST_URI"]) ? $_SERVER["REQUEST_URI"] : $_SERVER["SCRIPT_NAME"];
			$script_uri = isset($_SERVER["SCRIPT_URI"]) ? $_SERVER["SCRIPT_URI"] : $server_protocol . $server_name . $request_uri;
			if (strpos($script_uri, SA_DIR_CACHE)) $pop += 2;
			if (strpos($script_uri, "?")!==false&&$drop==true) $script_uri = substr($script_uri, 0, strpos($script_uri, "?"));
			$script_uri = explode("/", $script_uri);
			for ($i=0; $i<$pop; ++$i) array_pop($script_uri);
			return implode("/", $script_uri);
		}

		public static function getRemotePage ($url, $arr=false) {
			$query = "";
			if (is_array($arr)) {
				foreach ($arr as $key => $value) {
					$value = urlencode($value);
					$query .= $query=="" ? $key . "=" . $value : "&" . $key . "=" . $value ;
				}
			}
			$curl = curl_init();
			curl_setopt($curl, CURLOPT_URL, $url);
			if ($query!="") {
				curl_setopt($curl, CURLOPT_POST, 1);
				curl_setopt($curl, CURLOPT_POSTFIELDS, $query);
			}
			curl_setopt($curl, CURLOPT_RETURNTRANSFER, 1);
			$result = curl_exec($curl);
			curl_close($curl);
			return $result;
		}

		public static function bytesToSize($bytes, $precision=2) {
			$kilobyte = 1024;
			$megabyte = $kilobyte * 1024;
			$gigabyte = $megabyte * 1024;
			$terabyte = $gigabyte * 1024;
			if (($bytes >= 0) && ($bytes < $kilobyte)) {
				return $bytes . ' B';
			} elseif (($bytes >= $kilobyte) && ($bytes < $megabyte)) {
				return round($bytes / $kilobyte, $precision) . ' KB';
			} elseif (($bytes >= $megabyte) && ($bytes < $gigabyte)) {
				return round($bytes / $megabyte, $precision) . ' MB';
			} elseif (($bytes >= $gigabyte) && ($bytes < $terabyte)) {
				return round($bytes / $gigabyte, $precision) . ' GB';
			} elseif ($bytes >= $terabyte) {
				return round($bytes / $gigabyte, $precision) . ' TB';
			} else {
				return $bytes . ' B';
			}
		}

		public static function sizeToBytes ($val) {
			$val = trim($val);
			$last = strtolower(substr($val, -1));
			if ($last == 'g') $val = $val*1024*1024*1024;
			if ($last == 'm') $val = $val*1024*1024;
			if ($last == 'k') $val = $val*1024;
			return $val;
		}

		public static function setTextBetween ($text, $start, $close, $insert){
			$begin = strpos($text, $start) + strlen($start);
			$end = strpos($text, $close);
			$length = strlen(Func::getTextBetween($text, $start, $close));
			return substr_replace($text, $insert, $begin, $length);
		}

		public static function getTextBetween ($text, $start, $close) {
			$mid_url = "";
			$pos_s = strpos($text, $start);
			$pos_e = strpos($text, $close);
			for ( $i=$pos_s+strlen($start) ; (( $i<($pos_e)) && $i <strlen($text)) ; $i++ ) $mid_url .= $text[$i];
			return $mid_url;
		}

		public static function stripGoogleUA ($str) {
			$ua = "";
			$matches = array();
			$match = preg_match("/\(\"UA-.+\"\)/", $str, $matches);
			if ($match) {
				$ua = $matches[0];
				$ua = str_replace('("', '', $ua);
				$ua = str_replace('")', '', $ua);
			} else {
				$match = preg_match("/\'UA-.+\'\]/", $str, $matches);
				if ($match) {
					$ua = $matches[0];
					$ua = str_replace("'UA-", 'UA-', $ua);
					$ua = str_replace("']", '', $ua);
				} else {
					if (substr(trim($str), 0, 3)=="UA-") $ua = $str;
				}
			}
			return $ua;
		}

		public static function html2rgb ($color) {
			if (strlen($color)==0) return array(0, 0, 0);
			if ($color[0] == '#') $color = substr($color, 1);
			if (strlen($color) == 6) list($r, $g, $b) = array($color[0].$color[1], $color[2].$color[3], $color[4].$color[5]);
			elseif (strlen($color) == 3) list($r, $g, $b) = array($color[0].$color[0], $color[1].$color[1], $color[2].$color[2]);
			else return false;
			$r = hexdec($r); $g = hexdec($g); $b = hexdec($b);
			return array($r, $g, $b);
		}

		public static function hex_shift($supplied_hex,$shift_method,$percentage=50) {
			$shifted_hex_value     = null;
			$valid_shift_option    = FALSE;
			$current_set           = 1;
			$RGB_values            = array();
			$valid_shift_up_args   = array('up','+','lighter','>');
			$valid_shift_down_args = array('down','-','darker','<');
			$shift_method          = strtolower(trim($shift_method));
			// Check Factor
			if(!is_numeric($percentage)||($percentage = (int) $percentage)<0||$percentage>100) {
				trigger_error( "Invalid factor", E_USER_ERROR );
			}
			// Check shift method
			foreach(array($valid_shift_down_args,$valid_shift_up_args) as $options){
				foreach($options as $method) {
					if($method == $shift_method) {
						$valid_shift_option = !$valid_shift_option;
						$shift_method = ($current_set === 1) ? '+' : '-';
						break 2;
					}
				}
				++$current_set;
			}
			if(!$valid_shift_option) {
				trigger_error( "Invalid shift method", E_USER_ERROR );
			}
			// Check Hex string
			switch(strlen($supplied_hex=(str_replace('#','',trim($supplied_hex))))) {
				case 3:
					if(preg_match('/^([0-9a-f])([0-9a-f])([0-9a-f])/i',$supplied_hex)) {
						$supplied_hex = preg_replace('/^([0-9a-f])([0-9a-f])([0-9a-f])/i',
						'\\1\\1\\2\\2\\3\\3',$supplied_hex);
					} else {
						trigger_error( "Invalid hex value", E_USER_ERROR );
					}
					break;
				case 6:
					if(!preg_match('/^[0-9a-f]{2}[0-9a-f]{2}[0-9a-f]{2}$/i',$supplied_hex)) {
						trigger_error( "Invalid hex value", E_USER_ERROR );
					}
					break;
				default:
					trigger_error( "Invalid hex length", E_USER_ERROR );
			}
			// Start shifting
			$RGB_values['R'] = hexdec($supplied_hex{0}.$supplied_hex{1});
			$RGB_values['G'] = hexdec($supplied_hex{2}.$supplied_hex{3});
			$RGB_values['B'] = hexdec($supplied_hex{4}.$supplied_hex{5});
			foreach($RGB_values as $c => $v) {
				switch($shift_method) {
					case '-':
						$amount = round(((255-$v)/100)*$percentage)+$v;
					break;
					case '+':
						$amount = $v-round(($v/100)*$percentage);
					break;
					default:
						trigger_error( "Oops. Unexpected shift method", E_USER_ERROR );
				}
				$shifted_hex_value .= $current_value = (
					strlen($decimal_to_hex = dechex($amount)) < 2
					) ? '0'.$decimal_to_hex : $decimal_to_hex;
			}
			return '#'.$shifted_hex_value;
		}

		public static function remove_accent($str) {
			$a = array('À', 'Á', 'Â', 'Ã', 'Ä', 'Å', 'Æ', 'Ç', 'È', 'É', 'Ê', 'Ë', 'Ì', 'Í', 'Î', 'Ï', 'Ð', 'Ñ', 'Ò', 'Ó', 'Ô', 'Õ', 'Ö', 'Ø', 'Ù', 'Ú', 'Û', 'Ü', 'Ý', 'ß', 'à', 'á', 'â', 'ã', 'ä', 'å', 'æ', 'ç', 'è', 'é', 'ê', 'ë', 'ì', 'í', 'î', 'ï', 'ñ', 'ò', 'ó', 'ô', 'õ', 'ö', 'ø', 'ù', 'ú', 'û', 'ü', 'ý', 'ÿ', 'Ā', 'ā', 'Ă', 'ă', 'Ą', 'ą', 'Ć', 'ć', 'Ĉ', 'ĉ', 'Ċ', 'ċ', 'Č', 'č', 'Ď', 'ď', 'Đ', 'đ', 'Ē', 'ē', 'Ĕ', 'ĕ', 'Ė', 'ė', 'Ę', 'ę', 'Ě', 'ě', 'Ĝ', 'ĝ', 'Ğ', 'ğ', 'Ġ', 'ġ', 'Ģ', 'ģ', 'Ĥ', 'ĥ', 'Ħ', 'ħ', 'Ĩ', 'ĩ', 'Ī', 'ī', 'Ĭ', 'ĭ', 'Į', 'į', 'İ', 'ı', 'Ĳ', 'ĳ', 'Ĵ', 'ĵ', 'Ķ', 'ķ', 'Ĺ', 'ĺ', 'Ļ', 'ļ', 'Ľ', 'ľ', 'Ŀ', 'ŀ', 'Ł', 'ł', 'Ń', 'ń', 'Ņ', 'ņ', 'Ň', 'ň', 'ŉ', 'Ō', 'ō', 'Ŏ', 'ŏ', 'Ő', 'ő', 'Œ', 'œ', 'Ŕ', 'ŕ', 'Ŗ', 'ŗ', 'Ř', 'ř', 'Ś', 'ś', 'Ŝ', 'ŝ', 'Ş', 'ş', 'Š', 'š', 'Ţ', 'ţ', 'Ť', 'ť', 'Ŧ', 'ŧ', 'Ũ', 'ũ', 'Ū', 'ū', 'Ŭ', 'ŭ', 'Ů', 'ů', 'Ű', 'ű', 'Ų', 'ų', 'Ŵ', 'ŵ', 'Ŷ', 'ŷ', 'Ÿ', 'Ź', 'ź', 'Ż', 'ż', 'Ž', 'ž', 'ſ', 'ƒ', 'Ơ', 'ơ', 'Ư', 'ư', 'Ǎ', 'ǎ', 'Ǐ', 'ǐ', 'Ǒ', 'ǒ', 'Ǔ', 'ǔ', 'Ǖ', 'ǖ', 'Ǘ', 'ǘ', 'Ǚ', 'ǚ', 'Ǜ', 'ǜ', 'Ǻ', 'ǻ', 'Ǽ', 'ǽ', 'Ǿ', 'ǿ');
			$b = array('A', 'A', 'A', 'A', 'A', 'A', 'AE', 'C', 'E', 'E', 'E', 'E', 'I', 'I', 'I', 'I', 'D', 'N', 'O', 'O', 'O', 'O', 'O', 'O', 'U', 'U', 'U', 'U', 'Y', 's', 'a', 'a', 'a', 'a', 'a', 'a', 'ae', 'c', 'e', 'e', 'e', 'e', 'i', 'i', 'i', 'i', 'n', 'o', 'o', 'o', 'o', 'o', 'o', 'u', 'u', 'u', 'u', 'y', 'y', 'A', 'a', 'A', 'a', 'A', 'a', 'C', 'c', 'C', 'c', 'C', 'c', 'C', 'c', 'D', 'd', 'D', 'd', 'E', 'e', 'E', 'e', 'E', 'e', 'E', 'e', 'E', 'e', 'G', 'g', 'G', 'g', 'G', 'g', 'G', 'g', 'H', 'h', 'H', 'h', 'I', 'i', 'I', 'i', 'I', 'i', 'I', 'i', 'I', 'i', 'IJ', 'ij', 'J', 'j', 'K', 'k', 'L', 'l', 'L', 'l', 'L', 'l', 'L', 'l', 'l', 'l', 'N', 'n', 'N', 'n', 'N', 'n', 'n', 'O', 'o', 'O', 'o', 'O', 'o', 'OE', 'oe', 'R', 'r', 'R', 'r', 'R', 'r', 'S', 's', 'S', 's', 'S', 's', 'S', 's', 'T', 't', 'T', 't', 'T', 't', 'U', 'u', 'U', 'u', 'U', 'u', 'U', 'u', 'U', 'u', 'U', 'u', 'W', 'w', 'Y', 'y', 'Y', 'Z', 'z', 'Z', 'z', 'Z', 'z', 's', 'f', 'O', 'o', 'U', 'u', 'A', 'a', 'I', 'i', 'O', 'o', 'U', 'u', 'U', 'u', 'U', 'u', 'U', 'u', 'U', 'u', 'A', 'a', 'AE', 'ae', 'O', 'o');
			return str_replace($a, $b, $str);
		}

		public static function fragmentString ($str, $split=4, $delimiter="-") {
			$array = array();
			for ($i=0; $i<strlen($str);) {
				$array[] = substr($str, $i, $split);
				$i += $split;
			}
			return implode($delimiter, $array);
		}

		public static function generateMnemonicPhrase($chars=6, $numbers=2) {
			$letters = array(
				0 => array('q','w','r','g','f','d','s','z','x','c','v','Q','W','R','G','F','D','S','Z','X','C','V'),
				1 => array('u','i','U'),
				2 => array('y','p','h','j','k','b','n','m','Y','P','H','J','K','L','B','N','M'),
				3 => array('e','a','E','A')
			);
			$digits = array(
				0 => array('2','3','4','5'),
				1 => array('6','7','8','9')
			);
			$pass = "";
			for ($i=0; $i<$chars; $i++) {
				$pass .= $letters[$i % 4][array_rand($letters[$i % 4])];
			}
			$dirty_words = array('bob','con','cum','fod','fuc','fud','fuk','gal','gat','mal','mam','mar','mec','pat','peg','per','pic','pil','pit','put','rab','tar','tes','tet','tol','vac');
			foreach ($dirty_words as $dirty_word) {
				if (strpos(strtolower($pass), $dirty_word) !== false) {
					return Func::generateMnemonicPhrase($chars, $numbers);
				}
			}
			if ($numbers > 0) {
				for ($i=0; $i<$numbers; $i++) {
					$pass .= $digits[$i % 2][array_rand($digits[$i % 2])];
				}
			}
			return $pass;
		}

		public static function imageSmoothAlphaLine ($image, $x1, $y1, $x2, $y2, $r, $g, $b, $alpha=0) {
			$icr = $r;
			$icg = $g;
			$icb = $b;
			$dcol = imagecolorallocatealpha($image, $icr, $icg, $icb, $alpha);
			if ($y1 == $y2 || $x1 == $x2) imageline($image, $x1, $y2, $x1, $y2, $dcol);
			else {
				$m = ($y2 - $y1) / ($x2 - $x1);
				$b = $y1 - $m * $x1;
				if (abs ($m) <2) {
					$x = min($x1, $x2);
					$endx = max($x1, $x2) + 1;
					while ($x < $endx) {
						$y = $m * $x + $b;
						$ya = ($y == floor($y) ? 1: $y - floor($y));
						$yb = ceil($y) - $y;
						$trgb = @imagecolorat($image, $x, floor($y));
						$tcr = ($trgb >> 16) & 0xFF;
						$tcg = ($trgb >> 8) & 0xFF;
						$tcb = $trgb & 0xFF;
						imagesetpixel($image, $x, floor($y), imagecolorallocatealpha($image, ($tcr * $ya + $icr * $yb), ($tcg * $ya + $icg * $yb), ($tcb * $ya + $icb * $yb), $alpha));
						$trgb = @imagecolorat($image, $x, ceil($y));
						$tcr = ($trgb >> 16) & 0xFF;
						$tcg = ($trgb >> 8) & 0xFF;
						$tcb = $trgb & 0xFF;
						imagesetpixel($image, $x, ceil($y), imagecolorallocatealpha($image, ($tcr * $yb + $icr * $ya), ($tcg * $yb + $icg * $ya), ($tcb * $yb + $icb * $ya), $alpha));
						$x++;
					}
				} else {
					$y = min($y1, $y2);
					$endy = max($y1, $y2) + 1;
					while ($y < $endy) {
						$x = ($y - $b) / $m;
						$xa = ($x == floor($x) ? 1: $x - floor($x));
						$xb = ceil($x) - $x;
						$trgb = @imagecolorat($image, floor($x), $y);
						$tcr = ($trgb >> 16) & 0xFF;
						$tcg = ($trgb >> 8) & 0xFF;
						$tcb = $trgb & 0xFF;
						imagesetpixel($image, floor($x), $y, imagecolorallocatealpha($image, ($tcr * $xa + $icr * $xb), ($tcg * $xa + $icg * $xb), ($tcb * $xa + $icb * $xb), $alpha));
						$trgb = @imagecolorat($image, ceil($x), $y);
						$tcr = ($trgb >> 16) & 0xFF;
						$tcg = ($trgb >> 8) & 0xFF;
						$tcb = $trgb & 0xFF;
						imagesetpixel ($image, ceil($x), $y, imagecolorallocatealpha($image, ($tcr * $xb + $icr * $xa), ($tcg * $xb + $icg * $xa), ($tcb * $xb + $icb * $xa), $alpha));
						$y ++;
					}
				}
			}
		}

		public static function imagecopymerge_alpha ($dst_im, $src_im, $dst_x, $dst_y, $src_x, $src_y, $src_w, $src_h, $pct){
			$cut = imagecreatetruecolor($src_w, $src_h);
			imagecopy($cut, $dst_im, 0, 0, $dst_x, $dst_y, $src_w, $src_h);
			imagecopy($cut, $src_im, 0, 0, $src_x, $src_y, $src_w, $src_h);
			imagecopymerge($dst_im, $cut, $dst_x, $dst_y, 0, 0, $src_w, $src_h, $pct);
		}

		public static function imageconvolution_php4 ($src, $filter, $filter_div, $offset) {
			if ($src==NULL) {
				return 0;
			}
			$sx = imagesx($src);
			$sy = imagesy($src);
			$srcback = imagecreatetruecolor($sx, $sy);
			imagecopy($srcback, $src,0,0,0,0,$sx,$sy);
			if($srcback==NULL){
				return 0;
			}
			$pxl = array(1,1);
			for ($y=0; $y<$sy; ++$y){
				for($x=0; $x<$sx; ++$x){
					$new_r = $new_g = $new_b = 0;
					$alpha = imagecolorat($srcback, $pxl[0], $pxl[1]);
					$new_a = $alpha >> 24;
					for ($j=0; $j<3; ++$j) {
						$yv = min(max($y - 1 + $j, 0), $sy - 1);
						for ($i=0; $i<3; ++$i) {
							$pxl = array(min(max($x - 1 + $i, 0), $sx - 1), $yv);
							$rgb = imagecolorat($srcback, $pxl[0], $pxl[1]);
							$new_r += (($rgb >> 16) & 0xFF) * $filter[$j][$i];
							$new_g += (($rgb >> 8) & 0xFF) * $filter[$j][$i];
							$new_b += ($rgb & 0xFF) * $filter[$j][$i];
						}
					}
					$new_r = ($new_r/$filter_div)+$offset;
					$new_g = ($new_g/$filter_div)+$offset;
					$new_b = ($new_b/$filter_div)+$offset;
					$new_r = ($new_r > 255)? 255 : (($new_r < 0)? 0:$new_r);
					$new_g = ($new_g > 255)? 255 : (($new_g < 0)? 0:$new_g);
					$new_b = ($new_b > 255)? 255 : (($new_b < 0)? 0:$new_b);
					$new_pxl = imagecolorallocatealpha($src, (int)$new_r, (int)$new_g, (int)$new_b, $new_a);
					if ($new_pxl == -1) {
						$new_pxl = imagecolorclosestalpha($src, (int)$new_r, (int)$new_g, (int)$new_b, $new_a);
					}
					if (($y >= 0) && ($y < $sy)) {
						imagesetpixel($src, $x, $y, $new_pxl);
					}
				}
			}
			imagedestroy($srcback);
			return 1;
		}

	}

?>