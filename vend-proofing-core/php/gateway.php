<?php

	use \DrewM\MailChimp\MailChimp;

	/* disable direct access
		*/
	if (count(get_included_files())==1) exit();

	/* extend the gateway class to include any custom functionality
		*/
	class LocalGateway extends Gateway {

		public function time_to_decimal($time) {
			if (strlen($time)==0) return 0;
			$timeArr = explode(':', $time);
			$decTime = $timeArr[0] . "." . (($timeArr[1]/60)*100);
			return $decTime;
		}

		protected function runPrivate () {
			global $CONFIG;
			global $LANG;
			switch ($this->action) {
			 case "delete_dropbox_set" :
				$dropboxer = new Dropboxer();
				list($success, $data, $error) = $dropboxer->connect();
				if ($success) {
					$orderid = $this->getRequestVariable("orderid");
					list($success, $data, $error) = $dropboxer->deleteDownloadFiles($orderid);
					if ($success) {
						$this->respond(array(
							"success" => true,
							"data" => $data
						));
					} else {
						$this->respond(array(
							"success" => false,
							"data" => $LANG->lookup($data) . " - " . $error
						));
					}
				} else {
					$this->respond(array(
						"success" => false,
						"data" => $LANG->lookup($data) . " - " . $error
					));
				}
			 case "next_dropbox_chunk" :
				$dropboxer = new Dropboxer();
				list($success, $data, $error) = $dropboxer->connect();
				if ($success) {
					$suid = $this->getRequestVariable("suid");
					list($success, $data, $error) = $dropboxer->processNextChunk($suid);
					if ($success) {
						$this->respond(array(
							"success" => true,
							"data" => $data
						));
					} else {
						$this->respond(array(
							"success" => false,
							"data" => $LANG->lookup($data) . " - " . $error
						));
					}
				} else {
					$this->respond(array(
						"success" => false,
						"data" => $LANG->lookup($data) . " - " . $error
					));
				}
			 case "sync_dropbox" :
				$dropboxer = new Dropboxer();
				list($success, $data, $error) = $dropboxer->connect();
				if ($success) {
					$suid = $this->getRequestVariable("suid");
					list($success, $data, $error) = $dropboxer->syncFolder($suid);
					if ($success) {
						$this->respond(array(
							"success" => true
						));
					} else {
						$this->respond(array(
							"success" => false,
							"data" => $LANG->lookup($data) . " - " . $error
						));
					}
				} else {
					$this->respond(array(
						"success" => false,
						"data" => $LANG->lookup($data) . " - " . $error
					));
				}
			 case "dropboxset_meta" :
				$suid = $this->getRequestVariable("suid");
				$category_file = SA_DIR_STORAGE."/$suid/set.category.table";
				$images_file = SA_DIR_STORAGE."/$suid/image.table";
				$last_modified = "---";
				$props = array();
				if (file_exists($images_file)) {
					$data = Filesystem::getFileArray($images_file);
					$props["last_updated"] = date("m/d/Y", @filemtime($images_file));
					$props["image_count"] = count($data);
				}
				if (file_exists($category_file)) {
					$data = Filesystem::getFileArray($category_file);
					if (!isset($props["last_updated"])) {
						$props["last_updated"] = date("m/d/Y", @filemtime($category_file));
					}
					$props["category_count"] = count($data);
				}
				$response = "";
				foreach ($props as $key => $value) {
					$response .= $response=="" ? $key . "=" . $value : "&" . $key . "=" . $value;
				}
				$this->respond(array(
					"success" => true,
					"data" => $response
				));
			 case "zipfile_meta" :
				$suid = $this->getRequestVariable("suid");
				$zipurl = SA_DIR_DATAPATH . "/uploads/$suid.zip";
				$category_file = SA_DIR_STORAGE."/$suid/set.zipfile-category.table";
				$success = file_exists($zipurl);
				if ($success) {
					$props = array(
						"last_updated" => file_exists($category_file) ? date("m/d/Y", @filemtime($category_file)) : "N/A",
						"size" => Func::bytesToSize(filesize($zipurl))
					);
				} else {
					$props = array(
						"last_updated" => "---",
						"filesize" => "N/A"
					);
				}
				$response = "";
				foreach ($props as $key => $value) {
					$response .= $response=="" ? $key . "=" . $value : "&" . $key . "=" . $value;
				}
				$this->respond(array(
					"success" => $success,
					"data" => $response
				));
			 case "verify_zip_file" :
				$suid = $this->getRequestVariable("suid");
				$zipurl = SA_DIR_DATAPATH . "/uploads/$suid.zip";
				$archive = new PclZip($zipurl);
				$success = true;
				if (file_exists($zipurl)==false) {
					$success = false;
				} else {
					function cleanExtractedFilename ($p_event, &$p_header)
					{
						// cget pertinant info
						$stored_filename = trim($p_header['stored_filename'], "/");
						$folder = $p_header['folder'];
						$filename = $p_header['filename'];
						$index = $p_header['index'];
						// skip any folders
						if ($folder==true) return 0;
						// skip any folders
						if (substr($stored_filename, 0, 8)=="__MACOSX") return 0;
						// skip anything that isn't an image
						$extension = strtolower(substr($stored_filename, strrpos($stored_filename, '.')+1));
						if (in_array($extension, array("jpg", "jpeg", "png"))==false) return 0;
						// ok, if we're here, lets extract it to a unique name
						$filename_bits = explode("/", $filename);
						$filename = array_pop($filename_bits);
						$filename = $index.".".$extension;
						$filename_bits[] = $filename;
						$p_header['filename'] = implode("/", $filename_bits);
						return 1;
					}
					$extractpath = SA_DIR_TEMP."/".$suid;
					$contents = $archive->extract(
						PCLZIP_OPT_PATH, $extractpath,
						PCLZIP_CB_PRE_EXTRACT, "cleanExtractedFilename",
						PCLZIP_OPT_REMOVE_ALL_PATH);
					if ($contents==0) {
						$success = false;
					} else {
						$lookup = array();
						$total = count($contents);
						for ($i=0; $i<$total; ++$i) {
							$obj = $contents[$i];
							$filename = $obj['filename'];
							$stored_filename = trim($obj['stored_filename'], "/");
							$folder = trim($obj['folder'], "/");
							$status = trim($obj['status'], "/");
							if (substr($stored_filename, 0, 8)=="__MACOSX") continue;
							if ($status=="skipped") continue;
							if ($folder==true) {
								$folder = trim($stored_filename, "/");
								$folderhash = md5($folder);
								if (isset($lookup[$folderhash])==false) {
									$folderbits = explode("/", $folder);
									$lookup[$folderhash] = array();
									$lookup[$folderhash]["images"] = array();
									$lookup[$folderhash]["category"] = array_pop($folderbits);
								}
							} else {
								$filenamebits = explode("/", $stored_filename);
								array_pop($filenamebits);
								$folder = implode("/", $filenamebits);
								$folder = trim($folder, "/");
								$folderhash = md5($folder);
								if (isset($lookup[$folderhash])) {
									$imagesize = getimagesize($filename);
									$image_width = $imagesize[0];
									$image_height = $imagesize[1];
									$lookup[$folderhash]["images"][] = array("name"=>basename($stored_filename),"index"=>$i,"dimensions"=>$image_width."x".$image_height);
									@unlink($filename);
								}
							}
						}
						$datapath = SA_DIR_STORAGE . "/" . $suid;
						$category = "";
						$fileindex = "";
						$image_total = 0;
						$category_total = 0;
						foreach ($lookup as $folderhash => $obj) {
							$images = count($obj["images"]);
							if ($images==0) continue;
							$image_total += $images;
							$category_total += 1;
							$category .= $folderhash . "\t" . $obj["category"] . "\t" . $images . "\n";
							for ($i=0; $i<$images; ++$i) {
								$imgobj = $obj["images"][$i];
								$fileindex .= $imgobj["index"] . "\t" . $folderhash . "\t" . $imgobj["name"] . "\t" . $imgobj["dimensions"] . "\n";
							}
						}
						if ($category_total==0) {
							$success = false;
						} else {
							$category = trim($category);
							$fileindex = trim($fileindex);
							Filesystem::makeFile(SA_DIR_STORAGE."/$suid/set.zipfile-category.table", $category);
							Filesystem::makeFile(SA_DIR_STORAGE."/$suid/set.zipfile-fileindex.table", $fileindex);
							$table = Flatfile::getSetTable("page");
							$table = Flatfile::updateSetTable("page", array($suid, null, null, $image_total));
							Flatfile::saveSetTable($table, "page");
							$session = Flatfile::getSetTable("session", $suid);
							foreach ($session as $hash => $object) {
								@unlink(SA_DIR_STORAGE."/$suid/set.$hash.table");
							}
							@unlink(SA_DIR_STORAGE."/$suid/set.session.table");
						}
						@rmdir($extractpath);
					}
				}
				$this->respond(array(
					"type" => "txt",
					"success" => $success
				));
			 case "duplicate_set" :
				$new_suid = Flatfile::createUID();
				$old_suid = $this->getRequestVariable("suid");
				$name = $this->getRequestVariable("name");
				$data = $this->getRequestVariable("data");
				$data = $this->parseTableRowData($data);
					array_unshift($data, $new_suid);
				$table = Flatfile::updateSetTable($name, $data);
				$response = Flatfile::saveSetTable($table, $name);
				Filesystem::makeFolder(SA_DIR_STORAGE."/".$new_suid);
				$handle = @opendir(SA_DIR_STORAGE."/".$old_suid);
				if ($handle) {
					while (false !== ( $file = readdir($handle) )) {
						if ($file == '.' || $file == '..' || is_dir($file)) continue;
						@copy(SA_DIR_STORAGE."/".$old_suid."/".$file, SA_DIR_STORAGE."/".$new_suid."/".$file);
					}
					closedir($handle);
				}
				$this->respond(array(
					"success" => true,
					"data" => $response,
					"invalidate" => true
				));
			 case "get_log_file" :
				$orderid = $this->getRequestVariable("orderid");
				$order = new Order();
				$response = $order->getLogById($orderid);
				$this->respond(array(
					"success" => true,
					"data" => $response
				));
			 case "order_search" :
				$start = $this->getRequestVariable("date_start");
				$end = $this->getRequestVariable("date_end");
				$payment_type = $this->getRequestVariable("payment_type");
				$orderid = $this->getRequestVariable("orderid");
				$setid = $this->getRequestVariable("setid");
				$full_name = $this->getRequestVariable("full_name");
				$email_address = $this->getRequestVariable("email_address");
				$params = array();
				if ($payment_type!="") $params["payment_type"] = $payment_type;
				if ($orderid!="") $params["orderid"] = $orderid;
				if ($setid!="") $params["setid"] = $setid;
				if ($full_name!="") $params["full_name"] = $full_name;
				if ($email_address!="") $params["email_address"] = $email_address;
				$order = new Order();
				$response = $order->search($start, $end, $params);
				$this->respond(array(
					"success" => true,
					"data" => $response
				));
			 case "order_stats_search" :
				$start = $this->getRequestVariable("start");
				$end = $this->getRequestVariable("end");
				$order = new Order();
				$response = $order->statsSearch($start, $end);
				$this->respond(array(
					"success" => true,
					"data" => $response
				));
			 case "delete_order" :
				$orderid = $this->getRequestVariable("orderid");
				$timestamp = $this->getRequestVariable("timestamp");
				$order = new Order();
				$response = $order->deleteOrder($orderid, $timestamp);
				$this->respond(array(
					"success" => true
				));
			 case "authorize_dropbox" :
				$dropboxer = new Dropboxer();
				list($success, $data, $error) = $dropboxer->authorize();
				if ($success) {
					header("Location: " . $data);
					exit();
				} else {
					$error = $LANG->lookup($data) . " - " . $error;
					$help_link_uri = "https://intothedarkroom.zendesk.com/hc/en-us/articles/209636333";
					include SA_DIR_COREPATH . "/tmpl/html/1.page.init.tmpl";
					exit();
				}
			 case "test_mail_setup" :
				$ordering = Flatfile::getXmlArray("ordering");
				$contact = Flatfile::getXmlArray("contact");
				$language = Flatfile::getXmlArray("language");
				// pre
				$pre = array();
				$pre["SET_URL"] = "";
				$pre["MESSAGE"] = "This is a test.";
				// the post-markdown array
				$post = array();
				$post["SET_ID"] = "";
				$post["OWNER_NAME"] = $contact->getNodeVal("data.details.your_email");
				$post["OWNER_EMAIL"] = $contact->getAttrVal("data.details.your_email.href");
				$post["SENDER_NAME_LABEL"] = $language->getNodeVal("data.contact.mail_form_name");
				$post["SENDER_EMAIL_LABEL"] = $language->getNodeVal("data.contact.mail_form_email_address");
				$post["MESSAGE_LABEL"] = $language->getNodeVal("data.contact.mail_form_message");
				$post["PASSWORD"] = "";
				$post["EXPIRATION"] = $language->getNodeVal("data.splash.expiration_never");
				// inbox
				$inbox_email = $post["OWNER_EMAIL"];
				$inbox_name = $post["OWNER_NAME"];
				if ( $ordering!=false ) {
					$inbox_email = $ordering->getAttrVal("data.ordering.offline_order_inbox_email.href");
					$inbox_name = $ordering->getNodeVal("data.ordering.offline_order_inbox_email");
					if ( $inbox_email==null ) {
						$inbox_email = $post["OWNER_EMAIL"];
						$inbox_name = $post["OWNER_NAME"];
					}
				}
				// send
				$email = new Email();
				$email->logMessage(false);
				$email->doDebug(true);
				$email->setSender($post["OWNER_EMAIL"], $post["OWNER_NAME"]);
				$email->setRecipient($inbox_email, $inbox_name);
				$email->setSubjectTemplate("data.contact.output_general_subject");
				$email->setBodyTemplate("data.contact.output_general_message_body");
				$email->addPreTags($pre);
				$email->addPostTags($post);
				$email->send();
				if ($email->success()) {
					$init_title = $LANG->lookup("mail sent successfully");
					$init_description = $LANG->lookup("mail sent successfully description");
					$help_link_uri = "";
					unset($error);
				} else {
					$init_title = $LANG->lookup("mail failed to send");
					$init_description = $LANG->lookup("mail failed to send description");
					$help_link_uri = "";
					$error = $email->getErrorLog();
					$error = implode("<br />\n", $error);
				}
				include SA_DIR_COREPATH . "/tmpl/html/1.page.init.tmpl";
				exit();
			 case "output_bulkmail" :
				$contact = Flatfile::getXmlArray("contact");
				$language = Flatfile::getXmlArray("language");
				// incoming
				$suid = $this->getRequestVariable("suid");
				$template = $this->getRequestVariable("template");
				$recipients = $this->getRequestVariable("recipients");
				$include_contacts = $this->getRequestVariable("include_contacts")=="true";
				$include_sessions = $this->getRequestVariable("include_sessions")=="true";
				$message = $this->getRequestVariable("message");
				// get some more info
				$password = "";
				$expiry = "";
				if ($include_sessions==true) {
					$sessions = Flatfile::getSetTable("session", $suid);
					foreach ($sessions as $obj) {
						$recipients .= "," . $obj[1];
					}
				}
				$page_data = Flatfile::getXmlArray("uploadset", $suid, true);
				if ($page_data==false) {
					$page_data = Flatfile::getXmlArray("zipfile", $suid, true);
				}
				if ($page_data==false) {
					$page_data = Flatfile::getXmlArray("categoryset", $suid, true);
				}
				if ($page_data==false) {
					$page_data = Flatfile::getXmlArray("dropboxset", $suid, true);
				}
				if ($page_data) {
					$password = $page_data->getNodeVal("data.settings.password");
					if ($password!=null) {
						$password = base64_decode($password);
					}
					if ($include_contacts==true) {
						$recipients .= "," . $page_data->getNodeVal("data.settings.set_contact_list");
					}
					$date_pattern = $language->getNodeVal("data.localization.date_pattern");
					$expiry = $language->getNodeVal("data.splash.expiration_never");
					$expires_on_date = $page_data->getNodeVal("data.settings.expires_on_date");
					$expires_on_date_timezone = $page_data->getAttrVal("data.settings.expires_on_date.timezone");
					$expires_on_date_offset = $page_data->getAttrVal("data.settings.expires_on_date.offset");
					if ($expires_on_date>0&&strlen($expires_on_date)>0&&$expires_on_date!=null) {
						if (strlen($expires_on_date_timezone)>0) { // old sets not re-set will default to the original time zone
							if (function_exists("date_default_timezone_set")==false) @putenv("TZ=$expires_on_date_timezone");
							else @date_default_timezone_set($expires_on_date_timezone);
						}
						$expires_on_date_actual = $expires_on_date/1000;
						if (strlen($expires_on_date_offset)>0) { // old sets not re-set will default to the original time zone
							$expires_on_date_actual = $expires_on_date_actual - ($this->time_to_decimal($expires_on_date_offset)*60*60) - (date("I", $expires_on_date/1000)==1?3600:0);
						}
						$expiry = date($date_pattern, $expires_on_date_actual);
					}
				}
				// the pre-markdown array
				$pre = array();
				$pre["SET_URL"] = $this->getRequestVariable("set_url");
				$pre["MESSAGE"] = $message;
				// the post-markdown array
				$post = array();
				$post["SET_ID"] = $suid;
				$post["OWNER_NAME"] = $contact->getNodeVal("data.details.your_email");
				$post["OWNER_EMAIL"] = $contact->getAttrVal("data.details.your_email.href");
				$post["SENDER_NAME_LABEL"] = $language->getNodeVal("data.contact.mail_form_name");
				$post["SENDER_EMAIL_LABEL"] = $language->getNodeVal("data.contact.mail_form_email_address");
				$post["MESSAGE_LABEL"] = $language->getNodeVal("data.contact.mail_form_message");
				$post["PASSWORD"] = $password;
				$post["EXPIRATION"] = $expiry;
				// ok, send it out
				$email = new Email();
				$email->logMessage(false);
				$email->setSender($post["OWNER_EMAIL"], $post["OWNER_NAME"]);
				$email->addRecipients($recipients);
				$email->setSubjectTemplate("data.contact.".$template."_subject");
				$email->setBodyTemplate("data.contact.".$template."_message_body");
				$email->addPreTags($pre);
				$email->addPostTags($post);
				$email->send();
				// the aftermath
				$success = $email->success();
				$data = "";
				switch ($email->error()) {
				 case "no_contact";
				 case "no_subject";
				 case "no_body";
					$data = $LANG->lookup("Contact Page Not Setup");
					break;
				 case "no_recipients";
				 case "invalid_email";
					$data = $LANG->lookup("Bulk Mailer No Recipients");
					break;
				 case "send_failure";
					$data = $LANG->lookup("Bulk Mailer Failure");
					break;
				 case "partial_send_success";
					$data = $LANG->lookup("Bulk Mailer Partial Success");
					break;
				 case "send_success";
					$data = $LANG->lookup("Bulk Mailer Success");
					break;
				}
				$this->respond(array(
					"success" => $success,
					"data" => $data
				));
			}
			parent::runPrivate();
		}

		protected function runPublic () {
			global $CONFIG;
			global $LANG;
			switch ($this->action) {
			 case "get_public_asset" :
				$folder = $this->getRequestVariable("folder", "asset");
				$filename = $this->getRequestVariable("filename");
					$filename = basename($filename);
				$asset_path = SA_DIR_STORAGE . "/$folder/" . $filename;
				if (strlen($filename)>0&&file_exists($asset_path)&&is_file($asset_path)) {
					$file_extension = strtolower(substr(strrchr($filename,"."),1));
					switch ($file_extension) {
						case "pdf": $ctype="application/pdf"; break;
						case "zip": $ctype="application/zip"; break;
						case "gif": $ctype="image/gif"; break;
						case "png": $ctype="image/png"; break;
						case "jpe": case "jpeg":
						case "jpg": $ctype="image/jpg"; break;
						default: $ctype="application/force-download";
					}
					header("Content-Type: $ctype");
					readfile($asset_path);
					exit();
				} else {
					header($_SERVER["SERVER_PROTOCOL"]." 404 Not Found");
					exit();
				}
			 case "validate_paypal_ipn" :
			 case "process_credit_card" :
			 case "finalize_order" :
				// incoming
				$puid = $this->getRequestVariable("puid");
				$name = $this->getRequestVariable("name");
				$data = $this->getRequestVariable("data");
				$cc_num = $this->getRequestVariable("cc_num");
				$cc_expiry = $this->getRequestVariable("cc_expiry");
				$cc_cvv = $this->getRequestVariable("cc_cvv");
				$cc_zip = $this->getRequestVariable("cc_zip");
				// create order
				$order = new Order();
				$order->setAction($this->action);
				$order->setOrderProps($puid, $name, $data);
				$order->setCCProps($cc_num, $cc_expiry, $cc_cvv, $cc_zip);
				$order->process();
				// done
				$success = $order->success() ? "true" : "false";
				$error = $order->error();
				$this->respond(array(
					"data" => $success . "\t" . $error,
					"type" => "raw"
				));
			 case "prequalify_order" :
				// incoming
				$puid = $this->getRequestVariable("puid");
				$code = $this->getRequestVariable("code");
				$subtotal = $this->getRequestVariable("subtotal", 0);
				$orderid = $this->getRequestVariable("orderid");
				$email = $this->getRequestVariable("email");
				if ($email!="") {
					// verfiy email address first
					if (Func::validEmail($email)==false) {
						$this->respond(array(
							"data" => "false\tinvalid_email_address",
							"type" => "raw"
						));
					}
				}
				$order = new Order();
				// verfiy discount
				if ($code!="") {
					$result = $order->verifyDiscountCode($puid, $code, $subtotal);
					if ($result[0]==false) {
						$result[0] = "false";
						$this->respond(array(
							"data" => implode("\t", $result),
							"type" => "raw"
						));
					}
					// ok, everything check out apply discount here
					$result = $order->applyDiscountCode($puid, $code);
				}
				// create a new order id
				if (strlen($orderid)==0) $orderid = Flatfile::createUID();
				// done
				$this->respond(array(
					"data" => "true\t$orderid",
					"type" => "raw"
				));
			 case "verify_discount_code" :
				// incoming
				$puid = $this->getRequestVariable("puid");
				$code = $this->getRequestVariable("code");
				$subtotal = $this->getRequestVariable("subtotal", 0);
				// check to see if it's a local discount
				$order = new Order();
				$result = $order->verifyDiscountCode($puid, $code, $subtotal);
					$result[0] = $result[0]==true ? "true" : "false";
				// done
				$this->respond(array(
					"data" => implode("\t", $result),
					"type" => "raw"
				));
			 case "list_session_table" :
				// incoming
				$puid = 		$this->getRequestVariable("puid");
				$name = 		$this->getRequestVariable("name");
				$type = 		$this->getRequestVariable("type");
				if ($puid==null) {
					$this->respond(array(
						"type" => "xml",
						"errors" => array($LANG->lookup('a valid puid parameter is required'))
					));
				}
				// get data
				$tablepath = 	SA_DIR_STORAGE . "/$puid/set.$name.table";
				$response = 	Flatfile::getTableString($tablepath);
				// done
				$this->respond(array(
					"type" => "raw",
					"data" => $response
				));
			 case "delete_session_type" :
				// incoming
				$puid = 		$this->getRequestVariable("puid");
				$name = 		$this->getRequestVariable("name");
				$type = 		$this->getRequestVariable("type");
				// no parent, kill it
				if ($puid==null) {
					$this->respond(array(
						"type" => "xml",
						"errors" => array($LANG->lookup('a valid puid parameter is required'))
					));
				}
				// delete the line item, no matter what it is
				$tablepath = 	SA_DIR_STORAGE . "/$puid/set.$name.table";
				$table =		Flatfile::getTableArray($tablepath);
				if ($type=="favorites") { // delete only favorites
					foreach ($table as $id => $row) {
						if (substr($row[0], -2)!=="-f") continue; // filter out everything but favorites
						unset($table[$id]);
					}
				} else if ($type=="download") { // delete only download
					foreach ($table as $id => $row) {
						if (substr($row[0], -2)!=="-d") continue; // filter out everything but download
						unset($table[$id]);
					}
				} else if ($type=="cart") { // the rest of the cart
					foreach ($table as $id => $row) {
						if (substr($row[0], -2)=="-f") continue; // filter out any favorites
						unset($table[$id]);
					}
				} else if ($type=="alacarte") {
					foreach ($table as $id => $row) {
						$hash = $row[0];
						if (substr($row[0], -2)=="-d") continue; // skip all download
						if (substr($row[0], -2)=="-f") continue; // skip all favorites
						if (substr($row[0], -2)=="-p") continue; // skip all packages
						if (strstr($hash, ":")!==false) continue; // skip all package entries
						unset($table[$id]); // a la carte, delete
					}
				}
				Flatfile::saveTableArray($tablepath, $table);
				// do some updating in the global table
				$tablepath = 	SA_DIR_STORAGE . "/$puid/set.session.table";
				$response =		"";
				if ($type=="favorites") { // return only favorites
					$favorites = "0";
					foreach ($table as $row) {
						if (substr($row[0], -2)!=="-f") continue; // filter out everything but favorites
						$favorites += 1; // quantity
						$response .= implode("\t", $row) . "\n";
					}
					$data = array($name, null, null, null, $favorites);
				} else { // plain ala cart item
					$items = "0";
					$subtotal = "0";
					foreach ($table as $row) {
						if (substr($row[0], -2)=="-p") { // packages
							$subtotal += $row[5]; // subtotal
							$subtotal += $row[6]; // shipping
							$response .= implode("\t", $row) . "\n";
						}
					}
					foreach ($table as $row) {
						if (substr($row[0], -2)=="-d") { // download
							$items += 1; // quantity
							$subtotal += $row[6]; // price
							$response .= implode("\t", $row) . "\n";
						}
					}
					foreach ($table as $row) {
						if (substr($row[0], -2)=="-d") continue; // filter out any download
						if (substr($row[0], -2)=="-f") continue; // filter out any favorites
						if (substr($row[0], -2)=="-p") continue; // filter out any packages
						$hashbits = explode(":", $row[0]);
						$quantity = $row[4];
						$items += $quantity;
						$subtotal += $row[19]*$quantity; // subtotal
						$subtotal += $row[20]*$quantity; // shipping
						$response .= implode("\t", $row) . "\n";
					}
					$data = array($name, null, $items, $subtotal, null);
				}
				$table = 		Flatfile::updateTableRow($tablepath, $data);
							Flatfile::saveTableArray($tablepath, $table);
				// done
				$this->respond(array(
					"type" => "raw",
					"data" => trim($response, "\n")
				));
			 case "delete_session_item" :
				// incoming
				$puid = 		$this->getRequestVariable("puid");
				$suid = 		$this->getRequestVariable("suid");
				$name = 		$this->getRequestVariable("name");
				$type = 		$this->getRequestVariable("type");
				// no parent, kill it
				if ($puid==null) {
					$this->respond(array(
						"type" => "xml",
						"errors" => array($LANG->lookup('a valid puid parameter is required'))
					));
				}
				// delete the line item, no matter what it is
				$tablepath = 	SA_DIR_STORAGE . "/$puid/set.$name.table";
				if ($type=="favorites") { // delete only favorites
					$table =	Flatfile::deleteTableRow($tablepath, $suid);
							Flatfile::saveTableArray($tablepath, $table);
				} else if ($type=="download") { // delete only download
					$table =	Flatfile::deleteTableRow($tablepath, $suid);
							Flatfile::saveTableArray($tablepath, $table);
				} else if ($type=="cart") { // the rest of the cart
					$table =	Flatfile::deleteTableRow($tablepath, $suid);
							Flatfile::saveTableArray($tablepath, $table);
				} else if ($type=="package") {
					$table =	Flatfile::getTableArray($tablepath);
					foreach ($table as $id => $row) {
						$hash = $row[0];
						if ($hash==$suid) unset($table[$id]); // found exact pacakge match, delete
						if (substr($row[0], -2)=="-d") continue; // skip all download
						if (substr($row[0], -2)=="-f") continue; // skip all favorites
						if (substr($row[0], -2)=="-p") continue; // skip any other packages
						if (strstr($hash, ":")===false) continue; // not a package entry
						$hashbits = explode(":", $hash);
						if ($hashbits[1]."-p"==$suid) unset($table[$id]); // found child of package, delete
					}
					Flatfile::saveTableArray($tablepath, $table);
				}
				// do some updating in the global table
				$tablepath = 	SA_DIR_STORAGE . "/$puid/set.session.table";
				$response =		"";
				if ($type=="favorites") { // return only favorites
					$favorites = "0";
					foreach ($table as $row) {
						if (substr($row[0], -2)!=="-f") continue; // filter out everything but favorites
						$favorites += 1; // quantity
						$response .= implode("\t", $row) . "\n";
					}
					$data = array($name, null, null, null, $favorites);
				} else { // plain ala cart item
					$items = "0";
					$subtotal = "0";
					foreach ($table as $row) {
						if (substr($row[0], -2)=="-p") { // packages
							$subtotal += $row[5]; // subtotal
							$subtotal += $row[6]; // shipping
							$response .= implode("\t", $row) . "\n";
						}
					}
					foreach ($table as $row) {
						if (substr($row[0], -2)=="-d") { // download
							$items += 1; // quantity
							$subtotal += $row[6]; // price
							$response .= implode("\t", $row) . "\n";
						}
					}
					foreach ($table as $row) {
						if (substr($row[0], -2)=="-d") continue; // filter out any download
						if (substr($row[0], -2)=="-f") continue; // filter out any favorites
						if (substr($row[0], -2)=="-p") continue; // filter out any packages
						$hashbits = explode(":", $row[0]);
						$quantity = $row[4];
						$items += $quantity;
						$subtotal += $row[19]*$quantity; // subtotal
						$subtotal += $row[20]*$quantity; // shipping
						$response .= implode("\t", $row) . "\n";
					}
					$data = array($name, null, $items, $subtotal, null);
				}
				$table = Flatfile::updateTableRow($tablepath, $data);
					Flatfile::saveTableArray($tablepath, $table);
				// done
				$this->respond(array(
					"type" => "raw",
					"data" => trim($response, "\n")
				));
			 case "update_session_item" :
				// incoming
				$puid = 		$this->getRequestVariable("puid");
				$data = 		$this->getRequestVariable("data");
					$data = 	$this->parseTableRowData($data);
				$name = 		$this->getRequestVariable("name");
				$type = 		$this->getRequestVariable("type");
				// no parent, kill it
				if ($puid==null) {
					$this->respond(array(
						"type" => "xml",
						"errors" => array($LANG->lookup('a valid puid parameter is required'))
					));
				}
				// add/update the line item, no matter what it is
				$tablepath = 	SA_DIR_STORAGE . "/$puid/set.$name.table";
				$table =		Flatfile::updateTableRow($tablepath, $data);
							Flatfile::saveTableArray($tablepath, $table);
				// do some updating in the global table
				$tablepath = 	SA_DIR_STORAGE . "/$puid/set.session.table";
				$response =		"";
				if ($type=="favorites") { // we're adding a favorite
					$favorites = "0";
					foreach ($table as $row) {
						if (substr($row[0], -2)!=="-f") continue; // filter out everything but favorites
						$favorites += 1; // quantity
						$response .= implode("\t", $row) . "\n";
					}
					$data = array($name, null, null, null, $favorites);
				} else { // plain ala cart item
					$items = "0";
					$subtotal = "0";
					foreach ($table as $row) {
						if (substr($row[0], -2)=="-p") { // packages
							$subtotal += $row[5]; // subtotal
							$subtotal += $row[6]; // shipping
							$response .= implode("\t", $row) . "\n";
						}
					}
					foreach ($table as $row) {
						if (substr($row[0], -2)=="-d") { // download
							$items += 1; // quantity
							$subtotal += $row[6]; // price
							$response .= implode("\t", $row) . "\n";
						}
					}
					foreach ($table as $row) {
						if (substr($row[0], -2)=="-d") continue; // filter out any download
						if (substr($row[0], -2)=="-f") continue; // filter out any favorites
						if (substr($row[0], -2)=="-p") continue; // filter out any packages
						$hashbits = explode(":", $row[0]);
						$quantity = $row[4];
						$items += $quantity;
						$subtotal += $row[19]*$quantity; // subtotal
						$subtotal += $row[20]*$quantity; // shipping
						$response .= implode("\t", $row) . "\n";
					}
					$data = array($name, null, $items, $subtotal, null);
				}
				$table = Flatfile::updateTableRow($tablepath, $data);
					Flatfile::saveTableArray($tablepath, $table);
				// done
				$this->respond(array(
					"type" => "raw",
					"data" => trim($response, "\n")
				));
			 case "add_all_of_type" :
				// incoming
				$puid = 		$this->getRequestVariable("puid");
				$name = 		$this->getRequestVariable("name");
				$group = 		$this->getRequestVariable("group");
				$quality = 		$this->getRequestVariable("quality");
				$type = 		$this->getRequestVariable("type");
				$price = 		$this->getRequestVariable("price");
				$flat = 		$this->getRequestVariable("flat");
				// add/update the line item, no matter what it is
				$table = 		Flatfile::getSetTable($name, $puid);
				$rows = array();
				if ($group=="cart") {
					$images = 		Flatfile::getFileTable("image", $puid);
					$item_price = 	$price;
					$remainder = 	0;
					if ($flat=="true") {
						$item_price = $price/count($images);
						$item_price *= 100;
						$item_price = floor($item_price);
						$item_price = $item_price/100;
						$remainder = $price - ($item_price*count($images));
					}
					foreach ($images as $row) {
						$hash = md5( $puid . $row[1] . $quality ) . "-d";
						$table[$hash] = array( $hash, $puid, $row[0], $row[1], $row[2], $quality, $item_price, 1 );
					}
					if ($remainder!=0) {
						$table[$hash][6] += $remainder;
					}
				} else if ($group=="favorites") {
					$item_price = 	$price;
					foreach ($table as $row) {
						if (substr($row[0], -2)=="-f") { // favorite
							$hash = md5( $puid . $row[3] . $quality ) . "-d";
							if ( isset($table[$hash]) && $table[$hash][7]==1 && $table[$hash][5]==$quality ) {
								// already there, and at the discounted price do nothing
							} else {
								$table[$hash] = array( $hash, $row[1], $row[2], $row[3], $row[4] . "x" . $row[5], $quality, $item_price, 1 );
							}
						}
					}
				}
				$tablepath = 	SA_DIR_STORAGE . "/$puid/set.$name.table";
					Flatfile::saveTableArray($tablepath, $table);
				// do some updating in the global table
				$tablepath = 	SA_DIR_STORAGE . "/$puid/set.session.table";
				$response =		"";
				$items = "0";
				$subtotal = "0";
				foreach ($table as $row) {
					if (substr($row[0], -2)=="-p") { // packages
						$subtotal += $row[5]; // subtotal
						$subtotal += $row[6]; // shipping
						$response .= implode("\t", $row) . "\n";
					}
				}
				foreach ($table as $row) {
					if (substr($row[0], -2)=="-d") { // download
						$items += 1; // quantity
						$subtotal += $row[6]; // price
						$response .= implode("\t", $row) . "\n";
					}
				}
				foreach ($table as $row) {
					if (substr($row[0], -2)=="-d") continue; // filter out any download
					if (substr($row[0], -2)=="-f") continue; // filter out any favorites
					if (substr($row[0], -2)=="-p") continue; // filter out any packages
					$hashbits = explode(":", $row[0]);
					$quantity = $row[4];
					$items += $quantity;
					$subtotal += $row[19]*$quantity; // subtotal
					$subtotal += $row[20]*$quantity; // shipping
					$response .= implode("\t", $row) . "\n";
				}
				$data = array($name, null, $items, $subtotal, null);
				$table = Flatfile::updateTableRow($tablepath, $data);
					Flatfile::saveTableArray($tablepath, $table);
				// done
				$this->respond(array(
					"type" => "raw",
					"data" => trim($response, "\n")
				));
			 case "open_session" :
				// incoming
				$puid = 		$this->getRequestVariable("puid");
				$email = 		$this->getRequestVariable("email");
				if ($puid==null) {
					$this->respond(array(
						"type" => "xml",
						"errors" => array($LANG->lookup('a valid puid parameter is required'))
					));
				}
				if (Func::validEmail($email)==false) {
					$this->respond(array(
						"type" => "raw",
						"data" => "email_invalid"
					));
				}
				// create the new email hash and add to table
				$suid = 		md5($email);
				$data = 		array($suid, $email, null, null, null);
				$tablepath = 	SA_DIR_STORAGE . "/$puid/set.session.table";
				$table = 		Flatfile::updateTableRow($tablepath, $data);
							Flatfile::saveTableArray($tablepath, $table);
				// done
				$this->respond(array(
					"type" => "raw",
					"data" => $suid
				));
			 case "validate_login" :
				$password = $this->getRequestVariable("password");
				$suid = $this->getRequestVariable("suid");
				if ($suid=="null") $suid = null;
				if ($suid=="") $suid = null;
				if ($suid==null) {
					$this->respond(array(
						"type" => "raw"
					));
				}
				$page_data = Flatfile::getXmlArray("uploadset", $suid, true);
				if ($page_data==false) {
					$page_data = Flatfile::getXmlArray("zipfile", $suid, true);
				}
				if ($page_data==false) {
					$page_data = Flatfile::getXmlArray("categoryset", $suid, true);
				}
				if ($page_data==false) {
					$page_data = Flatfile::getXmlArray("dropboxset", $suid, true);
				}
				$set_password = $page_data->getNodeVal("data.settings.password");
				$auth_key = base64_encode($password)!==$set_password ? md5("") : md5( $suid . $CONFIG->getNodeVal("setup.product_key"));
				setcookie($suid."_authid", $auth_key);
				$this->respond(array(
					"type" => "raw",
					"data" => $auth_key
				));
			 case "validate_suid" :
				$suid = $this->getRequestVariable("suid");
				if ($suid=="null") $suid = null;
				if ($suid=="") $suid = null;
				if ($suid==null) {
					$this->respond(array(
						"type" => "raw"
					));
				}
				if (file_exists(SA_DIR_STORAGE."/$suid/")) {
					setcookie("validate_suid", "", time() - 3600);
					$this->respond(array(
						"type" => "raw",
						"data" => "true"
					));
				} else {
					setcookie("validate_suid", $suid, 0);
					$this->respond(array(
						"type" => "raw",
						"data" => "false"
					));
				}
			 case "send_email" :
				// make sure the contact page is setup
				$contact = Flatfile::getXmlArray("contact");
				$language = Flatfile::getXmlArray("language");
				// get our form reciepients
				$recipients = $contact->getNodeVal("data.settings.contact_form_recipients");
				$use_autoresponder = $contact->getNodeVal("data.settings.use_autoresponder_bool")=="true";
				// create a form object array
				$formobjects = Flatfile::getSetTable("formobjects");
				if (count($formobjects)==0) {
					$formobjects = array(
						"0" => array ("", "YOUR_NAME", $LANG->lookup('Your Full Name'), "input", "1", "", "input"),
						"1" => array ("", "YOUR_EMAIL", $LANG->lookup('Your Email Address'), "input", "1", "", "email"),
						"2" => array ("", "YOUR_MESSAGE", $LANG->lookup('Your Message'), "area", "1", "", "area")
					);
				}
				$formobject_formatted = "";
				$sender_name = "";
				$sender_email = "";
				foreach ($formobjects as $row) {
					$slug = strtoupper($row[1]."_".$row[0]);
					$slug = trim($slug, "_");
					$title = $row[2];
					$type = $row[3];
					$required = $row[4]=="1";
					$value = isset($this->post[$slug]) ? $this->post[$slug] : "";
					$value = str_replace("\n", "  \n", $value);
					if ($required&&$value=="") {
						$this->respond(array(
							"type" => "raw",
							"data" => "highlighted_fields_required"
						));
					}
					$post[$slug."_LABEL"] = $title;
					$post[$slug] = $value;
					$formobject_formatted .= $title . ": " . $post[$slug] . "\n\n";
					if ($sender_name==""&&strstr(strtolower($slug), "name")!==false) $sender_name = $value;
					if ($sender_name==""&&strstr(strtolower($slug), "nom")!==false) $sender_name = $value;
					if ($sender_email==""&&strstr(strtolower($slug), "email")!==false) $sender_email = $value;
					if ($sender_email==""&&strstr(strtolower($slug), "mail")!==false) $sender_email = $value;
					if ($slug=="SENDER_NAME") $sender_name = $value;
					if ($slug=="SENDER_EMAIL") $sender_email = $value;
					if ($slug=="YOUR_NAME") $sender_name = $value;
					if ($slug=="YOUR_EMAIL") $sender_email = $value;
				}
				// the post-markdown array
				$pre = array();
				$pre["FORMATTED_FORM_BLOCK"] = $formobject_formatted;
				$pre["SITE_URL"] = Func::getBaseURL() . "/" . SA_DIR_INDEXPATH;
				$pre["SET_URL"] = $this->getRequestVariable("set_url");
				$post = array();
				$post["SENDER_EMAIL"] = $sender_email;
				$post["SENDER_NAME"] = $sender_name;
				$post["OWNER_NAME"] = $contact->getNodeVal("data.details.your_email");
				$post["OWNER_EMAIL"] = $contact->getAttrVal("data.details.your_email.href");
				$post["MESSAGE_LABEL"] = $language->getNodeVal("data.contact.mail_form_message");
				// ok, send it out
				$email = new Email();
				$email->setSender($sender_email, $sender_name);
				$email->addRecipients($recipients);
				$email->setSubjectTemplate("data.contact.form_email_subject");
				$email->setBodyTemplate("data.contact.form_email_message_body");
				$email->addPreTags($pre);
				$email->addPostTags($post);
				$email->send();
				$response = "";
				switch ($email->error()) {
					 case "no_contact";
					 case "no_subject";
					 case "no_body";
					 case "no_origin";
						$response = "contact_form_not_setup";
						break;
					 case "no_recipients";
					 case "invalid_email";
						$response = "email_address_invalid";
						break;
					 case "send_failure";
						$response = "contact_form_send_failure";
						break;
					 case "partial_send_success";
					 case "send_success";
						$response = "contact_form_send_success";
						break;
					}
				if ( $response=="contact_form_send_success" && $use_autoresponder ) {
					// autoresponder
					$email = new Email();
					$email->setSender($post["OWNER_EMAIL"], $post["OWNER_NAME"]);
					$email->setRecipient($sender_email, $sender_name);
					$email->setSubjectTemplate("data.contact.contact_form_autoresponder_subject");
					$email->setBodyTemplate("data.contact.contact_form_autoresponder_message_body");
					$email->addPreTags($pre);
					$email->addPostTags($post);
					$email->send();
				}
				if (isset($this->post["ADD_TO_MAILING_LIST"])) {
					$this->addToMailingList($sender_email, $sender_name);
				}
				$this->respond(array(
					"type" => "raw",
					"data" => $response
				));
			}
			parent::runPublic();
		}
		
		protected function addToMailingList ($email, $fullname) {
			$contact = Flatfile::getXmlArray("contact", null, true);
			if ($contact==false) {
				return false;
			}
			$firstname = $fullname;
			$lastname = "";
			if (strpos($fullname, " ")!==false) {
				$nameparts = explode(" ", $fullname);
				$lastname = array_pop($nameparts);
				$firstname = implode(" ", $nameparts);
			}
			$mailing_list = $contact->getNodeVal("data.settings.mailing_list");
			$mailing_list_username = $contact->getNodeVal("data.settings.mailing_list_username");
			$mailing_list_account_api_key = $contact->getNodeVal("data.settings.mailing_list_account_api_key");
			$mailing_list_subscriber_list_key = $contact->getNodeVal("data.settings.mailing_list_subscriber_list_key");
			switch ($mailing_list) {
				case "internal" :
					$data = array(md5($email), "true", $email, $fullname);
					$tablepath = SA_DIR_STORAGE . "/set.mailinglist.table";
					$table = Flatfile::updateTableRow($tablepath, $data);
					Flatfile::saveTableArray($tablepath, $table);
					return true;
				case "campaignmonitor" :
					$wrap = new CS_REST_Subscribers($mailing_list_subscriber_list_key, array('api_key' => $mailing_list_account_api_key));
					$result = $wrap->add(array(
						'EmailAddress' => $email,
						'Name' => $fullname,
						'Resubscribe' => true
					));
					return $result->was_successful();
				case "mailchimp" :
					$MailChimp = new MailChimp($mailing_list_account_api_key);
					$result = $MailChimp->post("lists/$mailing_list_subscriber_list_key/members", [
						'email_address' => $email,
						'merge_fields'  => [ 'FNAME'=>$firstname, 'LNAME'=>$lastname ],
						'status'        => 'subscribed'
					]);
					return $MailChimp->success();
				case "madmimi" :
					Func::getRemotePage(
						'http://api.madmimi.com/audience_lists/' . rawurlencode($mailing_list_subscriber_list_key) . '/add',
						array(
							"api_key" => $mailing_list_account_api_key,
							"username" => $mailing_list_username,
							"email" => $email,
							"first_name" => $firstname,
							"last_name" => $lastname
						)
					);
					return true;
			}
		}

		protected function backup () {
			if (SA_DEMOMODE) {
				$this->respond(array(
					"success" => false
				));
			}
			function filter ($p_event, &$p_header)
			{
				$stored_filename = trim($p_header['stored_filename'], "/");
				$folder = $p_header['folder'];
				if ($folder==true) return 1;
				$extension = strtolower(substr($stored_filename, strrpos($stored_filename, '.')+1));
				if (in_array($extension, array("xml", "table", "index", "log"))==false) { // some kind of image, etc
					$folderbits = explode("/", $stored_filename);
					$parentfolder = $folderbits[count($folderbits)-2];
					if ($parentfolder=="asset"||$parentfolder=="audio") return 1;
					return 0;
				}
				return 1;
			}
			$name = time();
			$archive = new PclZip(SA_DIR_TEMP."/$name.zip"	);
			$list = @$archive->create(SA_DIR_STORAGE, PCLZIP_CB_PRE_ADD, filter);
			$this->respond(array(
				"data" => $name,
				"success" => ($list==0?false:true)
			));
		}

		protected function parsePublicFileOutput ($str, $name, $suid) {
			return ""; // no need for this security hole
		}

		protected function parsePublicSetOutput ($str, $name, $suid) {
			if ($name=="ustaxchart"||$name=="vattaxchart"||$name=="cataxchart") return $str;
			return ""; // no need for this security hole
		}

		protected function onDeleteFileTable ($table, $name, $suid, $type) {
			if ($name=="page"&&$type=="image") {
				$parent = Flatfile::updateSetTable("page", array($suid, null, null, count($table)));
				Flatfile::saveSetTable($parent, "page");
			}
			return $table;
		}

		protected function onUpdateFileObject ($table, $name, $suid, $type) {
			if ($name=="page"&&$type=="image") {
				$path = $this->getRequestVariable("path");
				$category = "";
				if ($path!="") { // has parent paths
					$path = trim($path, "/");
					$paths = explode("/", $path);
					if (count($paths)>=2) {
						array_pop($paths);
						$category = array_pop($paths);
					}
				}
				if ($category!="") {
					$hash = md5($category);
					$table[6] = $hash;
				}
			}
			return $table;
		}

		protected function onUpdateFileTable ($table, $name, $suid, $type) {
			if ($name=="page"&&$type=="image") {
				$path = $this->getRequestVariable("path");
				$category = "";
				if ($path!="") { // has parent paths
					$path = trim($path, "/");
					$paths = explode("/", $path);
					if (count($paths)>=2) {
						array_pop($paths);
						$category = array_pop($paths);
					}
				}
				if ($category!="") {
					$data = array(md5($category), $category);
					$tablepath = SA_DIR_STORAGE . "/$suid/set.category.table";
					$tabledata = Flatfile::updateTableRow($tablepath, $data);
					Flatfile::saveTableArray($tablepath, $tabledata);
				}
				$parent = Flatfile::updateSetTable("page", array($suid, null, null, count($table)));
				Flatfile::saveSetTable($parent, "page");
			}
			return $table;
		}

	}

	/* init the gateway
		*/
	$gateway = new LocalGateway();
	$gateway->setUploadTypes(array("track", "image", "audio", "asset", "package", "product"));
	$gateway->authenticate();
	$gateway->execute();

?>