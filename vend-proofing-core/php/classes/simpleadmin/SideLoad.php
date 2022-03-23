<?php

	require_once("SimpleXML4.php");
	require_once("Func.php");

	class SideLoad {
		
		/* ---- Public Properties ---- */
		
		public function metaOnly ($bool) {
			$this->meta = $bool;
		}
		
		public function getURL () {
			return $this->url;
		}
		
		public function setURL ($url) {
			/* save the uri
				*/
			$this->url = $url;
			/* these are our 4 options
				*/
			$baseurl = Func::getBaseUrl();
			if (substr($baseurl, 0, 7)=="http://") $baseurl = substr($baseurl, 7);
			if (substr($baseurl, 0, 8)=="https://") $baseurl = substr($baseurl, 8);
			if (substr($baseurl, 0, 4)=="www.") $baseurl = substr($baseurl, 4);
			$baseurl = explode("/", $baseurl);
			$baseurl = array_shift($baseurl);
			/* determine what service provider we're gonna use
				*/
			if (substr($url, 0, 1)=="/") {
				$this->service = "local";
			} else if (stripos($url, $baseurl)!==false) {
				$this->url = substr($url, stripos($url, $baseurl)+strlen($baseurl));
				$this->service = "local";
			} else if (stripos($url, "youtube.com/watch")!==false) {
				$this->service = "youtube";
			} else if (stripos($url, "vimeo.com")!==false) {
				if (stripos($url, "player.vimeo.com")!==false) {
					$bits = explode("/", trim($url, "/"));
					$id = array_pop($bits);
					$this->url = "vimeo.com/$id";
				}
				$this->service = "vimeo";
			} else if (stripos($url, "sketchfab.com")!==false) {
				$this->service = "sketchfab";
			} else {
				$this->service = "remote";
			}
			/* get the final path
				*/
			if ($this->meta==false) {
				$this->getFinalPath();
			} else {
				$this->getMetaData();
			}
		}
		
		public function getService () {
			return $this->service;
		}

		public function getFilename () {
			return $this->filename . "." . $this->extension;
		}

		public function getBasename () {
			return $this->filename;
		}

		public function getExtension () {
			return $this->extension;
		}

		public function isLocal () {
			return $this->service=="local";
		}

		public function getURI () {
			return $this->filepath;
		}

		public function copyTo ($path) {
			$docroot = rtrim($_SERVER["DOCUMENT_ROOT"], "/");
			return @copy($docroot.$this->filepath, $path);
		}

		public function downloadTo ($path="") {
			ini_set('max_execution_time', 0);
			@set_time_limit(0);
			$docroot = rtrim($_SERVER["DOCUMENT_ROOT"], "/");
			$temppath = SA_DIR_TEMP . "/" . md5($this->filename) . "." . $this->extension;
			$file = fopen($temppath, 'wb');
			$ch = curl_init();
			curl_setopt($ch, CURLOPT_FILE, $file);
			curl_setopt($ch, CURLOPT_URL, $this->filepath);
			curl_setopt($ch, CURLOPT_FOLLOWLOCATION, 1);
			curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2272.101 Safari/537.36');
			curl_exec($ch);
			curl_close($ch);
			fclose($file);
			return @rename($temppath, $path);
		}
		
		/* ---- Constructor ---- */
		
		public function __construct() {
		}
		
		/* ---- Private Properties ---- */

		protected $url;
		protected $snapshot;
		protected $dimensions;
		protected $filepath;
		protected $filename;
		protected $extension;
		protected $service;
		protected $meta = false;

		protected function loadRemoteFile ($uri) {
			$ch = curl_init();
			curl_setopt($ch, CURLOPT_FAILONERROR, true);
			curl_setopt($ch, CURLOPT_URL, $uri);
			curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
			curl_setopt($ch, CURLOPT_HEADER, false);
			curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
			curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 0);
			curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2272.101 Safari/537.36');
			$str = curl_exec($ch);
			curl_close($ch);
			return $str;
		}

		protected function jsonDecode($json) {
			$comment = false;
			$out = '$x=';
			for ($i=0; $i<strlen($json); $i++) {
				if (!$comment) {
					if (($json[$i] == '{') || ($json[$i] == '['))       $out .= ' array(';
					else if (($json[$i] == '}') || ($json[$i] == ']'))   $out .= ')';
					else if ($json[$i] == ':')    $out .= '=>';
					else                         $out .= $json[$i];
				} else $out .= $json[$i];
				if ($json[$i] == '"' && $json[($i-1)]!="\\")    $comment = !$comment;
			}
			@eval($out . ';');
			return $x;
		}
		
		protected function getMetaData () {
			/* this is what we need to get
				*/
			$filename = "";
			$filepath = "";
			$extension = "jpg";
			switch ($this->service) {
				case "youtube" :
					$data = $this->loadRemoteFile($this->url);
					$video_id = preg_match("#(?<=v=)[a-zA-Z0-9-]+(?=&)|(?<=v\/)[^&\n]+(?=\?)|(?<=v=)[^&\n]+|(?<=youtu.be/)[^&\n]+#", $this->url, $matches);
					$video_id = $matches[0];
					$filepath = "http://img.youtube.com/vi/" . $video_id . "/maxresdefault.jpg";
					// check to see if the max is there
					$handle = curl_init($filepath);
					curl_setopt($handle,  CURLOPT_RETURNTRANSFER, TRUE);
					$response = curl_exec($handle);
					$httpCode = curl_getinfo($handle, CURLINFO_HTTP_CODE);
					if($httpCode == 404) {
						$filepath = "http://img.youtube.com/vi/" . $video_id . "/0.jpg";
					}
					curl_close($handle);
					$filename = Func::getTextBetween($data, '<title>', '</title>');
					$filename = str_replace(array("\n", "\t"), " ", $filename);
					$filename = trim($filename);
					$filename = strlen($filename)!=0 ? $filename : $video_id;
					break;
				case "vimeo" :
					$data = $this->loadRemoteFile("http://vimeo.com/api/oembed.xml?url=http://" . $this->url);
					$video_id = Func::getTextBetween($data, "<video_id>", "</video_id>");
					$filepath = Func::getTextBetween($data, "<thumbnail_url>", "</thumbnail_url>");
					$filename = Func::getTextBetween($data, "<title>", "</title>");
					break;
				case "sketchfab" :
					$data = $this->loadRemoteFile("https://sketchfab.com/oembed?url=https://" . $this->url);
					$data = $this->jsonDecode($data);
					$video_id = array_pop(explode("/", trim($this->url, "/")));
					$filepath = $data["thumbnail_url"];
					$filename = $data["title"];
					break;
			}
			$this->filename = $filename;
			$this->extension = $extension;
			$this->filepath = $filepath;
		}

		protected function getFinalPath () {
			/* this is what we need to get
				*/
			$filename = "";
			$extension = "";
			$filepath = "";
			switch ($this->service) {
				case "youtube" :
					// http://userscripts.org/scripts/review/109103
					// scrape page
					$data = $this->loadRemoteFile($this->url);
					// obtain video ID, formats map
					$video_id = null;
					$video_formats = null;
					if ( strpos($data, 'watch-player')!==false && strpos($data, 'html5-player')===false ) {
						$found = preg_match("/\&amp;video_id=([^(\&|$)]*)/", $data, $matches);
						$video_id = $found!=0 ? $matches[1] : null;
						$found = preg_match("/\&amp;url_encoded_fmt_stream_map=([^(\&|$)]*)/", $data, $matches);
						$video_formats = $found!=0 ? $matches[1] : null;
					}					
					if ( $video_id==null || $video_formats==null ) {
						if ( $video_id==null ) {
							$found = preg_match("/\"video_id\":\s*\"([^\"]*)\"/", $data, $matches);
							$video_id = $found!=0 ? $matches[1] : null;
						}
						$found = preg_match("/\"url_encoded_fmt_stream_map\":\s*\"([^\"]*)\"/", $data, $matches);
						$video_formats = $found!=0 ? $matches[1] : null;
					}
					// parse fmt_url_map
					$video_types = array(
						'37'=> array(
							"ext" => "mp4",
							"label" => 'MP4 1080p HD'
						),
						'22'=> array(
							"ext" => "mp4",
							"label" => 'MP4 720p HD'
						),
						'18'=> array(
							"ext" => "mp4",
							"label" => 'MP4 360p'
						),
						'35'=> array(
							"ext" => "flv",
							"label" => 'FLV 480p'
						),
						'34'=> array(
							"ext" => "flv",
							"label" => 'FLV 360p'
						),
						'5'=> array(
							"ext" => "flv",
							"label" => 'FLV 240p'
						)
					);
					$sep1='%2C'; $sep2='%26'; $sep3='%3D';
					if ( strpos($video_formats, ',')!==false ) {
						$sep1=','; $sep2='\\u0026'; $sep3='=';
						if ( strpos($video_formats, '&')!==false ) $sep2='&';
					}
					$video_format_groups = explode($sep1, $video_formats);
					
					foreach ($video_format_groups as $video_format_str) {
						$video_format_array = explode($sep2, $video_format_str);
						$video_format_object = array();
						foreach ($video_format_array as $nvp) {
							$nvp_bits = explode($sep3, $nvp);
							$name = array_shift($nvp_bits);
							$value = urldecode(urldecode(implode($sep3, $nvp_bits)));
							$video_format_object[$name] = $value;
						}
						$video_final_url = $video_format_object["url"];
						if (isset($video_format_object["s"])) $video_final_url .= "&signature=" . $video_format_object["s"];
						else if (isset($video_format_object["sig"])) $video_final_url .= "&signature=" . $video_format_object["s"];
						$video_types[$video_format_object["itag"]]["url"] = $video_final_url;
					}
					// title
					$filename = Func::getTextBetween($data, '<title>', '</title>');
					$filename = explode("\n", trim($filename));
					$filename = trim($filename[0]);
					$filename = strlen($filename)!=0 ? Func::homogenize($filename) : $video_id;
					foreach ($video_types as $video_type) {
						if (isset($video_type["url"])) {
							$extension = $video_type["ext"];
							$filepath = $video_type["url"];
							break;
						}
					}
					// thumbnail
					$thumbnail = "http://img.youtube.com/vi/$video_id/0.jpg";
					break;
				case "vimeo" :
					$data = $this->loadRemoteFile($this->url);
					$found = preg_match('/data-config-url="([^"]*)"/', $data, $matches);
					$data = $this->loadRemoteFile(str_replace("&amp;", "&", $matches[1]));
					$json_obj = $this->jsonDecode($data);
					$vimeo_id = $json_obj["video"]["id"];
					$caption = $json_obj["video"]["title"];
					$isHD = $json_obj["video"]["hd"];
					$filename = Func::homogenize($caption);
					$extension = "mp4";
					$filepath = $isHD ? $json_obj["request"]["files"]["h264"]["hd"]["url"] : $json_obj["request"]["files"]["h264"]["sd"]["url"];
					break;
				case "remote" :
				case "local" :
					$fragments = explode("/", $this->url);
					$filename = array_pop($fragments);
					$fragments = explode(".", $filename);
					$extension = array_pop($fragments);
					$filename = implode($fragments, ".");
					$filepath = $this->url;
					break;
			}
			$this->filename = $filename;
			$this->extension = $extension;
			$this->filepath = $filepath;
		}
		
	}
	
	/*	error_reporting(E_ALL);
	define("SA_DIR_TEMP", "./");
	$test = new SideLoad();
	//$test->metaOnly(true);
	//$test->setURL("http://www.youtube.com/watch?v=8UVNT4wvIGY");
	//$test->setURL("http://www.youtube.com/watch?v=gH2efAcmBQM");
	//$test->setURL("http://vimeo.com/7809605");
	//$test->setURL("hypergeneric.com/corpus/audio/01HoursAway.mp3");
	//$test->setURL("http://simpleadmin.dev-server-torino.com/vanilla/vanilla-data/storage/597b/2318151-5982.mp4");
	$test->setURL("/demos/en/site/miami/miami-data/storage/7565/membershipvideoweb-757f.mp4"); // */
	/* if ($test->isLocal()) {
		print "local <br />";
		print "filename: " . $test->getFilename() . "<br />";
		print "filepath: " . $test->getURI() . "<br />";
		$success = $test->copyTo($test->getFilename());
		print "success: " . ($success?"true":"false") . "<br />";
	} else {
		print "remote <br />";
		print "filename: " . $test->getFilename() . "<br />";
		print "filepath: " . $test->getURI() . "<br />";
		// should look like this: http://v12.lscache4.c.youtube.com/videoplayback?sparams=id%2Cexpire%2Cip%2Cipbits%2Citag%2Cratebypass&fexp=901908&itag=37&ipbits=8&signature=D1C8B1C38A994D1C33D362277E3046B4AAFE9FC5.035429611AD60C17A37BE69F3941AF095DC347FD&sver=3&ratebypass=yes&expire=1302066000&key=yt1&ip=208.0.0.0&id=d40cbf1f4a766039
		$success = $test->downloadTo("./".$test->getFilename());
		print "success: " . ($success?"true":"false") . "<br />";
	} // */

?>