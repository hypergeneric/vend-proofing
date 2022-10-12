<?php

	class Gateway {

		/* ---- Public Methods ---- */

		public function demoMode ($bool) {
			$this->demomode = $bool;
		}

		public function authenticate () {
			global $CONFIG;
			/* if we're in demo mode, just allow all calls like we're logged in
				*/
			if ($this->demomode) {
				$this->authenticated = true;
				return;
			}
			/* auth it up
				*/
			$auth = $this->auth;
			$authentication = $auth->authenticate();
			$this->authenticated = $authentication["authenticated"] == true;
			if ($this->authenticated) {
				return;
			}
		}

		public function execute () {
			if ($this->authenticated) $this->runPrivate();
			$this->runPublic();
		}

		public function setUploadTypes ($arr) {
			$this->file_control_types = $arr;
		}
		
		public function invalidate () {
			$auth = $this->auth;
			return $auth->invalidate();
		}

		public function validate ($expiration) {
			$auth = $this->auth;
			return $auth->validate($expiration);
		}
		
		public function createUser ($username, $password, $email_address, $secret_question, $secret_question_answer=null, $secret_question_answer_hash=null) {
			/* clear any existing cookies
				*/
			$this->invalidate();
			setcookie("remember", "", time() - 3600);
			setcookie("username", "", time() - 3600);
			/* create the username/password hash
				*/
			Gateway::setUserHash($username, $password);
			/* create the username/password hash
				*/
			Gateway::setEmailHash($email_address, $secret_question, $secret_question_answer, $secret_question_answer_hash);
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
		
		/* ---- Static Methods Properties ---- */
		
		protected static function setUserHash ($username, $password=null, $password_hash=null) {
			global $CONFIG;
			$userhash = sha1(md5($username).md5($CONFIG->getNodeVal("setup.product_key")));
			$datapath = SA_DIR_AUTH . "/" . $userhash;
			$userdata = $password_hash!=null ? $password_hash : sha1(md5(SA_NAMESPACE).md5($password));
			Filesystem::deleteFile($datapath);
			return Filesystem::makeFile($datapath, $userdata);
		}
		
		protected static function setEmailHash ($email_address, $secret_question, $secret_question_answer=null, $secret_question_answer_hash=null) {
			global $CONFIG;
			$mailhash = sha1(sha1(md5($email_address).md5($CONFIG->getNodeVal("setup.product_key")))); // double sha in case they chooose thier email address as the username
			$datapath = SA_DIR_AUTH . "/" . $mailhash;
			$userdata = $secret_question;
			$userdata .= "\n";
			$userdata .= $secret_question_answer_hash!=null ? $secret_question_answer_hash : sha1(md5(SA_NAMESPACE).md5($secret_question_answer));
			Filesystem::deleteFile($datapath);
			return Filesystem::makeFile($datapath, $userdata);
		}
		
		protected static function getUserHash ($username) {
			global $CONFIG;
			$userhash = sha1(md5($username).md5($CONFIG->getNodeVal("setup.product_key")));
			$datapath = SA_DIR_AUTH . "/" . $userhash;
			return Filesystem::getFileData($datapath);
		}

		protected static function getEmailHash ($email_address) {
			global $CONFIG;
			$mailhash = sha1(sha1(md5($email_address).md5($CONFIG->getNodeVal("setup.product_key")))); // double sha in case they chooose thier email address as the username
			$datapath = SA_DIR_AUTH . "/" . $mailhash;
			return Filesystem::getFileData($datapath);
		}
		
		/* ---- Private Properties ---- */

		protected $post = array();
		protected $authenticated = false;
		protected $demomode = false;
		protected $file_control_types = array("gallery", "track", "image", "audio", "asset"); // legacy
		protected $action = "";
		protected $control = "";
		protected $command = "";
		protected $auth = null;

		protected function getRequestVariable ($name, $default="") {
			if (isset($this->post[$name])&&strlen($this->post[$name])>0) {
				if ($default==null&&$this->post[$name]=="null") {
					return null;
				}
				return $this->post[$name];
			}
			return $default;
		}

		protected function changeSystemPassword () {
			global $CONFIG;
			$username = $this->getRequestVariable("username");
			$o_password = $this->getRequestVariable("o_password");
			$n_password = $this->getRequestVariable("n_password");
			/* check username validity (and get the password hash)
				*/
			$userhash = Gateway::getUserHash($username);
			if ($userhash===false) {
				$this->respond(array(
					"data" => "Username Invalid"
				));
			}
			/* if the hash file doesnt exits, the username doesnt exist
				*/
			if ($o_password!==$userhash) {
				$this->respond(array(
					"data" => "Original Password Invalid"
				));
			}
			/* if w're here, new username is legit
				*/
			$this->respond(array(
				"success" => Gateway::setUserHash($username, null, $n_password),
				"data" => "Password Changed Successfully"
			));
		}

		protected function changeSystemUsername () {
			global $CONFIG;
			$o_username = $this->getRequestVariable("o_username");
			$n_username = $this->getRequestVariable("n_username");
			$password = $this->getRequestVariable("password");
			/* check username validity (and get the password hash)
				*/
			$userhash = Gateway::getUserHash($o_username);
			if ($userhash===false) {
				$this->respond(array(
					"data" => "Username Invalid"
				));
			}
			/* if the hash file doesnt exits, the username doesnt exist
				*/
			if ($password!==$userhash) {
				$this->respond(array(
					"data" => "Original Password Invalid"
				));
			}
			/* if w're here, new username is legit
				*/
			$this->respond(array(
				"success" => Gateway::setUserHash($n_username, null, $password),
				"data" => "Username Changed Successfully"
			));
		}

		protected function showPhpInfo () {
			global $CONFIG;
			if ($CONFIG->getNodeVal("setup.hub")=="true") exit();
			phpinfo();
			exit();
		}

		protected function clearSystemCache () {
			Filesystem::purgeFolder(SA_DIR_TEMP);
			Filesystem::purgeFolder(SA_DIR_CACHE);
			$this->getSystemInfo();
		}

		protected function setResellerID () {
			global $CONFIG;
			$reseller_id = $this->getRequestVariable("reseller_id", $CONFIG->getNodeVal("setup.reseller_id"));
			$config_filepath = SA_NAMESPACE."-config.xml";
			$config_filedata = Filesystem::getFileData($config_filepath);
			$config_filedata = Func::setTextBetween($config_filedata, "<reseller_id>", "</reseller_id>", $reseller_id);
			Filesystem::makeFile($config_filepath, $config_filedata);
			$this->getSystemInfo();
		}

		protected function refreshTemplateFiles () {
			$response = "Updating Templates ... \n<br />";
			if (file_exists(SA_DIR_STORAGE)) {
				/* get a list of default xml files to cross reference
					*/
				$defaults = array();
				$opendir = @opendir(SA_DIR_DEFAULTS);
				while (false !== ( $file = readdir($opendir) )) {
					if ($file == '.' || $file == '..' || is_dir(SA_DIR_DEFAULTS."/".$file) || is_link(SA_DIR_DEFAULTS."/".$file)) continue;
					$defaults[$file] = array();
				}
				closedir($opendir);
				$response .= "Base Templates: " . implode(", ", array_keys($defaults)) . "\n<br />";
				/* find any matching files as we traverse through the file structure
					*/
				$opendir = @opendir(SA_DIR_STORAGE);
				while (false !== ( $file = readdir($opendir) )) {
					if ($file == '.' || $file == '..' || is_link(SA_DIR_STORAGE."/".$file)) continue;
					if (isset($defaults[$file])) {
						$defaults[$file][] = SA_DIR_STORAGE."/".$file;
					}
					if(is_dir(SA_DIR_STORAGE."/".$file)) {
						$storage_sub_dir = SA_DIR_STORAGE."/".$file."/";
						$opensubdir = @opendir(SA_DIR_STORAGE."/".$file);
						while (false !== ( $subfile = readdir($opensubdir) )) {
							if ($subfile == '.' || $subfile == '..' || is_link($storage_sub_dir.$subfile)) continue;
							if (isset($defaults[$subfile])) {
								$defaults[$subfile][] = $storage_sub_dir.$subfile;
							}
						}
						closedir($opensubdir);
					}
				}
				closedir($opendir);
				foreach ($defaults as $template => $files) {
					if (count($files)==0) continue;
					$default = new SimpleXML4();
					$default->load(SA_DIR_DEFAULTS."/".$template);
					foreach($files as $file) {
						$original = new SimpleXML4();
						$original->load($file);
						$original->merge($default);
						$original->save();
						$response .= "Updated: " . $file . "\n<br />";
					}
				}
			}
			$response .= "Done!";
			$this->respond(array(
				"type" => "raw",
				"data" => $response
			));
		}

		protected function getFileInfo () {
			if ($CONFIG->getNodeVal("setup.hub")=="true") exit();
			$suid = $this->getRequestVariable("suid");
			$filename = $this->getRequestVariable("filename");
			if ($suid==""||$filename=="") return;
			$getID3 = new getID3;
			$fileinfo = $getID3->analyze(SA_DIR_STORAGE."/".$suid."/".$filename);
			print "<pre>";
			print_r($fileinfo);
			print "</pre>";
			exit();
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
			$reseller_id = $this->getRequestVariable("reseller_id", $CONFIG->getNodeVal("setup.reseller_id"));
			$last_updated = $CONFIG->getNodeVal("setup.last_updated");
			if (SA_DEMOMODE) $reseller_id = $CONFIG->getNodeVal("setup.reseller_id");
			$props = array(
				"last_updated" => 				is_numeric( $last_updated ) ? @date("m/d/Y", $CONFIG->getNodeVal("setup.last_updated")/1000) : "N/A",
				"product_version" => 			$CONFIG->getNodeVal("setup.product_version"),
				"reseller_id" => 				$reseller_id,
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
		
		protected function backup () {
			if (SA_DEMOMODE) {
				$this->respond(array(
					"success" => false
				));
			}
			$name = time();
			$archive = new PclZip(SA_DIR_TEMP."/$name.zip");
			$list = $archive->create(SA_DIR_STORAGE);
			$this->respond(array(
				"data" => $name,
				"success" => ($list==0?false:true)
			));
		}

		protected function cleanXmlOutput (&$source) {
			if (is_array($source)==false) return;
 			foreach($source as $key => $obj) {
				$key_fragments = explode("_", $key);
				$key_type = array_pop($key_fragments);
				if (isset($obj["_a"])) {
					if (isset($obj["_a"]["private"])) {
						unset($source[$key]);
					}
					$atts = array("access", "tags", "lines", "options", "toolbar", "min", "max", "increment", "encoded", "markdown", "action", "name", "suid", "extensions");
					foreach($atts as $att) {
						if (isset($obj["_a"][$att])) {
							unset($source[$key]["_a"][$att]);
						}
					}
				}
				if (isset($obj["_c"])) {
					$child = &$source[$key]["_c"];
					$this->cleanXmlOutput($child);
				}
				if (isset($obj[0])) {
					for ($i=0; $i<count($obj); ++$i) {
						$child = &$source[$key][$i]["_c"];
						$this->cleanXmlOutput($child);
					}
				}
			}
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

		protected function parsePublicXmlOutput ($str, $type, $suid) {
			$xmlobj = new SimpleXML4($str);
			$this->cleanXmlOutput($xmlobj->xml_array);
			return $xmlobj->toString();
		}

		protected function parsePublicFileOutput ($str, $name, $suid) {
			return $str;
		}

		protected function parsePublicSetOutput ($str, $name, $suid) {
			return $str;
		}

		protected function onUpdateSetTable ($table, $name, $suid, $puid) {
			return $table;
		}

		protected function onDeleteSetTable ($table, $name, $suid, $puid) {
			return $table;
		}

		protected function onDeleteFileTable ($table, $name, $suid, $type) {
			return $table;
		}

		protected function onUpdateFileObject ($table, $name, $suid, $type) {
			return $table;
		}

		protected function onUpdateFileTable ($table, $name, $suid, $type) {
			return $table;
		}

		/* ---- Public Execution ---- */

		protected function runPublic () {
			global $CONFIG;
			global $LANG;
			switch ($this->action) {
			 case "system_phpinfo" :
				$this->showPhpInfo();
				break;
			 case "create_gradient" :
				$hex1 = strtolower($this->getRequestVariable("hex1", "ffffff"));
				$hex2 = strtolower($this->getRequestVariable("hex2", "ffffff"));
				$height = strtolower($this->getRequestVariable("height", "500"));
				$image = new gd_gradient_fill(1, $height, 'vertical', $hex1, $hex2);
				exit();
				break;
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
			 case "reset_user_credentials" :
				$email_address = strtolower($this->getRequestVariable("email_address"));
				$secret_question_hash = $this->getRequestVariable("secret_question_hash");
				$mailhash = Gateway::getEmailHash($email_address);
				if ($mailhash===false) {
					$this->respond(array(
						"data" => "Address Supplied Does Not Match Address On File"
					));
				}
				/* ok, email address checks out, lets find out if they get thier own question right
					*/
				$fragments = explode("\n", $mailhash);
				$secret_question = $fragments[0];
				$secret_question_answer_hash = $fragments[1];
				//$submitted_answer_hash = sha1(md5(SA_NAMESPACE).md5($secret_question_answer));
				if ($secret_question_answer_hash!==$secret_question_hash) {
					$this->respond(array(
						"data" => "Incorrect Answer to Secret Question"
					));
				}
				/* ok, if we are here, that means they're legit.  start by deleting all the old stuff
					*/
				Filesystem::purgeFolder(SA_DIR_AUTH);
				/* create the new user
					*/
				$username = Func::generateMnemonicPhrase();
				$password = Func::generateMnemonicPhrase();
				$this->createUser($username, $password, $email_address, $secret_question, null, $secret_question_answer_hash);
				/* email it out
					*/
				$message = $LANG->lookup('Your New Temporary Credentials Email Body');
				$message = str_replace("{BASEURL}", Func::getBaseUrl(), $message);
				$message = str_replace("{ADMINURL}", Func::getBaseUrl() . "/" . SA_DIR_INDEXPATH . "?/admin/", $message);
				$message = str_replace("{USERNAME}", $username, $message);
				$message = str_replace("{PASSWORD}", $password, $message);
				/* send it off
					*/
				$success = mail($email_address, $LANG->lookup('Your New Temporary Credentials'), $message);
				$response = $success ? 'New Credentials Delivered' : 'New Credentials Delivery Failure';
				$this->respond(array(
					"success" => $success,
					"data" => $response
				));
			 case "get_secret_question" :
				$email_address = strtolower($this->getRequestVariable("email_address"));
				$mailhash = Gateway::getEmailHash($email_address);
				if ($mailhash===false) {
					$this->respond(array(
						"data" => "Address Supplied Does Not Match Address On File"
					));
				}
				$fragments = explode("\n", $mailhash);
				$this->respond(array(
					"success" => true,
					"data" => $fragments[0]
				));
			 case "login" :
				$username = $this->getRequestVariable("username");
				$password = $this->getRequestVariable("password");
				$persist = $this->getRequestVariable("persist");
				/* decide on cookie persistence
					*/
				$expiration = 0;
				if ($persist=="yes") $expiration = time()+60*60*24*14;
				/* check username validity (and get the password hash)
					*/
				$userhash = Gateway::getUserHash($username);
				if ($userhash===false) {
					$this->invalidate();
					$this->respond(array(
						"data" => "Username Invalid"
					));
				}
				/* check password validity
					*/
				if ($userhash!==$password) {
					$this->invalidate();
					$this->respond(array(
						"data" => "Password Invalid"
					));
				}
				/* ok, if we're here, we're logged in
					*/
				$this->respond(array(
					"success" => true,
					"data" => $this->validate($expiration)
				));
			 case "logout" :
				$this->invalidate();
				$this->respond(array(
					"success" => true
				));
			 case "auth_start" :
				$auth = $this->auth;
				$path = $auth->start();
				$this->doRedirect($path);
			 case "touch" :
				$auth = $this->auth;
				$token = $auth->token();
				$this->respond(array(
					"success" => true,
					"data" => $token
				));
				break;
			 case "toggle_flash" :
				$value = $this->getRequestVariable("value", "true");
				setcookie("flash", $value, 0);
				$path = Func::getBaseUrl() . "/" . SA_DIR_INDEXPATH;
				$this->doRedirect($path);
			 case "get_xml" :
				$type = $this->getRequestVariable("type", "");
				$suid = $this->getRequestVariable("suid", null);
				$required = $this->getRequestVariable("required", false);
				/* do some error checking
					a type is required
					*/
				$errors = array();
				if ($type=="") {
					$errors[] = $LANG->lookup('type is a required parameter');
				}
				/* if we're here, get the data
					*/
				$data = Flatfile::getXmlString($type, $suid, $required);
				/* see if it's empty
					*/
				if (strlen($data)==0) {
					$errors[] = $LANG->lookup('xml data set empty');
				} else {
					$data = $this->parsePublicXmlOutput($data, $type, $suid);
				}
				/* respond
					*/
				$this->respond(array(
					"type" => "xml",
					"errors" => $errors,
					"data" => $data
				));
			 case "get_files" :
				$type = $this->getRequestVariable("type", "");
				$suid = $this->getRequestVariable("suid", null);
				/* do some error checking
					a type is required
					*/
				$errors = array();
				if ($type=="") {
					$errors[] = $LANG->lookup('type is a required parameter');
				}
				/* if we're here, get the data
					*/
				$data = Flatfile::listFileTable($type, $suid);
				/* see if it's empty
					*/
				if (strlen($data)==0) {
					$errors[] = $LANG->lookup('file data set empty');
				} else {
					$data = $this->parsePublicFileOutput($data, $type, $suid);
				}
				/* return as xml if errors
					*/
				if (count($errors)>0) {
					$this->respond(array(
						"type" => "xml",
						"errors" => $errors
					));
				}
				/* otherwise, just spit out the data
					*/
				$this->respond(array(
					"type" => "raw",
					"data" => $data
				));
			 case "get_set" :
				$name = $this->getRequestVariable("name", "");
				$suid = $this->getRequestVariable("suid", null);
				/* do some error checking
					a type is required
					*/
				$errors = array();
				if ($name=="") {
					$errors[] = $LANG->lookup('name is a required parameter');
				}
				/* if we're here, get the data
					*/
				$data = Flatfile::listSetTable($name, $suid);
				if (strlen($data)==0) {
					$errors[] = $LANG->lookup('set data set empty');
				} else {
					$data = $this->parsePublicSetOutput($data, $name, $suid);
				}
				/* return as xml if errors
					*/
				if (count($errors)>0) {
					$this->respond(array(
						"type" => "xml",
						"errors" => $errors
					));
				}
				/* otherwise, just spit out the data
					*/
				$this->respond(array(
					"type" => "raw",
					"data" => $data
				));
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
			switch ($this->action) {
			 case "get_product_info" :
				$data = Func::getRemotePage("https://intothedarkroom.com/installer/ci/en/get-product/" . SA_NAMESPACE.  "/");
				$this->respond(array(
					"success" => true,
					"data" => $data
				));
				break;
			 case "import_tsm" :
				Filesystem::makeFolder(SA_DIR_TEMP);
				$proxy = new SideLoad;
				$proxy->setURL("https://intothedarkroom.com/internal/content/music/download.php?id=" . $CONFIG->getNodeVal("setup.install_id") . "&hub=" . $CONFIG->getNodeVal("setup.hub"));
				$proxy->downloadTo(SA_DIR_TEMP."/tsm.zip");
				$archive = new PclZip(SA_DIR_TEMP."/tsm.zip");
				$contents = $archive->extract(
					PCLZIP_OPT_PATH, SA_DIR_TEMP,
					PCLZIP_OPT_REMOVE_ALL_PATH);
				$folder = "track";
				$directory = SA_DIR_STORAGE . "/$folder";
				$tablepath = SA_DIR_STORAGE . "/$folder/$folder.table";
				Filesystem::makeFolder($directory);
				foreach ($contents as $file) {
					$filename = $file['stored_filename'];
					$filename = explode(".", $filename);
					$fileext = strtolower(array_pop($filename));
					$filename = implode(".", $filename);
					$filehash = Func::homogenize($filename) . "-" . Flatfile::createUID();
					$fileobject = array(
						"file" => array (
							"tmp" => $file['filename'],
							"name" => $filename,
							"basename" => $filename,
							"ext" => $fileext,
							"hash" => $filehash,
							"final" => $filehash . "." . $fileext,
							"path" => $directory . "/" . $filehash . "." . $fileext
						)
					);
					@rename($file['filename'], $fileobject["file"]["path"]);
					$fileobject = Flatfile::getFileAttributes($fileobject);
					$fileobject = array($fileobject["file"]["final"], $fileobject["file"]["name"], $fileobject["dimensions"], $fileobject["duration"], $fileobject["size"], "");
					$table = Flatfile::saveFile($fileobject, $folder);
					Flatfile::saveFileTable($table, $folder);
					@unlink($file['filename']);
				}
				@unlink(SA_DIR_TEMP."/tsm.zip");
				$response = Flatfile::listFileTable($folder);
				$this->respond(array(
					"success" => true,
					"data" => $response
				));
				break;
			}
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
				 case "setresellerid" :
					$this->setResellerID();
				 case "getinfo" :
					$this->getSystemInfo();
				 case "getfileinfo" :
					$this->getFileInfo();
				 case "backup" :
					$this->backup();
				 case "refreshtemplates" :
					$this->refreshTemplateFiles();
				}
			 case "account" :
				switch ($this->command) {
				 case "changepassword" :
					$this->changeSystemPassword();
				 case "changeusername" :
					$this->changeSystemUsername();
				}
			 case "setup" :
				$type = $this->getRequestVariable("type");
				$suid = $this->getRequestVariable("suid", null);
				switch ($this->command) {
				 case "save" :
					$data = $this->getRequestVariable("data");
					$this->respond(array(
						"success" => Flatfile::createXmlString($type, $suid, $data),
						"invalidate" => true
					));
				 case "revert" :
					$this->respond(array(
						"success" => Flatfile::revertXmlString($type, $suid),
						"invalidate" => true
					));
				 case "defaults" :
					$response = Flatfile::getXmlDefaults($type);
					$this->respond(array(
						"success" => $response!==false,
						"data" => $response
					));
				 case "load" :
					$response = Flatfile::getXmlString($type, $suid);
					$this->respond(array(
						"success" => $response!==false,
						"data" => $response
					));
				}
			 case "set" :
				$name = $this->getRequestVariable("name");
				$suid = $this->getRequestVariable("suid", null);
				$puid = $this->getRequestVariable("puid", null);
				switch ($this->command) {
				 case "list" :
					$response = Flatfile::listSetTable($name, $puid);
					$this->respond(array(
						"success" => true,
						"data" => $response
					));
				 case "reindex" :
					$from = $this->getRequestVariable("from");
					$to = $this->getRequestVariable("to");
					$response = Flatfile::sortSetTable($name, $from, $to, $puid);
					$this->respond(array(
						"success" => true,
						"data" => $response,
						"invalidate" => true
					));
				 case "delete" :
					$table = Flatfile::deleteSetTable($name, $suid, $puid);
					$table = $this->onDeleteSetTable($table, $name, $suid, $puid);
					$response = Flatfile::saveSetTable($table, $name, $puid);
					$this->respond(array(
						"success" => true,
						"data" => $response,
						"invalidate" => true
					));
				 case "create" :
					if ($suid==null) $suid = Flatfile::createUID();
				 case "update" :
					$data = $this->getRequestVariable("data");
					$data = $this->parseTableRowData($data);
						array_unshift($data, $suid);
					$table = Flatfile::updateSetTable($name, $data, $puid);
					$table = $this->onUpdateSetTable($table, $name, $suid, $puid);
					$response = Flatfile::saveSetTable($table, $name, $puid);
					$this->respond(array(
						"success" => true,
						"data" => $response,
						"invalidate" => true
					));
				}
			}
			if (in_array($this->control, $this->file_control_types)) {
				$name = $this->getRequestVariable("name");
				$suid = $this->getRequestVariable("suid", null);
				$type = $this->control;
				if ($suid==null) $suid = $type;
				switch ($this->command) {
				 case "list" :
					$response = Flatfile::listFileTable($type, $suid);
					$this->respond(array(
						"success" => true,
						"data" => $response
					));
				 case "reindex" :
					$from = $this->getRequestVariable("from");
					$to = $this->getRequestVariable("to");
					$indices = $this->getRequestVariable("indices");
					if (strlen($indices)>0) {
						$from = array();
						$to = array();
						$indices = explode(";", $indices);
						for ($i=0; $i<count($indices); ++$i) {
							$pair = $indices[$i];
							$pair = explode(",", $pair);
							$from[] = $pair[0];
							$to[] = $pair[1];
						}
					}
					$response = Flatfile::sortFileTable($type, $suid, $from, $to);
					$this->respond(array(
						"success" => true,
						"data" => $response,
						"invalidate" => true
					));
				 case "snapshot" :
					$filename = $this->getRequestVariable("filename", null);
					$data = $this->getRequestVariable("data", null);
					$response = Flatfile::addSnapshot($type, $suid, $filename, $data);
					$success = false;
					switch ($response) {
					 case -100 :
						$response = "Operation Not Allowed";
						break;
					 case -200 :
						$response = "Filename Required";
						break;
					 case -300 :
						$response = "File Data Required";
						break;
					 default :
						$success = true;
					}
					$this->respond(array(
						"success" => $success,
						"data" => $response,
						"invalidate" => true
					));
				 case "test" :
					print_r($_POST);
					print_r($_FILES);
					exit;
				 case "sideload" :
				 case "upload" :
					$service_uri = 		$this->getRequestVariable("uri", null);
					$filename = 		$this->getRequestVariable("filename", null);
					$process_video = 	$this->getRequestVariable("video", "false");
					$is_snapshot = 		$this->getRequestVariable("snapshot", "false");
					if ($service_uri!=null) {
						if ($process_video=="false") {
							$fileobject = Flatfile::sideloadFile($type, $suid, $service_uri, $filename);
						} else {
							$fileobject = Flatfile::addFileUrl($type, $suid, $service_uri, $filename);
						}
					} else {
						$filename = $this->getRequestVariable("snapshot_id", $filename);
						$fileobject = Flatfile::uploadFile($type, $suid, $is_snapshot, $filename);
					}
					$fileobject = $this->onUpdateFileObject($fileobject, $name, $suid, $type);
					/* figure out what to output
						*/
					$response = is_array($fileobject) ? implode("\t", $fileobject) : $fileobject;
					$success = false;
					switch ($fileobject) {
					 case -100 :
						$response = "Cannot Import Uploaded File";
						break;
					 case -200 :
						$response = "Cannot Copy Local File";
						break;
					 case -300 :
						$response = "URL Does Not Exist";
						break;
					 case -400 :
						$response = "Sideloader Class Unavailable";
						break;
					 case -500 :
						$response = "Invalid File Type";
						break;
					 case -600 :
						$response = "Image Too Large";
						break;
					 default :
						$success = true;
						if ($is_snapshot=="false") {
							$table = Flatfile::saveFile($fileobject, $type, $suid);
							$table = $this->onUpdateFileTable($table, $name, $suid, $type);
							Flatfile::saveFileTable($table, $type, $suid);
						}
					}
					$this->respond(array(
						"success" => $success,
						"data" => $response,
						"invalidate" => true
					));
				 case "update" :
					$data = $this->getRequestVariable("data");
					$data = $this->parseTableRowData($data);
					$table = Flatfile::updateFileTable($type, $suid, $data);
					$table = $this->onUpdateFileTable($table, $name, $suid, $type);
					$response = Flatfile::saveFileTable($table, $type, $suid);
					$this->respond(array(
						"success" => true,
						"data" => $response,
						"invalidate" => true
					));
				 case "delete" :
					$files = $this->getRequestVariable("files");
					$files = explode(",", $files);
					$table = Flatfile::deleteFileTable($type, $suid, $files);
					$table = $this->onDeleteFileTable($table, $name, $suid, $type);
					$response = Flatfile::saveFileTable($table, $type, $suid);
					$this->respond(array(
						"success" => true,
						"data" => $response,
						"invalidate" => true
					));
				}
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