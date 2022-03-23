<?php

	use Michelf\Markdown;

	class Email {

		/* ---- Public Methods ---- */
		
		public function addRecipients ($str) {
			$recipients = trim($str);
			$recipients = strlen($recipients)==0 ? array() : explode(",", $recipients);
			$recipients = array_map("trim", $recipients);
			$this->flag_bulk = true;
			$this->recipient_list = array_merge($recipients, $this->recipient_list);
			$this->recipient_list = array_unique($this->recipient_list);
			$this->recipient_list = array_filter($this->recipient_list);
		}

		public function setSubjectTemplate ($str) {
			if ($this->language!=false) {
				$this->tmpl_subject = $this->language->getNodeVal($str);
			}
		}
		
		public function setBodyTemplate ($str) {
			if ($this->language!=false) {
				$this->tmpl_body = $this->language->getNodeVal($str);
			}
		}
		
		public function setSender ($email, $name="") {
			$this->sender_email = $email;
			$this->sender_name = $name;
		}

		public function setRecipient ($email, $name="") {
			$this->recipient_email = $email;
			$this->recipient_name = $name;
		}

		public function addPreTags ($arr) {
			$this->pre_tags = array_merge($arr, $this->pre_tags);
		}

		public function addPostTags ($arr) {
			$this->post_tags = array_merge($arr, $this->post_tags);
		}

		public function send () {
			$this->processMail();
			$this->updateMessageLog();
		}

		public function success () {
			return $this->flag_success;
		}

		public function error () {
			return $this->flag_error;
		}
		
		public function getErrorLog () {
			return $this->errors;
		}
		
		public function doDebug ($bool) {
			$this->debug = $bool;
		}
		
		public function logMessage ($bool) {
			$this->log_messages = $bool;
		}

		public function __construct() {
			// setup the mailer
			$this->contact = Flatfile::getXmlArray("contact", null, true);
			$this->language = Flatfile::getXmlArray("language");
			// create the arrays
			$this->recipient_list = array();
			$this->pre_tags = array();
			$this->post_tags = array();
			// setup the mailer
			if ($this->contact!=false) {
				$this->provider = $this->contact->getNodeVal("data.mailer_settings.mail_provider");
				$this->origin_name = $this->contact->getNodeVal("data.mailer_settings.server_origin_email");
				$this->origin_email = $this->contact->getAttrVal("data.mailer_settings.server_origin_email.href");
				$this->log_messages = $this->contact->getNodeVal("data.mailer_settings.log_all_messages_bool")==true;
			}
			// pre-fill gloabl tags
			$debug_data = "";
			$debug_keys = array("REQUEST_TIME", "HTTP_USER_AGENT", "REMOTE_ADDR", "SERVER_NAME", "SERVER_SOFTWARE");
			foreach ($debug_keys as $debug_key) {
				if (isset($_SERVER[$debug_key])) {
					$debug_data .= "$debug_key=" . $_SERVER[$debug_key] . "\n";
				}
			}
			$this->post_tags["SERVER_NAME"] = $_SERVER["SERVER_NAME"];
			$this->post_tags["DEBUG_DATA"] = $debug_data;
		}

		/* ---- Private Properties ---- */
		
		protected $debug = false;
		protected $errors = array();

		protected $flag_success = true;
		protected $flag_bulk = false;
		protected $flag_error = false;
		
		protected $contact = true;
		protected $language = true;
		
		protected $provider = "";
		protected $recipient_list;
		protected $recipient_email = "";
		protected $recipient_name = "";
		protected $tmpl_subject = "";
		protected $tmpl_body = "";
		protected $origin_email = "";
		protected $origin_name = "";
		protected $sender_email = "";
		protected $sender_name = "";
		protected $pre_tags;
		protected $post_tags;
		
		protected $log_messages;
		protected $email_subject;
		protected $email_message_body;
		
		protected $email_template = '<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width">
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<title>{SUBJECT}</title>
<style>*{font-family:Helvetica,Arial,sans-serif;font-size:100%;line-height:1.6em;margin:0;padding:0}.btn-primary td,h1,h2,h3{font-family:Helvetica,Arial,sans-serif}img{max-width:600px;width:auto}body{-webkit-font-smoothing:antialiased;height:100%;-webkit-text-size-adjust:none;width:100%!important}a{color:#348eda}.btn-primary{Margin-bottom:10px;width:auto!important}.btn-primary td{background-color:#348eda;border-radius:25px;font-size:14px;text-align:center;vertical-align:top}.btn-primary td a{background-color:#348eda;border:1px solid #348eda;border-radius:25px;border-width:10px 20px;display:inline-block;color:#fff;cursor:pointer;font-weight:700;line-height:2;text-decoration:none}.last{margin-bottom:0}.first{margin-top:0}.padding{padding:10px 0}table.body-wrap{padding:20px;width:100%}table.body-wrap .container{border:1px solid #f0f0f0}table.footer-wrap{clear:both!important;width:100%}.footer-wrap .container p{color:#666;font-size:12px}table.footer-wrap a{color:#999}h1,h2,h3{color:#111;font-weight:200;line-height:1.2em;margin:40px 0 10px}h1{font-size:36px}h2{font-size:28px}h3{font-size:22px}ol,p,ul{font-size:14px;font-weight:400;margin-bottom:10px}ol li,ul li{margin-left:5px;list-style-position:inside}.container{clear:both!important;display:block!important;Margin:0 auto!important;max-width:600px!important}.body-wrap .container{padding:20px}.content{display:block;margin:0 auto;max-width:600px}.content table{width:100%}</style>
</head>
<body bgcolor="#f6f6f6">
<table class="body-wrap" bgcolor="#f6f6f6">
	<tr>
		<td></td>
		<td class="container" bgcolor="#FFFFFF">
			<div class="content">
				<table>
					<tr><td>
{CONTENT}
					</td></tr>
				</table>
			</div>
		</td>
		<td></td>
	</tr>
</table>
</body>
</html>';

		protected function addToLog ($str, $level) {
			$this->errors[] = $str;
		}
		
		protected function updateMessageLog () {
			if ( $this->log_messages ) {
				$suid = Flatfile::createUID();
				// create our data entry
				$timestamp = time()*1000;
				$send_success = $this->flag_error=="send_success" || $this->flag_error=="partial_send_success" ? "true" : "false";
				$sender_name = $this->sender_name;
				$sender_email = $this->sender_email;
				$recipient_name = $this->recipient_name;
				$recipient_email = $this->recipient_email;
				if ( $this->flag_bulk==true ) {
					$recipient_name = "";
					$recipient_email = implode(",", $this->recipient_list);
				}
				$email_subject = base64_encode($this->email_subject);
				$email_message_body = base64_encode($this->email_message_body);
				// add it to our messages table
				$data = array($suid, $timestamp, $send_success, $sender_name, $sender_email, $recipient_name, $recipient_email, $email_subject, $email_message_body);
				$tablepath = SA_DIR_STORAGE . "/set.messages.table";
				$table = Flatfile::updateTableRow($tablepath, $data);
				// loop through the messages and do two things:  1, check to see if it's the old format, 2, see if it's older than 90 days
				foreach ($table as $key => $arr) {
					if (count($arr)==5) {
						$table[$key] = array($arr[0], $arr[1], "true", $arr[2], $arr[3], "", "", "", $arr[4]);
					}
					$timestamp = $arr[1]/1000;
					$exipres = round(microtime(true)) - (90 * 86400);
					if ( $timestamp<$exipres ) {
						unset($table[$key]);
					}
				}
				Flatfile::saveTableArray($tablepath, $table);
				$this->flag_success = true;
				$this->flag_error = "send_success";
			}
		}
		
		protected function processMail () {
			global $LANG;
			// do some error checking
			if ( $this->contact==false ) {
				$this->email_subject = "Contact Email Not Configured Or Invalid";
				$this->flag_success = false;
				$this->flag_error = "no_contact";
				if ($this->debug) {
					$this->errors[] = "Contact Email Not Configured Or Invalid";
				}
				return;
			}
			if ( $this->tmpl_subject=="" ) {
				$this->email_subject = "Failed to Load Language Subject Object";
				$this->flag_success = false;
				$this->flag_error = "no_subject";
				if ($this->debug) {
					$this->errors[] = "Failed to Load Language Subject Object";
				}
				return;
			}
			if ( $this->tmpl_body=="" ) {
				$this->email_subject = "Failed to Load Language Body Object";
				$this->flag_success = false;
				$this->flag_error = "no_body";
				if ($this->debug) {
					$this->errors[] = "Failed to Load Language Body Object";
				}
				return;
			}
			if ( ($this->flag_bulk==true&&count($this->recipient_list)==0) || ($this->flag_bulk==false&&$this->recipient_email=="") ) {
				$this->flag_success = false;
				$this->flag_error = "no_recipients";
				if ($this->debug) {
					$this->errors[] = "Recipient List Is Empty";
				}
			}
			if ( $this->flag_bulk==false && Func::validEmail($this->recipient_email)==false ) {
				$this->flag_success = false;
				$this->flag_error = "invalid_email";
				if ($this->debug) {
					$this->errors[] = "Recipient Email Is Invalid";
				}
			}
			// start the mail process
			$email_subject = $this->tmpl_subject;
			$email_message_body = $this->tmpl_body;
			$email_message_body_html = $email_message_body;
			// clean out the template tags
			foreach ($this->pre_tags as $key => $value) {
				$cleankey = str_replace("_", "", $key);
				$email_subject = str_replace ('{'.$key.'}', '{'.$cleankey.'}', $email_subject);
				$email_message_body = str_replace ('{'.$key.'}', '{'.$cleankey.'}', $email_message_body);
				$email_message_body_html = str_replace ('{'.$key.'}', '{'.$cleankey.'}', $email_message_body_html);
			}
			foreach ($this->post_tags as $key => $value) {
				$cleankey = str_replace("_", "", $key);
				$email_subject = str_replace ('{'.$key.'}', '{'.$cleankey.'}', $email_subject);
				$email_message_body = str_replace ('{'.$key.'}', '{'.$cleankey.'}', $email_message_body);
				$email_message_body_html = str_replace ('{'.$key.'}', '{'.$cleankey.'}', $email_message_body_html);
			}
			// parse before markdown
			foreach ($this->pre_tags as $key => $value) {
				$cleankey = str_replace("_", "", $key);
				$email_subject = str_replace ('{'.$cleankey.'}', $value, $email_subject);
				$email_message_body = str_replace ('{'.$cleankey.'}', $value, $email_message_body);
				$email_message_body_html = str_replace ('{'.$cleankey.'}', $value, $email_message_body_html);
			}
			// do the markdown
			$email_message_body_html = $str = Markdown::defaultTransform($email_message_body_html);
			// parse after markdown
			foreach ($this->post_tags as $key => $value) {
				$cleankey = str_replace("_", "", $key);
				$email_subject = str_replace ('{'.$cleankey.'}', $value, $email_subject);
				$email_message_body = str_replace ('{'.$cleankey.'}', $value, $email_message_body);
				$email_message_body_html = str_replace ('{'.$cleankey.'}', $value, $email_message_body_html);
			}
			$this->email_subject = $email_subject;
			$this->email_message_body = $email_message_body;
			// send mail
			if ( $this->provider=="mail" || $this->provider=="smtp" ) {
				$mail = new PHPMailer();
				$mail->CharSet = "UTF-8";
				if ($this->debug) {
					$mail->SMTPDebug = 4;
					$mail->Debugoutput = array($this, 'addToLog');
				}
				if ( $this->provider=="smtp" ) {
					$mail->isSMTP();
					$mail->Host = $this->contact->getNodeVal("data.mailer_settings.smtp_hostname");
					$mail->SMTPAuth = $this->contact->getNodeVal("data.mailer_settings.smtp_requires_auth_bool")=="true";
					$mail->Username = $this->contact->getNodeVal("data.mailer_settings.smtp_username");
					$mail->Password = $this->contact->getNodeVal("data.mailer_settings.smtp_password");
					if ( $mail->Password!=null ) {
						$mail->Password = base64_decode($mail->Password);
					}
					$mail->SMTPSecure = $this->contact->getNodeVal("data.mailer_settings.smtp_connection_type");
					if ( $mail->SMTPSecure=="none" ) {
						$mail->SMTPSecure = "";
					}
					$mail->Port = $this->contact->getNodeVal("data.mailer_settings.smtp_port_num");
					$mail->FromName = "";
					$mail->From = $this->contact->getNodeVal("data.mailer_settings.smtp_username");
					if ( $this->origin_name!=null ) {
						$mail->FromName = $this->origin_name;
					}
					if ( $this->origin_email!=null ) {
						$mail->From = $this->origin_email;
					}
				} else {
					$mail->FromName = $LANG->lookup('Mailer');
					$mail->From = get_current_user() . "@" . $_SERVER["SERVER_NAME"];
					if ( $this->origin_name!=null ) {
						$mail->FromName = $this->origin_name;
					}
					if ( $this->origin_email!=null ) {
						$domain_name = substr(strrchr($this->origin_email, "@"), 1);
						if (strpos($_SERVER["SERVER_NAME"], $domain_name)!==false) {
							$mail->From = $this->origin_email;
						}
					}
				}
				$mail->IsHTML(true);
				$mail->Subject  = $email_subject;
				if ($this->flag_bulk) { // bulk
					$total = count($this->recipient_list);
					$sent = 0;
					foreach ($this->recipient_list as $recipient) {
						if (Func::validEmail($recipient)==false) continue;
						$mail->AddAddress($recipient);
						if ($this->sender_email!="") {
							$mail->AddReplyTo($this->sender_email, $this->sender_name);
						}
						$final_email_message_body = str_replace ('{RECIPIENT}', $recipient, $email_message_body);
						$final_email_message_body_html = str_replace ('{RECIPIENT}', $recipient, $email_message_body_html);
						$email_message_body_template = $this->email_template;
							$email_message_body_template = str_replace ('{SUBJECT}', $email_subject, $email_message_body_template);
							$email_message_body_template = str_replace ('{CONTENT}', $final_email_message_body_html, $email_message_body_template);
						$mail->Body     = $email_message_body_template;
						$mail->AltBody  = $final_email_message_body;
						if ($mail->Send()==true) {
							++$sent;
						} else {
							if ($this->debug) {
								$this->errors[] = $mail->ErrorInfo;
							}
						}
						$mail->ClearAddresses();
						$mail->ClearReplyTos();
					}
					if ($sent==0) {
						$this->flag_success = false;
						$this->flag_error = "send_failure";
						return;
					}
					if ($total!=$sent) {
						$this->flag_error = "partial_send_success";
						return;
					}
				} else { // single
					$final_email_message_body = str_replace ('{RECIPIENT}', $this->recipient_email, $email_message_body);
					$final_email_message_body_html = str_replace ('{RECIPIENT}', $this->recipient_email, $email_message_body_html);
					$email_message_body_template = $this->email_template;
						$email_message_body_template = str_replace ('{SUBJECT}', $email_subject, $email_message_body_template);
						$email_message_body_template = str_replace ('{CONTENT}', $final_email_message_body_html, $email_message_body_template);
					$mail->Body     = $email_message_body_template;
					$mail->AltBody  = $final_email_message_body;
					$mail->AddAddress($this->recipient_email, $this->recipient_name);
					if ($this->sender_email!="") {
						$mail->AddReplyTo($this->sender_email, $this->sender_name);
					}
					if (!$mail->Send()) {
						$this->flag_success = false;
						$this->flag_error = "send_failure";
						if ($this->debug) {
							$this->errors[] = $mail->ErrorInfo;
						}
						return;
					}
				}
			} else if ( $this->provider=="sendgrid" ) {
				$sendgrid_apikey = $this->contact->getNodeVal("data.mailer_settings.sendgrid_api_key"); //'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';
				if ( $sendgrid_apikey!=null ) {
					$sendgrid_apikey = base64_decode($sendgrid_apikey);
				}
				$request = 'https://api.sendgrid.com/api/mail.send.json';
				if ($this->flag_bulk) { // bulk
					$total = count($this->recipient_list);
					$sent = 0;
					foreach ($this->recipient_list as $recipient) {
						if (Func::validEmail($recipient)==false) continue;
						$final_email_message_body = str_replace ('{RECIPIENT}', $recipient, $email_message_body);
						$final_email_message_body_html = str_replace ('{RECIPIENT}', $recipient, $email_message_body_html);
						$email_message_body_template = $this->email_template;
							$email_message_body_template = str_replace ('{SUBJECT}', $email_subject, $email_message_body_template);
							$email_message_body_template = str_replace ('{CONTENT}', $final_email_message_body_html, $email_message_body_template);
						$params = array(
							'to'        => $recipient,
							'from'      => $this->sender_email,
							'fromname'  => $this->sender_name,
							'subject'   => $email_subject,
							'text'      => $final_email_message_body,
							'html'      => $email_message_body_template
						);
						$session = curl_init($request);
						@curl_setopt($session, CURLOPT_SSLVERSION, CURL_SSLVERSION_TLSv1_2);
						curl_setopt($session, CURLOPT_HTTPHEADER, array('Authorization: Bearer ' . $sendgrid_apikey));
						curl_setopt($session, CURLOPT_POST, true);
						curl_setopt($session, CURLOPT_POSTFIELDS, $params);
						curl_setopt($session, CURLOPT_HEADER, false);
						curl_setopt($session, CURLOPT_RETURNTRANSFER, true);
						$response = curl_exec($session);
						$response = json_decode($response, true);
						curl_close($session);
						if ($response["message"]=="success") {
							++$sent;
						} else {
							if ($this->debug) {
								foreach ($response["errors"] as $error) {
									$this->errors[] = $error;
								}
							}
						}
					}
					if ($sent==0) {
						$this->flag_success = false;
						$this->flag_error = "send_failure";
						return;
					}
					if ($total!=$sent) {
						$this->flag_error = "partial_send_success";
						return;
					}
				} else { // single
					$final_email_message_body = str_replace ('{RECIPIENT}', $this->recipient_email, $email_message_body);
					$final_email_message_body_html = str_replace ('{RECIPIENT}', $this->recipient_email, $email_message_body_html);
					$email_message_body_template = $this->email_template;
						$email_message_body_template = str_replace ('{SUBJECT}', $email_subject, $email_message_body_template);
						$email_message_body_template = str_replace ('{CONTENT}', $final_email_message_body_html, $email_message_body_template);
					$params = array(
						'to'        => $this->recipient_email,
						'toname'    => $this->recipient_name,
						'from'      => $this->sender_email,
						'fromname'  => $this->sender_name,
						'subject'   => $email_subject,
						'text'      => $final_email_message_body,
						'html'      => $email_message_body_template
					);
					$session = curl_init($request);
					@curl_setopt($session, CURLOPT_SSLVERSION, CURL_SSLVERSION_TLSv1_2);
					curl_setopt($session, CURLOPT_HTTPHEADER, array('Authorization: Bearer ' . $sendgrid_apikey));
					curl_setopt($session, CURLOPT_POST, true);
					curl_setopt($session, CURLOPT_POSTFIELDS, $params);
					curl_setopt($session, CURLOPT_HEADER, false);
					curl_setopt($session, CURLOPT_RETURNTRANSFER, true);
					$response = curl_exec($session);
					$response = json_decode($response, true);
					curl_close($session);
					if ($response["message"]=="error") {
						$this->flag_success = false;
						$this->flag_error = "send_failure";
						if ($this->debug) {
							foreach ($response["errors"] as $error) {
								$this->errors[] = $error;
							}
						}
						return;
					}
				}
			}
			$this->flag_error = "send_success";
		}

	}

?>