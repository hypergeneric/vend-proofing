<?php

	use Michelf\Markdown;

	class Page {

		/* ---- Public Methods ---- */

		public function cache ($bool) {
			$this->flag_cache = $bool;
		}

		public function setTypes ($arr) {
			$this->render_types = $arr;
		}

		public function loadData ($arr) {
			$this->data_types = $arr;
		}

		public function info ($key=null) {
			if ($key==null) return $this->page_object;
			else return $this->page_object[$key];
		}

		public function getPageHash () {
			return $this->query_actual;
		}

		public function getHomeUri () {
			return $this->home_uri;
		}

		public function getData ($key) {
			return $this->data_lookup[$key];
		}

		public function isHome () {
			return $this->flag_is_home;
		}

		public function render () {
			$this->init();
		}

		/* ---- Constructor ---- */

		public function __construct() {
			global $LANG;
			$query_clean = rawurldecode($_SERVER['QUERY_STRING']);
			if ( strpos($query_clean, "/")!== false ) {
				$query_clean = substr($query_clean, 0, strrpos($query_clean, "/") + 1);
				$this->query_original = $query_clean;
				unset($_GET[$query_clean]);
				foreach ($_GET as $key => $val) {
					if (strlen($val)==0) unset($_GET[$key]);
				}
			}
			$this->flag_label_page = $LANG->lookup('uri_page_identifier');
			$this->flag_label_special = $LANG->lookup('uri_special_identifier');
			$this->flag_label_contact = $LANG->lookup('uri_contact_identifier');
			$this->flag_label_splash = $LANG->lookup('uri_splash_identifier');
		}

		/* ---- Private Properties ---- */

		protected $flag_label_page;
		protected $flag_label_special;
		protected $flag_label_contact;
		protected $flag_label_splash;
		protected $flag_is_special = false;
		protected $flag_special_type;
		protected $flag_cache = false;
		protected $flag_is_home = false;
		protected $home_uri = "/init/";
		protected $render_type = "";
		protected $page_object = array();
		protected $data_types = array();
		protected $render_types = array();
		protected $data_lookup = array();
		protected $query_original = "";
		protected $query_actual = "";
		protected $markdown_lookup = false;

		protected function getTypedChildObject ($obj) {
			$xmlstr = "<data><settings>";
			$xmlstr .= rawurldecode($obj[2]);
			$xmlstr .= "</settings></data>";
			$child = new SimpleXML4($xmlstr);
			return $child;
		}

		protected function getTypedChildValue ($obj, $key, $arg1=100) {
			return $this->getTypedValue($obj, "settings", $key, $arg1);
		}

		protected function getTypedValue ($type, $group, $key, $arg1=100) {
			$ingest = is_string($type) ? $this->getData($type) : $type;
			$key_fragments = explode("_", $key);
			$key_type = array_pop($key_fragments);
			switch ($key_type) {
			 case "color" :
				$opacity = $arg1;
				$value = $ingest->getNodeVal("data.$group.$key");
				$value = trim(strtolower($value));
				if (substr($value, 0, 2)=="0x") $value = substr($value, 2);
				if (substr($value, 0, 1)=="#") $value = substr($value, 1);
				$value = strtoupper($value);
				$value = array (
					"value" => $value,
					"css" => "#" . $value,
					"constant" => "0x" . $value,
					"rgb" => Func::html2rgb($value)
				);
				$value["rgba"] = implode(",", array_merge($value["rgb"], array($opacity/100)));
				$value["rgb"] = implode(",", $value["rgb"]);
				break;
			 case "ratio" :
				$delimiter = $ingest->getAttrVal("data.$group.$key.delimiter");
				$delimiter = $delimiter==null ? "x" : $delimiter;
				$value = $ingest->getNodeVal("data.$group.$key");
				$value = explode($delimiter, $value);
				break;
			 case "num" :
				$value = $ingest->getNodeVal("data.$group.$key");
				break;
			 case "bool" :
				$value = $ingest->getNodeVal("data.$group.$key")=="true";
				break;
			 case "linkage" :
				$value = array (
					"href" => trim($ingest->getNodeVal("data.$group.$key")),
					"target" => $ingest->getAttrVal("data.$group.$key.target")
				);
				break;
			 case "asset" :
				$value = array (
					"child" => null,
					"type" => null,
					"path" => "",
					"extension" => "",
					"source" => "",
					"width" => 0,
					"height" => 0,
					"alt" => ""
				);
				$localpath = $ingest->getNodeVal("data.$group.$key");
				if (strlen($localpath)!=0) {
					$fragments = explode("/", $localpath);
					$value["child"] = array_pop($fragments);
					$value["type"] = array_pop($fragments);
					$value["path"] = SA_DIR_STORAGE . "/" . $value["type"] . "/" . $value["child"];
					$value["extension"] = strtoupper(substr(strrchr($localpath, '.'), 1));
					$value["source"] = $localpath;
					$value["width"] = $ingest->getAttrVal("data.$group.$key.width");
					$value["height"] = $ingest->getAttrVal("data.$group.$key.height");
				}
				break;
			 case "email" :
				$value = array (
					"name" => trim($ingest->getNodeVal("data.$group.$key")),
					"address" => trim($ingest->getAttrVal("data.$group.$key.href")),
					"markdown" => trim($this->doMarkdown("<" . $ingest->getAttrVal("data.$group.$key.href") . ">"))
				);
				break;
			 case "url" :
				$value = array (
					"name" => trim($ingest->getNodeVal("data.$group.$key")),
					"href" => trim($ingest->getAttrVal("data.$group.$key.href"))
				);
				break;
			 default :
				$options = $ingest->getAttrVal("data.$group.$key.options");
				$action = $ingest->getAttrVal("data.$group.$key.action");
				$value = $ingest->getNodeVal("data.$group.$key");
				if ($options==null&&$action==null) {
					$markdown = $ingest->getAttrVal("data.$group.$key.markdown")==true;
					$value = array (
						"value" => trim($value),
						"html" => htmlspecialchars(trim($value)),
						"markdown" => $markdown ? trim($this->doMarkdown($value)) . "\n" : "",
						"flash" => $markdown ? trim($this->doFlashMarkdown($value)) : ""
					);
				}
				break;
			}
			return $value;
		}

		protected function cleanXmlOutput (&$source) {
			if (is_array($source)==false) return;
 			foreach($source as $key => $obj) {
				$key_fragments = explode("_", $key);
				$key_type = array_pop($key_fragments);
				if ($key_type=="linkage") {
					$source[$key]["_v"] = $this->doFlashURIConvert($obj["_v"]);
				}
				if (isset($obj["_a"])) {
					if (isset($obj["_a"]["markdown"])) {
					if ($obj["_a"]["markdown"]=="true") {
						$source[$key]["_v"] = $this->doFlashMarkdown($obj["_v"]);
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

		protected function doFlashMarkdown ($str) {
			$str = $this->doMarkdown($str);
			$str = $this->doFlashURIConvert($str);
			$str = preg_replace('/(?:(?<=\>)|(?<=\/\>))(\s+)(?=\<\/?)/', "", $str);
			$str = str_replace("\n", "", $str);
			$str = str_replace(" />", " /><p></p>", $str);
			$str = str_replace("<br /><p></p>", "<br />", $str);
			$str = str_replace("<hr /><p></p>", "<hr />", $str);
			$str = str_replace("</p>", "</p><p></p>", $str);
			$str = str_replace("</h1>", "</h1><p></p>", $str);
			$str = str_replace("</h2>", "</h2><p></p>", $str);
			$str = str_replace("</ul>", "</ul><p></p>", $str);
			$str = str_replace("</pre>", "</pre><p></p>", $str);
			$str = trim($str);
			return $str;
		}

		protected function addTargetToHrefs ($string, $target='_blank') {
			$protocols = array('http', 'https');
			foreach ($protocols as $protocol) {
				$string = str_replace(' href="' . $protocol . ':', ' target="' . $target . '" href="' . $protocol . ':', $string);
			}
			return $string;
		}

		protected function doFlashURIConvert ($str) {
			$str = str_replace("?/page/", "asfunction:INTERNAL,/page/", $str);
			$str = str_replace("?/special/", "asfunction:INTERNAL,/special/", $str);
			$str = str_replace("?/" . $this->flag_label_page . "/", "asfunction:INTERNAL,/" . $this->flag_label_page . "/", $str);
			$str = str_replace("?/" . $this->flag_label_special . "/", "asfunction:INTERNAL,/" . $this->flag_label_special . "/", $str);
			return $str;
		}

		protected function doMarkdown ($str) {
			$cleananchors = strpos(strtolower($str), "<a ")===false;
			if ($this->markdown_lookup==false) {
				$this->markdown_lookup = "\n";
				$lookup = $this->data_lookup["page"];
				foreach ($lookup as $key => $obj) {
					$this->markdown_lookup .= "[" . $this->flag_label_page . "-" . $obj[0] . "]: ?/" . $this->flag_label_page . "/" . $obj[0] . "/" . $this->cleanTitleFragment($obj[1]) . " (" . $obj[1] . ") \n";
					$this->markdown_lookup .= "[page-" . $obj[0] . "]: ?/page/" . $obj[0] . "/" . $this->cleanTitleFragment($obj[1]) . " (" . $obj[1] . ") \n";
				}
				$lookup = $this->data_lookup["asset"];
				foreach ($lookup as $key => $obj) {
					$this->markdown_lookup .= "[asset-" . $obj[0] . "]: " . SA_DIR_STORAGE . "/asset/" . $obj[0] . " (" . $obj[1] . ") \n";
				}
				$this->markdown_lookup .= "[" . $this->flag_label_special . "-" . $this->flag_label_contact . "]: ?/" . $this->flag_label_special . "/" . $this->flag_label_contact . "/ \n";
				$this->markdown_lookup .= "[" . $this->flag_label_special . "-" . $this->flag_label_splash . "]: ?/" . $this->flag_label_special . "/" . $this->flag_label_splash . "/ \n";
				$this->markdown_lookup .= "[special-contact]: ?/special/contact/ \n";
				$this->markdown_lookup .= "[special-splash]: ?/special/splash/ \n";
				$this->markdown_lookup .= "\n";
			}
			$str .= $this->markdown_lookup;
			$str = Markdown::defaultTransform($str);
			if ($cleananchors) $str = $this->addTargetToHrefs($str);
			return $str;
		}

		protected function cleanTitleFragment ($str) {
			$str = Func::remove_accent($str);
			$str = Func::homogenize($str);
			$checkempty = str_replace("-", "", $str);
			if (strlen($checkempty)==0) return "";
			return $str;
		}

		protected function isCacheable () {
			return $this->flag_cache;
		}

		protected function filterPage ($content) {
			return $content;
		}

		protected function init () {
			/* determine some basics
				*/
			if (strlen($this->query_original)==0) { // no query, no worries
				$this->render_type = "html";
				$this->flag_is_home = true;
			} else { // there is a query, figure out if it's an initernal, or if it's got tracking params
				$query = trim($this->query_original, "/");
				$query_fragments = explode("/", $query);
				$this->render_type = array_shift($query_fragments);
				if (in_array($this->render_type, $this->render_types)==false) {
					$this->render_type = "html";
				}
			}
			/* check to see if the page is cached, if caching is enabled
				*/
			if ($this->isCacheable()) $this->checkCachedPage();
			/* load up the setup xml data types
				*/
			for ($i=0; $i<count($this->data_types); ++$i) {
				$data_type = $this->data_types[$i];
				$this->data_lookup[$data_type] = Flatfile::getXmlArray($data_type);
			}
			/* load up our special pages and pages, and assets
				*/
			$this->data_lookup["splash"] = Flatfile::getXmlArray("splash", null, true);
			$this->data_lookup["contact"] = Flatfile::getXmlArray("contact", null, true);
			$this->data_lookup["page"] = Flatfile::getSetTable("page");
			$this->data_lookup["asset"] = Flatfile::getFileTable("asset");
			/* find the site homepage
				*/
			$this->setHomePage();
			/* fix the query stuff
				*/
			$query = $this->flag_is_home ? $this->home_uri : $this->query_original;
			$query = trim($query, "/");
			$query_fragments = explode("/", $query);
			if (in_array($query_fragments[0], $this->render_types)==false) {
				array_unshift($query_fragments, "html");
			}
			/* set the global page values
				*/
			$this->render_type = array_shift($query_fragments);
			$this->page_object["type"] = array_shift($query_fragments);
			$this->page_object["id"] = array_shift($query_fragments);
			$this->page_object["hash"] = array_shift($query_fragments);
			$this->page_object["fragments"] = $query_fragments;
			/* load up our data sets
				*/
			$this->checkForInit();
			/* draw it up
				*/
			$query_actual = "";

			/* check to see if it's a "special" page
				*/
			switch ($this->page_object["type"]) {
			 case "cronjob" :
				$this->render_type = "xml";
				$this->cache(false);
				$query_actual = "/cronjob/";
				break;
			 case "init" :
				$this->cache(false);
				$query_actual = "/init/";
				break;
			 case "admin" :
				$this->cache(false);
				$query_actual = "/admin/";
				break;
			 case "order" :
				$this->cache(false);
				$query_actual = $this->page_object["type"] . "/" . $this->page_object["id"] . "/" . $this->page_object["hash"];
				$query_actual = trim($query_actual, "/");
				$query_actual = $query_actual . "/" . implode("/", $this->page_object["fragments"]);
				$query_actual = trim($query_actual, "/");
				$query_actual = "/$query_actual/";
				break;
			 case $this->flag_label_special :
			 case "special" :
				$this->flag_is_special = true;
				$this->flag_special_type = $this->page_object["id"]=="splash" || $this->page_object["id"]==$this->flag_label_splash ? "splash" : "contact";
				/* load up the page data
					*/
				$this->page_object["data"] = $this->data_lookup[$this->flag_special_type];
				$page_data = $this->page_object["data"];
				if ($this->page_object["data"]==false) {
					$this->do404();
				}
				$this->page_object["title"] = $page_data->getNodeVal("data.settings.title");
				$this->page_object["class"] = ucwords("Special " . $this->flag_special_type);
				/* this is the full hash including the title
					*/
				$query_actual = $this->page_object["type"] . "/" . $this->page_object["id"] . "/" . $this->cleanTitleFragment($this->page_object["title"]);
				$query_actual = trim($query_actual, "/");
				$query_actual = "/$query_actual/";
				break;
			 case $this->flag_label_page :
			 case "page" :
				/* pull in the page stuff
					*/
				$page_obj = @$this->data_lookup["page"][$this->page_object["id"]];
				/* if the page doesn't exist, throw a fit
					*/
				if (!isset($page_obj)) {
					$this->do404();
				}
				/* load up the page data
					*/
				$this->populatePage($page_obj);
				$this->page_object["data"] = Flatfile::getXmlArray(strtolower($this->page_object["class"]), $this->page_object["id"]);
				/* this is the full hash including the title
					*/
				$query_actual = $this->page_object["type"] . "/" . $this->page_object["id"] . "/" . $this->cleanTitleFragment($this->page_object["title"]);
				$query_actual = trim($query_actual, "/");
				$query_actual = $query_actual . "/" . implode("/", $this->page_object["fragments"]);
				$query_actual = trim($query_actual, "/");
				$query_actual = "/$query_actual/";
				break;
			}
			$this->query_actual = $query_actual;
			/* check to see if we need to redirect
				*/
			$this->checkForRedirect();
			/* otherwise, draw it up, and cache if neccessary
				*/
			$content = $this->outputContent();
			/* cache if neccessary
				*/
			if ($this->isCacheable()) $this->cachePage($content);
			else $this->decachePage();
			/* and print
				*/
			$this->drawContent($content);
		}
		
		protected function do404 () {
			include SA_DIR_COREPATH . "/tmpl/404.tmpl";
			exit();
		}

		protected function checkForRedirect () {
			if ( !$this->flag_is_home && $this->render_type=="html" && $this->query_actual!="" && $this->query_actual!=$this->query_original ) {
				$url = Func::getBaseUrl() . "/" . SA_DIR_INDEXPATH . "?" . $this->query_actual;
				foreach ($_GET as $key => $val) {
					$url .= "&" . urlencode( $key ) . '=' . urlencode( $val );
				}
				header("HTTP/1.1 301 Moved Permanently");
				header("Location: " . $url);
				exit();
			}
		}

		protected function setHomePage () {
			$this->home_uri = "/" . $this->flag_label_special . "/" . $this->flag_label_splash . "/";
		}

		protected function populatePage ($page_obj) {
			$this->page_object["title"] = "";
			$this->page_object["class"] = "Page";
		}

		protected function outputContent () {
			global $CONFIG, $LANG;
			ob_start();
			$internal = array($this->flag_label_page, "page", $this->flag_label_special, "special");
			$page_type = in_array($this->page_object["type"], $internal) ? "content" : $this->page_object["type"];
			$include_path = SA_DIR_COREPATH . "/tmpl/" . $this->render_type . "/1.page.$page_type.tmpl";
			$CLEAN_URLS = true;
			if (file_exists($include_path)) {
				include $include_path;
			} else {
				$this->do404();
			}
			$content = ob_get_contents();
			ob_end_clean();
			if ($CLEAN_URLS) {
				$content = $this->cleanUrlStructure($content);
				$content = $this->filterPage($content);
			}
			return $content;
		}

		protected function cleanUrlStructure ($content) {
			$content = preg_replace_callback(
				array('/INTERNAL,\/'.$this->flag_label_page.'\/(.+)<\/(.+)linkage>/U', '/INTERNAL,\/'.$this->flag_label_special.'\/(.+)<\/(.+)linkage>/U'),
				array($this, "CUS_xml"),
				$content
			);
			$content = preg_replace_callback(
				array('/\/'.$this->flag_label_page.'\/(.+)\"/U', '/\/'.$this->flag_label_special.'\/(.+)\"/U'),
				array($this, "CUS_quote"),
				$content
			);
			return $content;
		}
		protected function CUS_xml ($matches) {
			$hash = $this->getCleanPageHash($matches);
			return "INTERNAL,/".$hash."</".$matches[2]."linkage>";
		}
		protected function CUS_quote ($matches) {
			$hash = $this->getCleanPageHash($matches);
			return "/".$hash.'"';
		}
		protected function getCleanPageHash ($matches) {
			$hashbits = explode("/", $matches[1]);
			$pageid = $hashbits[0];
			$hash = "";
			if (in_array($pageid, array("splash", $this->flag_label_splash, "contact", $this->flag_label_contact))) {
				$type = $hashbits[0]==$this->flag_label_splash ? "splash" : "contact";
				$data = $this->data_lookup[$type];
				if ($data!=false) {
					$hash = $data->getNodeVal("data.settings.title");
					$hash = $this->cleanTitleFragment($hash);
				}
				$urihash = "special/".$pageid."/";
			} else {
				$lookup = $this->data_lookup["page"];
				if (isset($lookup[$pageid])) {
					$pageobj = $lookup[$pageid];
					$hash = $this->cleanTitleFragment($pageobj[1]);
				} else {
					if (isset($hashbits[1])) {
						$hash = trim($hashbits[1], "/");
					}
				}
				$urihash = "page/".$pageid."/";
			}
			if (strlen($hash)>0) $urihash .= $hash."/";
			return $urihash;
		}

		protected function drawContent ($content) {
			$this->createheaders();
			print $content;
			exit();
		}

		protected function createheaders ($size=0) {
			/*
				we're gonna set a time in the future
				to make sure the browser caches it
				*/
			if ($this->flag_cache==false) {
				header("Expires: Tue, 03 Jul 2001 06:00:00 GMT");
				header("Last-Modified: " . gmdate("D, d M Y H:i:s") . " GMT");
				header("Cache-Control: post-check=0, pre-check=0", false);
				if (Func::isIESSL()==false) {
					header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
					header("Pragma: no-cache");
				}
			} else {
				/*header('Expires: ' . gmdate('D, d M Y H:i:s', time()+(60*60*24*14)) . ' GMT');
				header("Cache-Control: maxage=".(60*60*24*14));
				header("Pragma: public");*/
			}
			/*
				output the right header for the right
				filetype
				*/
			switch ($this->render_type) {
			 case "js" :
			 case "embed" :
				header ("Content-Type: text/javascript");
				break;
			 default :
				header ("Content-Type: text/" .  $this->render_type);
				break;
			}
			/*
				send the size as well for good measure
				*/
			if ($size>0) {
				header('Content-Length: '. $size);
			}
		}

		protected function checkForInit () {
			global $CONFIG;
			$hasAuth = file_exists(SA_DIR_AUTH) || $CONFIG->getNodeVal("setup.hub")=="true";
			$hasContent = count($this->data_lookup["page"])>0;
			if ( !$hasAuth && !$hasContent && $this->render_type=="html" && $this->flag_is_home ) {
				header("Location: " . Func::getBaseUrl() . "/" . SA_DIR_INDEXPATH . "?/init/");
				exit();
			}
		}

		protected function decachePage () {
			$filename = md5($this->query_original) . "." . $this->render_type;
			$filepath = SA_DIR_CACHE . "/" . $filename;
			Filesystem::deleteFile($filepath);
		}

		protected function cachePage ($content) {
			$filename = md5($this->query_original) . "." . $this->render_type;
			$filepath = SA_DIR_CACHE . "/" . $filename;
			Filesystem::makeFile($filepath, $content, "w", true);
		}

		protected function checkCachedPage () {
			$filename = md5($this->query_original) . "." . $this->render_type;
			$filepath = SA_DIR_CACHE . "/" . $filename;
			if (file_exists($filepath)) {
				$this->createheaders(filesize($filepath));
				readFile($filepath);
				exit();
			}
		}

	}

?>