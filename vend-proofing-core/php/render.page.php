<?php

	/* disable direct access
		*/
	if (count(get_included_files())==1) exit();

	function cleanExtractedFilename ($p_event, &$p_header){
		// cget pertinant info
		$stored_filename = trim($p_header['stored_filename'], "/");
		$folder = $p_header['folder'];
		$filename = $p_header['filename'];
		// skip any folders
		if (strpos($stored_filename, "/")!==false) return 0;
		if ($folder==true) return 0;
		// skip any folders
		if (substr($stored_filename, 0, 8)=="__MACOSX") return 0;
		// skip anything that isn't an image
		$valid_types = array("eot", "svg", "ttf", "woff", "css");
		$extension = strtolower(substr($stored_filename, strrpos($stored_filename, '.')+1));
		if (in_array($extension, $valid_types)==false) return 0;
		// ok, if we're here, lets extract it to a unique name
		$filename_bits = explode("/", $filename);
		$filename = array_pop($filename_bits);
		$filename_bits[count($filename_bits)-1] .= "-" . $filename;
		$p_header['filename'] = implode("/", $filename_bits);
		return 1;
	}

	/* extend the gateway class to include any custom functionality
		*/
	class LocalPage extends Page {
		
		protected function unpackFont ($asset, $fallback="") {
			if ($asset["source"]!="") {
				$zip_location = $asset["source"];
				$filehash = md5($asset["child"]);
				$extension = strtolower(substr($zip_location, strrpos($zip_location, '.')+1));
				if ($extension=="zip") {
					$stylesheet = SA_DIR_CACHE . "/" . $filehash . "-stylesheet.css";
					if (file_exists($stylesheet)==false) {
						$archive = new PclZip($zip_location);
						$archive->extract(
							PCLZIP_OPT_PATH, SA_DIR_CACHE . "/" . $filehash,
							PCLZIP_CB_PRE_EXTRACT, "cleanExtractedFilename",
							PCLZIP_OPT_REMOVE_ALL_PATH
						);
					}
					if (file_exists($stylesheet)!=false) {
						$font_styles = 	Filesystem::getFileData($stylesheet);
						$font_name = 	Func::getTextBetween($font_styles, "font-family: '", "';");
						$fallback = 	'"' . $font_name . '", ' . $fallback;
						$font_styles =	str_replace("url('", "url('" . SA_DIR_CACHE . "/" . $filehash . "-", $font_styles);
						print $font_styles;
					}
				} else {
					$fallback = 	'"' . $filehash . '", ' . $fallback;
					print '
@font-face {
    font-family: "' . $filehash . '";
    src: url("' . $zip_location . '");
    font-weight: normal;
    font-style: normal;
}';
				}
			}
			return $fallback;
		}

		protected function isCacheable () {
			if ( $this->render_type=="html" ) return false;
			return $this->flag_cache;
		}

		protected function checkForRedirect () {
			if ($this->query_original=="/eula/") {
				parent::checkForRedirect();
				return;
			}
			$ordering = $this->data_lookup["ordering"];
			$force_browser_ssl_bool = $ordering->getNodeVal("data.ordering.force_browser_ssl_bool")=="true";
			$baseurl = Func::getBaseUrl();
			if ($force_browser_ssl_bool&&substr($baseurl, 0, 7)=="http://"&&$this->query_actual!="/admin/") {
				$baseurl = "https://" . substr($baseurl, 7);
				header("Location: " . $baseurl . "/" . SA_DIR_INDEXPATH . "?" . $this->query_actual);
				exit();
			}
			parent::checkForRedirect();
		}

		protected function setHomePage () {
			$this->home_uri = "/" . $this->flag_label_special . "/" . $this->flag_label_splash . "/";
			$this->data_lookup["splash"] = Flatfile::getXmlArray("splash");
		}

		protected function populatePage ($page_obj) {
			$this->page_object["title"] = $page_obj[1];
			$this->page_object["class"] = ucwords($page_obj[2]);
		}

		protected function isPageAuthenticated ($page_id, $page_data) {
			global $CONFIG;
			$password_required = $page_data->getNodeVal("data.settings.password")!="";
			$set_authid = isset($_COOKIE[$page_id."_authid"]) ? $_COOKIE[$page_id."_authid"] : "";
			$authenticated = $set_authid == md5( $page_id . $CONFIG->getNodeVal("setup.product_key"));
			return $password_required==false || $authenticated;
		}

		protected function time_to_decimal($time) {
			if (strlen($time)==0) return 0;
			$timeArr = explode(':', $time);
			$decTime = $timeArr[0] . "." . (($timeArr[1]/60)*100);
			return $decTime;
		}

		protected function isPageExpired ($page_id, $page_data) {
			$expires_on_date = $page_data->getNodeVal("data.settings.expires_on_date");
			$expires_on_date_timezone = $page_data->getAttrVal("data.settings.expires_on_date.timezone");
			$expires_on_date_offset = $page_data->getAttrVal("data.settings.expires_on_date.offset");
			$expired = false;
			if ($expires_on_date>0&&strlen($expires_on_date)>0&&$expires_on_date!=null) {
				if (strlen($expires_on_date_timezone)>0) { // old sets not re-set will default to the original time zone
					if (function_exists("date_default_timezone_set")==false) @putenv("TZ=$expires_on_date_timezone");
					else @date_default_timezone_set($expires_on_date_timezone);
				}
				$expires_on_date_actual = $expires_on_date/1000;
				if (strlen($expires_on_date_offset)>0) { // old sets not re-set will default to the original time zone
					$expires_on_date_actual = $expires_on_date_actual - ($this->time_to_decimal($expires_on_date_offset)*60*60) - (date("I", $expires_on_date/1000)==1?3600:0);
				}
				$expired = $expires_on_date_actual < time();
			}
			return $expired;
		}

	}

	/* init the gateway
		*/
	$page = new LocalPage();
	$page->cache(false);
	$page->setTypes(array("js", "html", "xml", "css"));
	$page->loadData(array("setup", "design", "ordering", "language"));
	$page->render();

?>