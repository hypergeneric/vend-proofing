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
				$props = Records::dropboxMeta($suid);
				$response = "";
				foreach ($props as $key => $value) {
					$response .= $response=="" ? $key . "=" . $value : "&" . $key . "=" . $value;
				}
				$this->respond(array(
					"success" => true,
					"data" => $response
				));
			 case "duplicate_set" :
				$name = $this->getRequestVariable("name");
				Records::duplicateSet($name, $this->getRequestVariable("suid"), $this->getRequestVariable("data"));
				$this->respond(array(
					"success" => true,
					"data" => Records::rowsText(Records::getSetTable($name)),
					"invalidate" => true
				));
			 case "get_log_file" :
				$orderid = $this->getRequestVariable("orderid");
				$order = new Order();
				$response = Payments::summary($orderid);
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
					include SA_DIR_COREPATH . "/tmpl/html/1.page.message.tmpl";
					exit();
				}
			 case "test_mail_setup" :
				$ordering = Configuration::getDocument("ordering");
				$contact = Configuration::getDocument("contact");
				$language = Configuration::getDocument("language");
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
					$message_title = $LANG->lookup("mail sent successfully");
					$message_description = $LANG->lookup("mail sent successfully description");
					$help_link_uri = "";
					unset($error);
				} else {
					$message_title = $LANG->lookup("mail failed to send");
					$message_description = $LANG->lookup("mail failed to send description");
					$help_link_uri = "";
					$error = $email->getErrorLog();
					$error = implode("<br />\n", $error);
				}
				include SA_DIR_COREPATH . "/tmpl/html/1.page.message.tmpl";
				exit();
			 case "output_bulkmail" :
				$contact = Configuration::getDocument("contact");
				$language = Configuration::getDocument("language");
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
					$sessions = Records::getSetTable("session", $suid);
					foreach ($sessions as $obj) {
						$recipients .= "," . $obj[1];
					}
				}
				$pageType = Records::pageType($suid);
				$page_data = $pageType===null ? false : Configuration::getDocument(strtolower($pageType), $suid);
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
			global $LANG;
			$gallery_actions = array("list_session_table", "delete_session_type", "delete_session_item", "update_session_item", "add_all_of_type", "open_session", "prequalify_order", "verify_discount_code", "process_credit_card", "finalize_order");
			$session_actions = array("list_session_table", "delete_session_type", "delete_session_item", "update_session_item", "add_all_of_type", "prequalify_order", "process_credit_card", "finalize_order");
			if (in_array($this->action, $gallery_actions, true)) {
				$puid = $this->getRequestVariable("puid");
				if (!is_string($puid) || !preg_match('/^[a-f0-9]{1,16}$/i', $puid)) {
					http_response_code(400);
					$this->respond(array("type" => "xml", "errors" => array("Invalid gallery identifier")));
				}
			}
			if (in_array($this->action, $session_actions, true)) {
				$name = $this->getRequestVariable("name");
				if (!is_string($name) || !preg_match('/^[a-f0-9]{32}$/i', $name)) {
					http_response_code(400);
					$this->respond(array("type" => "xml", "errors" => array("Invalid proofing session identifier")));
				}
			}
			switch ($this->action) {
			 case "get_public_asset" :
				$folder = $this->getRequestVariable("folder", "asset");
				$filename = $this->getRequestVariable("filename");
				$valid_folder = is_string($folder) &&
					(in_array($folder, array("asset", "audio"), true) ||
					($folder === basename($folder) && isset(Records::getSetTable("page")[$folder])));
				$valid_name = is_string($filename) && $filename !== "" && $filename === basename($filename);
				if (!$valid_folder || !$valid_name) {
					http_response_code(404);
					exit();
				}
				$listed = false;
				foreach (array("asset", "track", "audio") as $media_type) {
					if (isset(Records::getFileTable($media_type, $folder)[$filename])) {
						$listed = true;
						break;
					}
				}
				if (!$listed) {
					http_response_code(404);
					exit();
				}
				$asset_path = SA_DIR_STORAGE . "/$folder/" . $filename;
				if (is_file($asset_path) && !is_link($asset_path) && !is_link(SA_DIR_STORAGE . "/" . $folder)) {
					$file_extension = strtolower(substr(strrchr($filename,"."),1));
					switch ($file_extension) {
						case "mp4": case "m4v": $ctype="video/mp4"; break;
						case "webm": $ctype="video/webm"; break;
						case "ogg": case "ogv": $ctype="video/ogg"; break;
						case "pdf": $ctype="application/pdf"; break;
						case "zip": $ctype="application/zip"; break;
						case "gif": $ctype="image/gif"; break;
						case "png": $ctype="image/png"; break;
						case "jpe": case "jpeg":
						case "jpg": $ctype="image/jpg"; break;
						default: $ctype="application/force-download";
					}
					header("Content-Type: $ctype");
					header("Content-Length: " . filesize($asset_path));
					readfile($asset_path);
					exit();
				} else {
					header($_SERVER["SERVER_PROTOCOL"]." 404 Not Found");
					exit();
				}
			 case "prequalify_order" :
				$puid = $this->getRequestVariable("puid");
				$name = $this->getRequestVariable("name");
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
				try {
					$orderid = OrderRecords::prequalify($puid, $name, $orderid, $code, (string) $subtotal);
				} catch (InvalidArgumentException $error) {
					$message = $error->getMessage();
					if (!str_starts_with($message, "discount_")) $message = "invalid_order";
					$this->respond(array("data" => "false\t" . $message, "type" => "raw"));
				}
				$this->respond(array(
					"data" => "true\t$orderid",
					"type" => "raw"
				));
			 case "verify_discount_code" :
				// incoming
				$puid = $this->getRequestVariable("puid");
				$code = $this->getRequestVariable("code");
				$subtotal = $this->getRequestVariable("subtotal", 0);
				$result = OrderRecords::verifyDiscountCode($puid, $code, (string) $subtotal);
					$result[0] = $result[0]==true ? "true" : "false";
				// done
				$this->respond(array(
					"data" => implode("\t", $result),
					"type" => "raw"
				));
			 case "list_session_table" :
				$puid = $this->getRequestVariable("puid");
				$name = $this->getRequestVariable("name");
				$response = Proofing::rowsText(Proofing::rows($puid, $name));
				$this->respond(array("type" => "raw", "data" => $response));
			 case "update_session_item" :
				$puid = $this->getRequestVariable("puid");
				$name = $this->getRequestVariable("name");
				$type = $this->getRequestVariable("type");
				$row = $this->parseTableRowData($this->getRequestVariable("data"));
				$response = Proofing::rowsText(Proofing::save($puid, $name, $type, $row));
				$this->respond(array("type" => "raw", "data" => $response));
			 case "delete_session_item" :
				$puid = $this->getRequestVariable("puid");
				$name = $this->getRequestVariable("name");
				$type = $this->getRequestVariable("type");
				$suid = $this->getRequestVariable("suid");
				$response = Proofing::rowsText(Proofing::deleteItem($puid, $name, $type, $suid));
				$this->respond(array("type" => "raw", "data" => $response));
			 case "delete_session_type" :
				$puid = $this->getRequestVariable("puid");
				$name = $this->getRequestVariable("name");
				$type = $this->getRequestVariable("type");
				$response = Proofing::rowsText(Proofing::clear($puid, $name, $type));
				$this->respond(array("type" => "raw", "data" => $response));
			 case "add_all_of_type" :
				$puid = $this->getRequestVariable("puid");
				$name = $this->getRequestVariable("name");
				$group = $this->getRequestVariable("group");
				$quality = $this->getRequestVariable("quality");
				$price = (float) $this->getRequestVariable("price");
				$flat = $this->getRequestVariable("flat")==="true";
				$response = Proofing::rowsText(Proofing::addDownloads($puid, $name, $group, $quality, $price, $flat));
				$this->respond(array("type" => "raw", "data" => $response));
			 case "open_session" :
				$puid = $this->getRequestVariable("puid");
				$email = $this->getRequestVariable("email");
				if (!Func::validEmail($email)) {
					$this->respond(array("type" => "raw", "data" => "email_invalid"));
				}
				$this->respond(array("type" => "raw", "data" => Proofing::open($puid, $email)));
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
				$pageType = is_string($suid) ? Records::pageType($suid) : null;
				if ($pageType===null) {
					http_response_code(400);
					$this->respond(array("type" => "xml", "errors" => array("Invalid gallery identifier")));
				}
				$page_data = Configuration::getDocument(strtolower($pageType), $suid);
				$set_password = $page_data->getNodeVal("data.settings.password");
				$auth_key = base64_encode($password)!==$set_password
					? md5("")
					: hash_hmac("sha256", $suid, Database::installationSecret());
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
				if (is_string($suid) && isset(Records::getSetTable("page")[$suid])) {
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
				$contact = Configuration::getDocument("contact");
				$language = Configuration::getDocument("language");
				// get our form reciepients
				$recipients = $contact->getNodeVal("data.settings.contact_form_recipients");
				$use_autoresponder = $contact->getNodeVal("data.settings.use_autoresponder_bool")=="true";
				// create a form object array
				$formobjects = Records::getSetTable("formobjects");
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
			$contact = Configuration::getDocument("contact", null, true);
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
			$mailing_list_account_api_key = $contact->getNodeVal("data.settings.mailing_list_account_api_key");
			$mailing_list_subscriber_list_key = $contact->getNodeVal("data.settings.mailing_list_subscriber_list_key");
			switch ($mailing_list) {
				case "internal" :
					Records::subscribeContact($email, $fullname);
					return true;
				case "mailchimp" :
					$MailChimp = new MailChimp($mailing_list_account_api_key);
					$result = $MailChimp->post("lists/$mailing_list_subscriber_list_key/members", [
						'email_address' => $email,
						'merge_fields'  => [ 'FNAME'=>$firstname, 'LNAME'=>$lastname ],
						'status'        => 'subscribed'
					]);
					return $MailChimp->success();
			}
		}

	}

	/* init the gateway
		*/
	PaymentGateway::dispatch();
	$gateway = new LocalGateway();
	$gateway->execute();

?>
