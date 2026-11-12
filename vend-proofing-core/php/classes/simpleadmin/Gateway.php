<?php

	class Gateway {

		/* ---- Public Methods ---- */

		public function execute () {
			$authentication = $this->auth->authenticate();
			$this->authenticated = $authentication["authenticated"] == true;
			if ($this->authenticated) $this->runPrivate();
			$this->runPublic();
		}

		/* ---- Constructor ---- */

		public function __construct() {
			$post = array_merge($_GET, $_POST);
			$post = array_map("stripslashes", $post);
			if (isset($post["action"])) {
				$action = $post["action"];
				$action_params = explode("_", $action);
				$control = isset($action_params[0]) ? $action_params[0] : "";
				$command = isset($action_params[1]) ? $action_params[1] : "";
				$this->post = $post;
				$this->control = $control;
				$this->command = $command;
				$this->action = $action;
			}
			$this->auth = new Auth();
		}
		
		/* ---- Private Properties ---- */

		protected $post = array();
		protected $authenticated = false;
		protected $action = "";
		protected $control = "";
		protected $command = "";
		protected $auth = null;
		protected $file_control_types = array("image", "asset", "audio", "track", "package", "product");

		protected function getRequestVariable ($name, $default="") {
			if (isset($this->post[$name])&&strlen($this->post[$name])>0) {
				if ($default==null&&$this->post[$name]=="null") {
					return null;
				}
				return $this->post[$name];
			}
			return $default;
		}

		protected function clearSystemCache () {
			Filesystem::purgeFolder(SA_DIR_TEMP);
			Filesystem::purgeFolder(SA_DIR_CACHE);
			$this->getSystemInfo();
		}

		protected function getSystemInfo () {
			global $CONFIG;
			$gdv = "n/a";
			if (function_exists("gd_info")) {
				$gdarray = gd_info();
				$gdv = preg_replace('/[a-z-() ]/', '', $gdarray['GD Version']);
			}
			$curlv = "n/a";
			if (function_exists("curl_init")) {
				$curlarray = curl_version();
				$curlv = $curlarray["version"];
			}
			$imagick_installed = extension_loaded("Imagick");
			$imagick_version = "n/a";
			if ($imagick_installed) {
				$imagick_instance = new Imagick();
				$imagick_version = $imagick_instance->getVersion();
				$imagick_version = $imagick_version["versionString"];
				$imagick_version = explode(" ", $imagick_version);
				$imagick_version = $imagick_version[1];
			}
			$last_updated = $CONFIG->getNodeVal("setup.last_updated");
			$props = array(
				"last_updated" => 				is_numeric( $last_updated ) ? @date("m/d/Y", $CONFIG->getNodeVal("setup.last_updated")/1000) : "N/A",
				"product_version" => 			$CONFIG->getNodeVal("setup.product_version"),
				"user_generated_storage" => 	Func::bytesToSize(Filesystem::getDirSize(SA_DIR_STORAGE)),
				"temporary_storage" => 			Func::bytesToSize(Filesystem::getDirSize(SA_DIR_TEMP)),
				"php_version" => 				preg_replace('/[a-z-]/', '', phpversion()),
				"php_os" => 					PHP_OS,
				"server_api" => 				PHP_SAPI,
				"maximum_upload_size" => 		Func::bytesToSize(Func::sizeToBytes(@ini_get("upload_max_filesize"))),
				"curl_library_version" => 		$curlv,
				"gd_library_version" => 		$gdv,
				"imagick_library_version" => 	$imagick_version
			);
			if ($CONFIG->getNodeVal("setup.hub")=="true") {
				unset($props["php_version"]);
				unset($props["php_os"]);
				unset($props["server_api"]);
				unset($props["curl_library_version"]);
				unset($props["gd_library_version"]);
				unset($props["imagick_library_version"]);
			}
			$response = "";
			foreach ($props as $key => $value) {
				$response .= $response=="" ? $key . "=" . $value : "&" . $key . "=" . $value;
			}
			$this->respond(array(
				"success" => true,
				"data" => $response
			));
		}
		
		protected function parseTableRowData ($str) {
			$arr = explode("\t", $str);
			$count = count($arr);
			for ($i=0; $i<$count; ++$i) {
				$value = $arr[$i];
				if ($value=="null") $arr[$i] = null;
			}
			return $arr;
		}

		/* ---- Public Execution ---- */

		protected function runPublic () {
			global $CONFIG;
			global $LANG;
			switch ($this->action) {
			 case "image_colorize" :
				/* pull in the possible query values
					*/
				$effect = strtolower($this->getRequestVariable("effect"));
				$image = strtolower($this->getRequestVariable("image"));
					$image = str_replace("/", "", $image); // no backpedalling
				$color = strtolower($this->getRequestVariable("color"));
				$to = strtolower($this->getRequestVariable("to"));
				/* error check
					*/
				$errors = array();
				if ($effect=="") $errors[] = $LANG->lookup('effect is a required parameter');
				if ($image=="") $errors[] = $LANG->lookup('image is a required parameter');
				if (count($errors)!=0) {
					$this->respond(array(
						"type" => "xml",
						"errors" => $errors
					));
				}
				/* check to see if we've already created it
					*/
				$extension = explode(".", $image);
				$extension = end($extension);
				$hash = md5("$effect$image$color$to");
				$filepath = SA_DIR_TEMP . "/$hash.$extension";
				if (file_exists($filepath)) {
					$this->respond(array(
						"cache" => true,
						"type" => $extension,
						"filepath" => $filepath
					));
				}
				/* check to see if the base file exists
					*/
				$image_path = SA_DIR_COREPATH . "/graphics/$image";
				if (!file_exists($image_path)) {
					$errors[] = $LANG->lookup('base image does not exist');
					$this->respond(array(
						"type" => "xml",
						"errors" => $errors
					));
				}
				/* make sure the temp folder exists
					*/
				Filesystem::makeFolder(SA_DIR_TEMP);
				/* ok, let's create it
					*/
				$imagick_installed = extension_loaded("Imagick");
				$is_hub = $CONFIG->getNodeVal("setup.hub")=="true";
				$use_imagick = ($is_hub||$imagick_installed) && $effect=="overlay";
				if (!$use_imagick) {
					switch($extension) {
						case 'png' :
							$img = imagecreatefrompng($image_path);
							break;
						case 'jpg' :
						case 'jpeg' :
							$img = imagecreatefromjpeg($image_path);
							break;
					}
				} else {
					$img = new Imagick($image_path);
				}
				switch ($effect) {
					case "none" :
						$this->respond(array(
							"cache" => true,
							"type" => $extension,
							"filepath" => $image_path
						));
					case "overlay" :
						if ($use_imagick) {
							$width = $img->getImageWidth();
							$height = $img->getImageHeight();
							$base = new Imagick();
							$base->newImage($width, $height, "#$color");
							$base->setImageFormat($extension);
							$base->compositeImage($img, imagick::COMPOSITE_COPYOPACITY, 0, 0);
							$img = $base;
						} else {
							$rgb = Func::html2rgb($color);
							$width = imagesx($img);
							$height = imagesy($img);
							imagesavealpha($img, true);
							imagelayereffect($img, IMG_EFFECT_OVERLAY);
							imagefilledrectangle($img, 0, 0, $width, $height, imagecolorallocate($img, $rgb[0], $rgb[1], $rgb[2]));
						}
						$this->respond(array(
							"cache" => true,
							"type" => $extension,
							"filepath" => $filepath,
							"image" => $img,
							"imagick" => $use_imagick
						));
					case "add" :
						$rgb = Func::html2rgb($color);
						imagealphablending($img, false);
						imagesavealpha($img, true);
						imagefilter($img, IMG_FILTER_COLORIZE, $rgb[0], $rgb[1], $rgb[2], 0);
						$this->respond(array(
							"cache" => true,
							"type" => $extension,
							"filepath" => $filepath,
							"image" => $img
						));
					case "replace" :
						$colors = explode(",", $color);
						$replacements = explode(",", $to);
						if ($to=="") $errors[] = $LANG->lookup('to is a required parameter');
						if (count($colors)!=count($replacements)) $errors[] = $LANG->lookup('color and to must have same number of arguments');
						if (count($errors)!=0) {
							$this->respond(array(
								"type" => "xml",
								"errors" => $errors
							));
						}
						imagetruecolortopalette($img, false, 512);
						for ($i=0; $i<count($colors); ++$i) {
							$color = Func::html2rgb($colors[$i]);
							$replace = Func::html2rgb($replacements[$i]);
							$index = imagecolorexact($img, $color[0], $color[1], $color[2]);
							imagecolorset($img, $index, $replace[0], $replace[1], $replace[2]);
						}
						$this->respond(array(
							"cache" => true,
							"type" => $extension,
							"filepath" => $filepath,
							"image" => $img
						));
				}
				break;
			 case "login" :
				$username = $this->getRequestVariable("username");
				$password = isset($_POST["password"]) && is_string($_POST["password"]) ? $_POST["password"] : "";
				$persist = $this->getRequestVariable("persist");
				$token = $this->auth->login($username, $password, $persist==="yes");
				$this->respond(array(
					"success" => $token!=="",
					"data" => $token!=="" ? $token : "Username or password invalid"
				));
			 case "logout" :
				if ($this->auth->authenticate()["authenticated"]) $this->auth->invalidate();
				$this->respond(array(
					"success" => true
				));
			 case "auth_status" :
				$token = $this->auth->token();
				$this->respond(array(
					"success" => $token!=="",
					"data" => $token
				));
				break;
			 default :
				$this->respond(array(
					"type" => "xml",
					"errors" => array($LANG->lookup('a valid action parameter is required'))
				));
			}
		}

		/* ---- Private Execution ---- */

		protected function runPrivate () {
			global $CONFIG;
			switch ($this->control) {
			 case "upload" :
				$cookie_name = md5($CONFIG->getNodeVal("setup.product"));
				$cookie_value = isset($_COOKIE[$cookie_name]) ? $_COOKIE[$cookie_name] : "";
				$cookie_hash = md5($cookie_value);
				$cookie_file = SA_DIR_TEMP . "/upload.$cookie_hash.tmp";
				switch ($this->command) {
				 case "info" :
					$this->respond(array(
						"success" => true,
						"data" => Func::sizeToBytes(@ini_get("upload_max_filesize"))
					));
				 case "init" :
					$this->respond(array(
						"success" => Filesystem::makeFile($cookie_file),
						"data" => Func::sizeToBytes(@ini_get("upload_max_filesize"))
					));
				 case "end" :
					$this->respond(array(
						"success" => Filesystem::deleteFile($cookie_file)
					));
				}
			 case "system" :
				switch ($this->command) {
				 case "clearcache" :
					$this->clearSystemCache();
				 case "getinfo" :
					$this->getSystemInfo();
				}
			 case "account" :
				switch ($this->command) {
				 case "changepassword" :
					$username = $this->getRequestVariable("username");
					$oldPassword = isset($_POST["o_password"]) && is_string($_POST["o_password"]) ? $_POST["o_password"] : "";
					$newPassword = isset($_POST["n_password"]) && is_string($_POST["n_password"]) ? $_POST["n_password"] : "";
					$success = AdminAccount::changePassword($username, $oldPassword, $newPassword);
					$this->respond(array(
						"success" => $success,
						"data" => $success ? "Password Changed Successfully" : "Original Password Invalid"
					));
				 case "changeusername" :
					$oldUsername = $this->getRequestVariable("o_username");
					$newUsername = $this->getRequestVariable("n_username");
					$password = isset($_POST["password"]) && is_string($_POST["password"]) ? $_POST["password"] : "";
					$success = AdminAccount::changeUsername($oldUsername, $newUsername, $password);
					$this->respond(array(
						"success" => $success,
						"data" => $success ? "Username Changed Successfully" : "Original Password Invalid"
					));
				}
			 case "setup" :
				$type = $this->getRequestVariable("type");
				$suid = $this->getRequestVariable("suid", null);
				switch ($this->command) {
				 case "save" :
					$data = $this->getRequestVariable("data");
					$this->respond(array(
						"success" => Configuration::save($type, $suid, $type==="ordering" ? PaymentSettings::merge($data) : $data),
						"invalidate" => true
					));
				 case "revert" :
					$this->respond(array(
						"success" => Configuration::revert($type, $suid),
						"invalidate" => true
					));
				 case "defaults" :
					$response = Configuration::getDefaults($type);
					$this->respond(array(
						"success" => $response!==false,
						"data" => $response
					));
				 case "load" :
					$response = Configuration::getJson($type, $suid);
					if ($type==="ordering" && $response!==false) $response = PaymentSettings::forAdmin($response);
					$this->respond(array(
						"success" => $response!==false,
						"data" => $response
					));
				}
			 case "set" :
				$name = $this->getRequestVariable("name");
				$suid = $this->getRequestVariable("suid", null);
				$puid = $this->getRequestVariable("puid", null);
				if (preg_match('/^[a-f0-9]{32}$/i', $name)) {
					if ($this->command==="list") {
						$this->respond(array(
							"success" => true,
							"data" => Proofing::rowsText(Proofing::rows($puid ?? "", $name))
						));
					}
					throw new InvalidArgumentException("Unknown proofing action.");
				}
				if (Records::hasSetTable($name)) {
					switch ($this->command) {
					 case "list" :
						$this->respond(array(
							"success" => true,
							"data" => Records::rowsText(Records::getSetTable($name, $puid))
						));
					 case "create" :
					 case "update" :
						$data = $this->parseTableRowData($this->getRequestVariable("data"));
						Records::saveSetRow($name, $suid ?? "", $puid, $data);
						$this->respond(array(
							"success" => true,
							"data" => Records::rowsText(Records::getSetTable($name, $puid)),
							"invalidate" => true
						));
					 case "delete" :
						$namedCode = in_array($name, array("category", "ustaxchart", "cataxchart", "vattaxchart"), true);
						$validSuid = $name==="session"
							? preg_match('/^[a-f0-9]{32}$/i', $suid ?? "")
							: preg_match('/^[a-f0-9]{1,16}$/i', $suid ?? "");
						if (!$namedCode && !$validSuid) {
							throw new InvalidArgumentException("Invalid set identifier.");
						}
						Records::deleteSetRow($name, $suid ?? "", $puid);
						if ($name==="page") {
							$folder = SA_DIR_STORAGE . "/" . $suid;
							if (is_dir($folder) && !is_link($folder)) {
								Filesystem::purgeFolder($folder);
								Filesystem::deleteFolder($folder);
							}
						}
						$this->respond(array(
							"success" => true,
							"data" => Records::rowsText(Records::getSetTable($name, $puid)),
							"invalidate" => true
						));
					 case "reindex" :
						$from = (int) $this->getRequestVariable("from");
						$to = (int) $this->getRequestVariable("to");
						Records::reorderSetRows($name, $puid, $from, $to);
						$this->respond(array(
							"success" => true,
							"data" => Records::rowsText(Records::getSetTable($name, $puid)),
							"invalidate" => true
						));
					}
				}
				throw new InvalidArgumentException("Unknown set type.");
			}
			if (in_array($this->control, $this->file_control_types, true)) {
				$type = $this->control;
				$suid = $this->getRequestVariable("suid", null);
				$folder = $suid ?? $type;
				$pageType = null;
				if ($type==="image") {
					$pageType = Records::pageType($folder);
					$name = $this->getRequestVariable("name");
					if ($name!=="page" || !in_array($pageType, array("UploadSet", "CategorySet", "DropboxSet"), true)) {
						throw new InvalidArgumentException("Unknown image gallery.");
					}
				} elseif ($folder!==$type && Records::pageType($folder)===null) {
					throw new InvalidArgumentException("Unknown media gallery.");
				}

				switch ($this->command) {
				 case "list" :
					$this->respond(array(
						"success" => true,
						"data" => Records::rowsText(Records::getFileTable($type, $folder))
					));
				 case "reindex" :
					$from = (int) $this->getRequestVariable("from");
					$to = (int) $this->getRequestVariable("to");
					$moves = MediaFiles::mediaOrderMoves($this->post);
					if ($type==="image") {
						Records::reorderImages($folder, $moves, $from, $to);
					} else {
						Records::reorderMedia($type, $folder, $moves, $from, $to);
					}
					$this->respond(array(
						"success" => true,
						"data" => Records::rowsText(Records::getFileTable($type, $folder)),
						"invalidate" => true
					));
				 case "snapshot" :
					$result = MediaFiles::addSnapshot($type, $folder,
						$this->getRequestVariable("filename"), $this->getRequestVariable("data"));
					$this->respond(array(
						"success" => $result===100,
						"data" => MediaFiles::mediaSnapshotResult($result),
						"invalidate" => true
					));
				 case "sideload" :
				 case "upload" :
					if ($type==="image" && $pageType==="DropboxSet") {
						$this->respond(array("success" => false, "data" => "Dropbox images are added by sync."));
					}
					$isSnapshot = $this->getRequestVariable("snapshot")==="true";
					$row = MediaFiles::receiveMediaFile($type, $folder, $this->post);
					if (!is_array($row)) {
						$this->respond(array("success" => false, "data" => MediaFiles::mediaFileError($row)));
					}
					if (!$isSnapshot) {
						$categoryName = "";
						if ($type==="image") {
							$path = trim($this->getRequestVariable("path"), "/");
							$parts = explode("/", $path);
							if (count($parts)>=2) {
								array_pop($parts);
								$categoryName = (string) array_pop($parts);
							}
						}
						try {
							if ($type==="image") {
								Records::addImage($folder, $row, $categoryName);
							} else {
								Records::addMedia($type, $folder, $row);
							}
						} catch (Throwable $error) {
							MediaFiles::delete($folder, array($row[0]));
							throw $error;
						}
						if ($categoryName!=="" && $pageType==="CategorySet") {
							$row[6] = md5($categoryName);
						}
					}
					$this->respond(array(
						"success" => true,
						"data" => implode("\t", $row),
						"invalidate" => true
					));
				 case "update" :
					$data = $this->parseTableRowData($this->getRequestVariable("data"));
					if ($type==="image") {
						Records::updateImage($folder, $data);
					} else {
						Records::updateMedia($type, $folder, $data);
					}
					$this->respond(array(
						"success" => true,
						"data" => Records::rowsText(Records::getFileTable($type, $folder)),
						"invalidate" => true
					));
				 case "delete" :
					$existing = Records::getFileTable($type, $folder);
					$keys = array();
					foreach (explode(",", $this->getRequestVariable("files")) as $key) {
						if (isset($existing[$key])) $keys[] = $key;
					}
					if ($type==="image") {
						Records::deleteImages($folder, $keys);
					} else {
						Records::deleteMedia($type, $folder, $keys);
					}
					MediaFiles::delete($folder, $keys);
					$this->respond(array(
						"success" => true,
						"data" => Records::rowsText(Records::getFileTable($type, $folder)),
						"invalidate" => true
					));
				}
				throw new InvalidArgumentException("Unknown media action.");
			}
		}

		/* ---- Output Functions ---- */

		protected function doRedirect ($uri) {
			header("Location: $uri");
			exit;
		}

		protected function respond ($args) {
			/* check for default values
				*/
			$type = isset($args["type"]) ? $args["type"] : "txt";
			$success = isset($args["success"]) ? $args["success"] : false;
			$data = isset($args["data"]) ? $args["data"] : "";
			$invalidate = isset($args["invalidate"]) ? $args["invalidate"] : false;
			$cache = isset($args["cache"]) ? $args["cache"] : false;
			$errors = isset($args["errors"]) ? $args["errors"] : array();
			$filepath = isset($args["filepath"]) ? $args["filepath"] : "";
			$image = isset($args["image"]) ? $args["image"] : null;
			$imagick = isset($args["imagick"]) ? $args["imagick"] : false;
			/* print cache headers
				*/
			if ($cache) {
				$expires = 60*60*24*14;
				header("Pragma: public");
				header("Cache-Control: maxage=".$expires);
				header('Expires: ' . gmdate('D, d M Y H:i:s', time()+$expires) . ' GMT');
			} else {
				header('Expires: Sat, 26 Jul 1997 05:00:00 GMT');
				header('Last-Modified: ' . gmdate( 'D, d M Y H:i:s' ) . ' GMT');
				header('Cache-Control: post-check=0, pre-check=0', false);
				if (Func::isIESSL()==false) {
					header('Cache-Control: no-store, no-cache, must-revalidate');
					header('Pragma: no-cache');
				}
			}
			/* print out the response acording to the type
				*/
			switch ($type) {
				case "xml" :
					header ("content-type: text/xml");
					if (count($errors)==0) {
						print $data;
					} else {
						print '<?xml version="1.0"?><data>';
						foreach ($errors as $error) print "<error>$error</error>";
						print '</data>';
					}
					break;
				case "raw" :
					print $data;
					break;
				case "txt" :
					$data = rawurlencode($data);
					$bool = $success==true ? "s=true" : "s=false";
					$data = $data=="" ? $data : "&r=$data";
					print "$bool$data";
					break;
				case 'png' :
					header("Content-type: image/png");
					if ($image!=null) {
						if ($imagick) {
							$image->setImageFormat("png");
							$image->writeImage($filepath);
							echo $image->getImageBlob();
						} else {
							@imagepng($image, $filepath);
							imagepng($image);
						}
					} else {
						header('Content-Length: '. filesize($filepath));
						readfile($filepath);
					}
					break;
				case 'jpg' :
				case 'jpeg' :
					header("Content-type: image/jpeg");
					if ($image!=null) {
						if ($imagick) {
							$image->setImageFormat("jpeg");
							$image->setCompressionQuality(90);
							$image->writeImage($filepath);
							echo $image->getImageBlob();
						} else {
							@imagejpeg($image, $filepath, 90);
							imagejpeg($image, null, 90);
						}
					} else {
						header('Content-Length: '. filesize($filepath));
						readfile($filepath);
					}
					break;
			}
			/* clear cache, if we're invalidateing
				*/
			if ($invalidate) {
				Filesystem::purgeFolder(SA_DIR_CACHE);
			}
			/* kill process
				*/
			exit;
		}

	}

?>
