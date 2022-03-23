<?php

	function Graphic_PCLZIP_CB_PRE_EXTRACT ($p_event, &$p_header)
	{
		$filename_bits = explode("/", $p_header['filename']);
		$filename = array_pop($filename_bits);
		$filenamehash = md5(uniqid().$filename);
		$filename = $filenamehash."-".$filename;
		$filename_bits[] = $filename;
		$p_header['filename'] = implode("/", $filename_bits);
		return 1;
	}

	class Graphic {
		
		protected $flag_basename = 			"";
		protected $flag_basename_ext = 		"";
		protected $flag_is_zip = 			0;
		protected $flag_filename = 			"";
		protected $flag_filename_ext = 		"";
		protected $flag_width = 			0;
		protected $flag_height = 			0;
		protected $flag_thumbnail = 		0;
		protected $flag_thumbnail_x = 		50;
		protected $flag_thumbnail_y = 		50;
		protected $flag_quality = 			90;
		protected $flag_sharpen = 			0;
		protected $flag_imagick = 			0;
		protected $flag_watermark = 		0;
		protected $flag_watermark_asset = 	"";
		protected $flag_watermark_x = 		50;
		protected $flag_watermark_y = 		50;
		protected $flag_watermark_alpha = 	100;
		protected $flag_crosshairs = 		0;
		protected $flag_crosshairs_color = 	"ffffff";
		protected $flag_crosshairs_alpha = 	100;
		protected $flag_multiplier = 		1;
		
		protected $zip_archive_uri = 		"";
		protected $image_original_uri = 	"";
		protected $watermark_uri = 			"";
		protected $image_unique_hash = 		"";
		protected $image_temp_uri = 		"";
		protected $cached = 				true;
		protected $encoded = 				false;
		protected $resampled = 				true;
		protected $classname = 				"Graphic";
		protected $href = 					"";
		protected $target = 				"";
		protected $title = 					"";
		protected $description = 			"";
		protected $use_caption = 			false;
		
		public function __construct($obj=array()) {
			
			for ($i=0; $i<8; ++$i) if (isset($obj[$i])==false) $obj[$i] = "";
			if ($obj[2]=="") $obj[2] = "0x0";
			$dim = explode("x", $obj[2]);
			
			$this->setFilename($obj[0]);
			$this->setSize($dim[0], $dim[1]);
			$this->setContext($obj[1], $obj[5]);
			$this->setService($obj[6], $obj[7]);
			$this->update();

		}

		/* ---- Public Methods ---- */
		
		public function parseIngest () {
			
			if ( isset($_GET["q"])==false && isset($_GET["hash"])==false ) {
				$this->process(false, "Invalid Query");
			}
			
			$autosharpen = 1;
			if (!function_exists('imageconvolution')){
				$autosharpen = 0;
			}
			
			$q = isset($_GET["hash"]) ? $this->Hex2String($_GET["hash"]) : rawurldecode($_GET["q"]);
			$q = explode(":", $q);
			for ($i=0; $i<20; ++$i) if (isset($q[$i])==false) $q[$i] = "";
			
			$parent_name = basename($q[0]);
			$child_name = basename($q[1]);
			$width = strlen($q[2])>0 ? $q[2] : 0; // optional
			$height = strlen($q[3])>0 ? $q[3] : 0; // optional
			$exact = strlen($q[4])>0 ? $q[4] : 0; // optional
			$format = strlen($q[5])>0 ? $q[5] : ""; // optional
			$quality = strlen($q[6])>0 ? $q[6] : 90; // optional
			$cache = strlen($q[7])>0 ? $q[7] : 1; // optional
			$watermark = strlen($q[8])>0 ? $q[8] : 0; // optional
			$watermark_name = strlen($q[9])>0 ? $q[9] : ""; // optional
			$watermark_x = strlen($q[10])>0 ? $q[10] : 50; // optional
			$watermark_y = strlen($q[11])>0 ? $q[11] : 50; // optional
			$watermark_alpha = strlen($q[12])>0 ? $q[12] : 50; // optional
			$crosshairs = strlen($q[13])>0 ? $q[13] : 0; // optional
			$crosshairs_color = strlen($q[14])>0 ? $q[14] : "ffffff"; // optional
			$crosshairs_alpha = strlen($q[15])>0 ? $q[15] : 100; // optional
			$multiplier = strlen($q[16])>0 ? $q[16] : 1; // optional
			
			$crop_image = $exact;
			$crop_offset_x = 50;
			$crop_offset_y = 50;
			if (strstr($exact, ",")!==false) {
				$value = explode(",", $exact);
				$crop_image = $value[0];
				$crop_offset_x = $value[1];
				$crop_offset_y = $value[2];
			}
			
			$resample_quality = $quality;
			$resample_sharpen = $autosharpen;
			$resample_imagick = 0;
			if (strstr($quality, ",")!==false) {
				$value = explode(",", $quality);
				$resample_quality = $value[0];
				$resample_sharpen = $value[1];
				$resample_imagick = $value[2];
			}
			$imagick_installed = extension_loaded("Imagick");
			if ($resample_imagick&&$imagick_installed) {
				$imagick_version = Imagick::getVersion();
				$imagick_version = $imagick_version["versionString"];
				$imagick_version = explode(" ", $imagick_version);
				$imagick_version = $imagick_version[1];
				$resample_imagick = version_compare($imagick_version, "6.3.1", ">=");
			} else {
				$resample_imagick = false;
			}
			
			$this->cachable($cache);
			$this->setBasepath($parent_name);
			$this->setFilename($child_name);
			$this->setExtension($format);
			$this->setSize($width, $height);
			$this->thumbnail($crop_image, $crop_offset_x, $crop_offset_y);
			$this->resample(1, $resample_quality, $resample_sharpen, $resample_imagick);
			$this->watermark($watermark, $watermark_name, $watermark_x, $watermark_y, $watermark_alpha, $crosshairs, $crosshairs_color, $crosshairs_alpha);
			$this->setMultiplier($multiplier);
			
		}
		
		public function process ($valid=true, $error="") {
			
			if ( $valid==true ) {
				if ( $this->flag_is_zip==true ) {
					if ( !file_exists($this->zip_archive_uri) ) {
						$valid = false;
						$error = "Zip Archive Does Not Exist";
					}
				} else {
					if ( !file_exists($this->image_original_uri) ) {
						$valid = false;
						$error = "Original Image Does Not Exist";
					}
				}
			}
			
			// errors? out with them and exit
			if ($valid==false) {
				header ("HTTP/1.0 404 Not Found");
				header ("content-type: text/xml");
				print '<?xml version="1.0"?><data><error>' . $error . '</error></data>';
				exit;
			}
			
			// already created?  out with it and exit
			if ( file_exists($this->image_temp_uri) && $this->cached ) {
				$this->outputCached();
			}
			
			// ok, time to make an image
			$this->purgeCache();
			$this->outputNewImage();
			
		}
		
		public function update () {
			$this->zip_archive_uri = SA_DIR_DATAPATH . "/uploads/" . $this->flag_basename;
			$this->image_original_uri = SA_DIR_STORAGE . "/" . $this->flag_basename . "/" . $this->flag_filename;
			$this->watermark_uri = SA_DIR_STORAGE . "/asset/" . $this->flag_watermark_asset;
			$this->image_unique_hash = md5(
				$this->flag_basename . "-" . 
				$this->flag_filename . "-" . 
				$this->flag_filename_ext . "-" . 
				$this->flag_width . "-" . 
				$this->flag_height . "-" . 
				($this->flag_thumbnail?"1":"0") . "-" . 
				$this->flag_thumbnail_x . "-" . 
				$this->flag_thumbnail_y . "-" . 
				$this->flag_quality . "-" . 
				($this->flag_sharpen?"1":"0") . "-" . 
				($this->flag_imagick?"1":"0") . "-" . 
				($this->flag_watermark?"1":"0") . "-" . 
				$this->flag_watermark_asset . "-" . 
				$this->flag_watermark_x . "-" . 
				$this->flag_watermark_y . "-" . 
				$this->flag_watermark_alpha . "-" . 
				($this->flag_crosshairs?"1":"0") . "-" . 
				$this->flag_crosshairs_color . "-" . 
				$this->flag_crosshairs_alpha . "-" . 
				$this->flag_multiplier
			);
			$this->image_temp_uri = SA_DIR_TEMP . "/" . $this->image_unique_hash . "." . $this->flag_filename_ext;
		}
		
		public function cachable ($cache=true) {
			$this->cached = $cache;
		}
		
		public function setBasepath ($str) {
			$this->flag_basename = $str;
			$this->flag_basename_ext = strtolower(substr($this->flag_basename, strrpos($this->flag_basename, ".")+1));
			$this->flag_is_zip = $this->flag_basename_ext=="zip";
			$this->update();
		}
		
		public function setFilename ($str) {
			$this->flag_filename = $str;
			$this->flag_filename_ext = strtolower(substr($this->flag_filename, strrpos($this->flag_filename, ".")+1));
			$this->update();
		}
		
		public function setSize ($width=0, $height=0) {
			if (is_null($width)) {
				$width = 0;
			}
			if (is_null($height)) {
				$height = 0;
			}
			$this->flag_width = $width;
			$this->flag_height = $height;
			$this->update();
		}
		
		public function thumbnail ($bool, $offset_x=50, $offset_y=50) {
			$this->flag_thumbnail = $bool;
			$this->flag_thumbnail_x = $offset_x;
			$this->flag_thumbnail_y = $offset_y;
			$this->update();
		}
		
		public function caption ($bool) {
			$this->use_caption = $bool;
		}
		
		public function resample ($bool, $quality=90, $sharpen=1, $imagick=0) {
			$this->resampled = $bool;
			$this->flag_quality = $quality;
			$this->flag_sharpen = $sharpen;
			$this->flag_imagick = $imagick;
			$this->update();
		}
		
		public function watermark ($use1, $asset, $x, $y, $alpha1, $use2, $color, $alpha2) {
			$this->flag_watermark = $use1;
			$this->flag_watermark_asset = $asset;
			$this->flag_watermark_x = $x;
			$this->flag_watermark_y = $y;
			$this->flag_watermark_alpha = $alpha1;
			$this->flag_crosshairs = $use2;
			$this->flag_crosshairs_color = $color;
			$this->flag_crosshairs_alpha = $alpha2;
			$this->update();
		}
		
		public function setExtension ($str) {
			if ( $str=="" || $str=="zip" ) {
				$str = $this->flag_is_zip ? "jpg" : $this->flag_filename_ext;
			}
			$this->flag_filename_ext = $str;
			$this->update();
		}
		
		public function setMultiplier ($num) {
			$this->flag_multiplier = $num;
			$this->update();
		}
		
		public function setContext ($title="", $description="") {
			$this->title = $title;
			$this->description = $description;
		}
		
		public function setService ($uri="", $service="") {
			$this->media_uri = $uri;
			$this->media_service = $service;
			if ($this->media_uri!=""&&$this->media_service=="") {
				$this->media_service = stristr($this->media_uri, "youtube")===false ? "vimeo" : "youtube";
			}
		}
		
		public function encode ($bool) {
			$this->encoded = $bool;
		}
		
		public function setAnchor ($href=null, $target=null) {
			$this->href = $href;
			$this->target = $target;
		}
		
		public function setClassName ($str) {
			$this->classname = $str;
		}
		
		public function isVideo () {
			return $this->flag_filename_ext=="flv" ||
				$this->flag_filename_ext == "mp4" ||
				$this->flag_filename_ext == "webm" ||
				$this->flag_filename_ext == "ogg" ||
				$this->flag_filename_ext == "mview";
		}
		
		public function render ($useSrcSet=false) {
			return $this->getxhtml($useSrcSet);
		}
		
		public function output ($useSrcSet=false) {
			print $this->getxhtml($useSrcSet);
		}
		
		public function getVideoURI () {
			$response = "";
			$services = array("vimeo", "youtube");
			if (in_array($this->media_service, $services)) {
				$response = "http://" . $this->media_uri;
			}
			return $response;
		}
		
		public function getIframeURI () {
			$response = "";
			if ( $this->media_service=="sketchfab" ) {
				$response = "//" . $this->media_uri . '/embed?autostart=1';
			} else if ( $this->flag_filename_ext=="mview" ) {
				$response = Func::getBaseUrl() . "/" . SA_DIR_INDEXPATH . '?/mview/' . $this->flag_basename . "/" . $this->flag_filename . "/";
			} else if ( $this->flag_filename_ext=="mp4" || $this->flag_filename_ext=="webm" || $this->flag_filename_ext=="ogg" ) {
				$response = Func::getBaseUrl() . "/" . SA_DIR_INDEXPATH . '?/video/' . $this->flag_basename . "/" . $this->flag_filename . "/";
			}
			return $response;
		}
		
		public function source () {
			// already created?  out with it and exit
			if ( file_exists($this->image_temp_uri) && $this->cached ) {
				$img_src = $this->image_temp_uri;
			} else {
				if ( $this->resampled ) {
					$img_src = "";
					$img_base = SA_NAMESPACE . '-resample.php?q=';
					if ( $this->encoded ) {
						$img_base = SA_NAMESPACE . '-resample.php?hash=';
					}
					$img_query = $this->flag_basename . ":" . $this->flag_filename;
					$img_extension = $this->flag_filename_ext;
					if ( $this->isVideo() ) {
						$img_query .= ".snapshot.jpg";
						$img_extension = "jpg";
					}
					$img_query .= ':' . $this->flag_width . ':' . $this->flag_height; // size
					$img_query .= ':' . ($this->flag_thumbnail?"1,".$this->flag_thumbnail_x.",".$this->flag_thumbnail_y:"0"); // exact/offsets
					$img_query .= ':' . $img_extension; // extension
					$img_query .= ':' . $this->flag_quality . "," . ($this->flag_sharpen?"1":"0") . "," . ($this->flag_imagick?"1":"0"); // quality
					$img_query .= ':' . ($this->cached?"1":"0"); // cache
					$img_query .= ':' . ($this->flag_watermark?"1":"0") . ':' . $this->flag_watermark_asset . ':' . $this->flag_watermark_x . ':' . $this->flag_watermark_y . ':' . $this->flag_watermark_alpha;
					$img_query .= ':' . ($this->flag_crosshairs?"1":"0") . ':' . $this->flag_crosshairs_color . ':' . $this->flag_crosshairs_alpha;
					$img_query .= ':' . $this->flag_multiplier;
					if ( $this->encoded ) {
						$img_query = $this->String2Hex($img_query);
					}
					$img_src = $img_base . $img_query;
				} else {
					$img_src = SA_DIR_STORAGE . "/" . $this->flag_basename . "/" . $this->flag_filename;
					if ($this->isVideo()) {
						$img_src .= ".snapshot.jpg";
					}
				}
			}
			return $img_src;
		}
		
		public function sourceSet ($max=3) {
			$mbu = $this->flag_multiplier;
			$output = array();
			for ($i=1; $i<=$max; ++$i) {
				$this->setMultiplier($i);
				$src = $this->source();
				$output[] = $src . " " . $i . "x";
			}
			$this->setMultiplier($mbu);
			return implode(", ", $output);
		}
		
		public function sourceBlank () {
			return "data:image/svg+xml;charset=utf-8,%3Csvg xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg' viewBox%3D'0 0 " . $this->flag_width . " " . $this->flag_height . "'%2F%3E";
		}
		
		public function sourceOriginal () {
			$img_src = SA_DIR_STORAGE . "/" . $this->flag_basename . "/" . $this->flag_filename;
			if ($this->isVideo()) {
				$img_src .= ".snapshot.jpg";
			}
			return $img_src;
		}

		public function dimensions () {
			$image_size = getimagesize($this->image_original_uri);
			$original_width = $image_size[0];
			$original_height = $image_size[1];
			$original_aspect_ratio = $original_width / $original_height;
			$final_width = $original_width;
			$final_height = $original_height;
			/*
				if no dimensions given, or both zero, just return the orginal
				unless it needs a watermark
				*/
			$resample = true;
			$width = $this->flag_width * $this->flag_multiplier;
			$height = $this->flag_height * $this->flag_multiplier;
			if ( $width+$height==0 ) {
				$resample = false;
			}
			if ( $resample ) {
				/*
					if any incoming w/h value is set to 0
					let's autodetect what it should be in aspect ratio
					with a little fancy math
					*/
				if ( $height==0 ) {
					$height = round(($width*$original_height)/$original_width);
				}
				if ( $width==0 ) {
					$width = round(($height*$original_width)/$original_height);
				}
				$new_aspect_ratio = $width/$height;
				/*
					if it's exact, make sure and set the final size to the requested size
					and we're also going to upscale images in thsi case if they are smaller
					just one of those side effects ...
					*/
				if ( $this->flag_thumbnail ) {
					$final_width = round($width);
					$final_height = round($height);
					/*
						if the final output size just so happens too
						be the original file size, forget it, let's just output it
						and save some resources
						*/
					if ( $final_width==$original_width && $final_height==$original_height ) {
						$resample = false;
					}
				} else {
					if ( $original_aspect_ratio>=$new_aspect_ratio ) {
						$final_width = $width;
						$final_height = ($width*$original_height)/$original_width;
						$final_height = round($final_height);
					} else {
						$final_height = $height;
						$final_width = ($height*$original_width)/$original_height;
						$final_width = round($final_width);
					}
					/*
						iif the final size is bigger in any one dimension than the orginal
						don't upscale it, just output the original instead
						*/
					if ( $final_width>=$original_width || $final_height>=$original_height ) {
						$resample = false;
					}
				}
			}
			return array($final_width, $final_height, $original_width, $original_height, $resample);
		}

		/* ---- Private Properties ---- */
		
		protected function Hex2String($hex) {
			$string='';
			for ($i=0; $i < strlen($hex)-1; $i+=2){
				$string .= chr(hexdec($hex[$i].$hex[$i+1]));
			}
			return $string;
		}
		
		protected function purgeCache () {
			/*
				if the cache flag is set, let's save it to the
				cache directory
				*/
			Filesystem::makeFolder(SA_DIR_TEMP); // make sure the folder is there, if possible
			if ( $this->cached && is_writable(SA_DIR_TEMP) ) {
				/*
					since we're already writing to the file system
					we're gonna do a little house cleaning.  every 24 hours
					or greater, one lucky individual will be responsible
					for clearing the cache.
					*/
				$now = time();
				$last_executed = @filemtime(SA_DIR_TEMP."/cache.marker.tmp");
				if ($now-$last_executed>86400) {
					/*
						loop through all the files, and delete everything
						older than a week.  incidentally, this will also
						delete our timestamp (a good thing)
						*/
					$handle = @opendir(SA_DIR_TEMP);
					if ($handle) {
						while (false !== ( $filename = readdir($handle) )) {
							if ($filename == '.' || $filename == '..') continue;
							$last_modified = @filemtime(SA_DIR_TEMP."/$filename");
							if ($now-$last_modified>604800) {
								@unlink(SA_DIR_TEMP."/$filename");
							}
						}
						closedir($handle);
					}
					/*
						ok, now that everything that should be deleted
						is deleted, let's re-write our timestamp object
						*/
					Filesystem::makeFile(SA_DIR_TEMP."/cache.marker.tmp", "");
				}
			}
		}
		protected function outputCached () {
			$this->createheaders($this->flag_filename_ext, filesize($this->image_temp_uri));
			readfile($this->image_temp_uri);
			exit();
		}
		protected function outputOriginal () {
			if ( !file_exists($this->image_temp_uri) ) {
				copy($this->image_original_uri, $this->image_temp_uri);
			}
			$format = strtolower(substr($this->image_original_uri, strrpos($this->image_original_uri, ".")+1));
			$this->createheaders($format, filesize($this->image_original_uri));
			readfile($this->image_original_uri);
			exit();
		}
		protected function outputNewImage () {
			/*
				make sure the orginal file exists
				*/
			if ( !file_exists($this->watermark_uri) && $this->flag_watermark ) {
				$this->flag_watermark = false;
				//$this->update(); ??
			}
			/*
				if it's a zip file, extract it
				*/
			if ( $this->flag_is_zip ) {
				$zip_archive = new PclZip($this->zip_archive_uri);
				$extraction = $zip_archive->extract(
					PCLZIP_OPT_BY_INDEX, $this->flag_filename,
					PCLZIP_OPT_PATH, SA_DIR_TEMP,
					PCLZIP_CB_PRE_EXTRACT, 'Graphic_PCLZIP_CB_PRE_EXTRACT',
					PCLZIP_OPT_REMOVE_ALL_PATH);
				$this->image_original_uri = $extraction[0]["filename"];
			}
			/*
				ok, if we're here, it's time to get down too
				business.  we're gonna resample and crop the image
				as quickly as possible.
				here's all the orginal settings
				*/
			list($final_width, $final_height, $original_width, $original_height, $resample) = $this->dimensions();
			/*
				just return the orginal
				unless it needs a watermark
				*/
			if ( $resample==false ) {
				if ( !$this->flag_is_zip && !$this->flag_watermark && !$this->flag_crosshairs ) {
					$this->outputOriginal();
				}
			}
			/*
						looks like there was no easy way out.
						we're gonna have to resample.  let's get to it.
						*/
			if ( $resample==true ) {
				$original_aspect_ratio = $original_width / $original_height;
				$final_aspect_ratio = $final_width/$final_height;
				$delta = $original_aspect_ratio-$final_aspect_ratio;
				/*
					find the sample size based on it's geometry
					*/
				if ( $delta<0 ) { // tall
					$sample_width = $original_width;
					$sample_height = ($sample_width*$final_height)/$final_width;
					$sample_height = round($sample_height);
				} else { // wide
					$sample_height = $original_height;
					$sample_width = ($sample_height*$final_width)/$final_height;
					$sample_width = round($sample_width);
				}
				/*
					find the center of the crop
					(if there is a crop)
					*/
				$sample_x = round(($original_width-$sample_width)*($this->flag_thumbnail_x/100));
				$sample_y = round(($original_height-$sample_height)*($this->flag_thumbnail_y/100));
			} 
			/*
				where the magic happens
				*/
			if ( $this->flag_imagick ) { // Image Magick
				$img_final = new Imagick();
				$img_final->readImage($this->image_original_uri);
				$img_final->stripImage();
				$img_final->setImageFormat($this->flag_filename_ext);
				if ( $this->flag_filename_ext=="jpg" || $this->flag_filename_ext=="jpeg" ) {
					$img_final->setImageCompression(8);
					$img_final->setImageCompressionQuality($this->flag_quality);
				}
				if ( $resample==true ) {
					$img_final->cropImage($sample_width, $sample_height, $sample_x, $sample_y);
					$img_final->resizeImage($final_width, $final_height, 13, 1);
					/* if we're gonna sharpen, do it now
						*/
					if ( $this->flag_sharpen ) {
						$img_final->convolveImage(array(-1, -1, -1, -1, 20, -1, -1, -1, -1));
					}
				}
				/* if we're gonna draw some lines, do it now
					*/
				if ( $this->flag_crosshairs ) {
					$crosshairs_alpha_rgb = Func::html2rgb($this->flag_crosshairs_color);
					$pixel = new ImagickPixel();
					$pixel->setColor("rgb(".implode(",", $crosshairs_alpha_rgb).")");
					$draw = new ImagickDraw();
					$draw->setFillColor($pixel);
					$draw->setFillOpacity($this->flag_crosshairs_alpha/100);
					$draw->line(0, 0, $final_width, $final_height);
					$draw->line($final_width, 0, 0, $final_height);
					$img_final->drawImage($draw);
				}
				/* if we're gonna watermark, do it now
					*/
				if ( $this->flag_watermark ) {
					$img_watermark = new Imagick();
					$img_watermark->readImage($this->watermark_uri);
					$watermark_width = $img_watermark->getImageWidth();
					$watermark_height = $img_watermark->getImageHeight();
					if ( $this->flag_multiplier!=1 ) {
						$watermark_width *= $this->flag_multiplier;
						$watermark_height *= $this->flag_multiplier;
						$img_watermark->scaleImage($watermark_width, $watermark_height);
					}
					$img_final->compositeImage($img_watermark, 40, 
						($final_width-$watermark_width)*($this->flag_watermark_x/100), 
						($final_height-$watermark_height)*($this->flag_watermark_y/100)
					);
				}
			} else { // GD
				$img_original = imagecreatefromstring(file_get_contents($this->image_original_uri));
				if ( $resample==true ) {
					/*
						create a white blank canvass for our resampler
						if it's a png, make sure it keeps it's transparency
						*/
					$original_format = strtolower(substr($this->image_original_uri, strrpos($this->image_original_uri, ".")+1));
					$img_final = imagecreatetruecolor($final_width, $final_height);
					$white = imagecolorallocate($img_final, 255, 255, 255);
					if ( $this->flag_filename_ext=="png" ) {
						$white = imagecolorallocatealpha($img_final, 255, 255, 255, 127);
						imagealphablending($img_final, true);
					}
					imagefill($img_final, 0, 0, $white);
					/* ok, this is it.  resample it
						*/
					imagecopyresampled($img_final, $img_original, 0, 0, $sample_x, $sample_y, $final_width, $final_height, $sample_width, $sample_height);
					imagedestroy($img_original);
					if ( $original_format=="png" && $this->flag_filename_ext=="png" ) {
						imagealphablending($img_final, false);
						imagesavealpha($img_final, true);
					}
					/* if we're gonna sharpen, do it now
						*/
					if ( $this->flag_sharpen ) {
						$sharpen = array(
							array(-1, -1, -1),
							array(-1, 20, -1),
							array(-1, -1, -1)
						);
						$divisor = array_sum(array_map('array_sum', $sharpen));
						imageconvolution($img_final, $sharpen, $divisor, 0);
					}
				} else {
					/* if we're not resampling, let's just finish up with the original
						*/
					$img_final = $img_original;
					$final_width = $original_width;
					$final_height = $original_height;
				}
				/* if we're gonna draw some lines, do it now
					*/
				if ( $this->flag_crosshairs ) {
					$crosshairs_alpha_rgb = Func::html2rgb($this->flag_crosshairs_color);
					Func::imageSmoothAlphaLine($img_final, 
						0, 0, $final_width, $final_height, 
						$crosshairs_alpha_rgb[0], $crosshairs_alpha_rgb[1], $crosshairs_alpha_rgb[2], 
						127-($this->flag_crosshairs_alpha*(127/100))
					);
					Func::imageSmoothAlphaLine($img_final, 
						$final_width, 0, 0, $final_height, 
						$crosshairs_alpha_rgb[0], $crosshairs_alpha_rgb[1], $crosshairs_alpha_rgb[2], 
						127-($this->flag_crosshairs_alpha*(127/100))
					);
				}
				/* if we're gonna watermark, do it now
					*/
				if ( $this->flag_watermark ) {
					$watermark_format = strtolower(substr(strrchr($this->watermark_uri, "."), 1));
					$img_watermark = imagecreatefromstring(@file_get_contents($this->watermark_uri));
					$watermark_width = imagesx($img_watermark);
					$watermark_height = imagesy($img_watermark);
					if ( $this->flag_multiplier!=1 ) {
						$img_watermark_final = imagecreatetruecolor($watermark_width*$this->flag_multiplier, $watermark_height*$this->flag_multiplier);
						imagealphablending($img_watermark_final, false);
						imagesavealpha($img_watermark_final, true);
						imagecopyresampled($img_watermark_final, $img_watermark, 0, 0, 0, 0, $watermark_width*$this->flag_multiplier, $watermark_height*$this->flag_multiplier, $watermark_width, $watermark_height);
						$watermark_width = imagesx($img_watermark_final);
						$watermark_height = imagesy($img_watermark_final);
						$img_watermark = $img_watermark_final;
					}
					Func::imagecopymerge_alpha($img_final, $img_watermark, 
						($final_width-$watermark_width)*($this->flag_watermark_x/100), 
						($final_height-$watermark_height)*($this->flag_watermark_y/100), 
						0, 0, $watermark_width, $watermark_height, 
						$this->flag_watermark_alpha);
					imagedestroy($img_watermark);
				}
				if ( $this->flag_filename_ext=="png" ) {
					imagesavealpha($img_final, true);
				}
			}
			/*
				if the cache flag is set, let's save it to the
				cache directory
				*/
			if ( $this->cached ) {
				/*
					ok, let's write our new cached file
					*/
				if ( $this->flag_imagick ) {
					$img_final->writeImage($this->image_temp_uri);
				} else {
					
					switch( $this->flag_filename_ext ) {
						case 'gif' :
							@imagegif($img_final, $this->image_temp_uri);
							break;
						case 'png' :
							@imagepng($img_final, $this->image_temp_uri);
							break;
						case 'jpg' :
						case 'jpeg' :
							@imagejpeg($img_final, $this->image_temp_uri, $this->flag_quality);
							break;
					}
				}
			}
			/* delete our temp image if we pulled it out from a zip
				*/
			if ( $this->flag_is_zip ) {
				@unlink($this->image_original_uri);
			}
			/*
				and finally, let's send it out!
				notic that since we have yet to make the file, we can't
				output the size to the header, just let it buffer naturally
				*/
			if ( $this->flag_imagick ) {
				$this->createheaders($this->flag_filename_ext, 0, $this->cached);
				print $img_final->getImageBlob();
				$img_final->clear();
				$img_final->destroy();
				exit();
			} else {
				$this->createheaders($this->flag_filename_ext, 0, $this->cached);
				switch( $this->flag_filename_ext ) {
					case 'gif' :
						imagegif($img_final);
						break;
					case 'png' :
						imagepng($img_final);
						break;
					case 'jpg' :
					case 'jpeg' :
						imagejpeg($img_final, NULL, $this->flag_quality);
						break;
				}
				imagedestroy($img_final);
				exit();
			}
		}
		
		protected function createheaders ($extension, $size=0, $cached=true) {
			/*
				we're gonna set a time in the future
				to make sure the browser caches it
				*/
			if ($cached==true) {
				// seconds, minutes, hours, days
				$expires = 60*60*24*14;
				header("Pragma: public");
				header("Cache-Control: maxage=".$expires);
				header('Expires: ' . gmdate('D, d M Y H:i:s', time()+$expires) . ' GMT');
			} else {
				header("Expires: Tue, 03 Jul 2001 06:00:00 GMT");
				header("Last-Modified: " . gmdate("D, d M Y H:i:s") . " GMT");
				header("Cache-Control: post-check=0, pre-check=0", false);
				if (Func::isIESSL()==false) {
					header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
					header("Pragma: no-cache");
				}
			}
			/*
				output the right header for the right
				filetype
				*/
			switch($extension) {
				case 'gif' :
					header("Content-type: image/gif");
					break;
				case 'png' :
					header("Content-type: image/png");
					break;
				case 'jpg' :
				case 'jpeg' :
					header("Content-type: image/jpeg");
					break;
			}
			/*
				send the size as well for good measure
				*/
			if ($size>0) header('Content-Length: '. $size);
		}

		protected function String2Hex($string){
			$hex='';
			for ($i=0; $i < strlen($string); $i++){
				$hex .= dechex(ord($string[$i]));
			}
			return $hex;
		}
		
		protected function getxhtml ($useSrcSet=false) {
			if ( $this->flag_filename=="" ) {
				return "";
			}
			$img_src = $this->source();
			$img_title = $this->title;
			$img_alt = $this->description;
			list($img_width, $img_height) = $this->dimensions();
			$result = "";
			$result .= '<div class="' . $this->classname . ' ' . strtoupper($this->flag_filename_ext) . '">';
			if ( $this->isVideo() ) {
				$result .= '<video id="video-js-' . md5($this->flag_filename) . '" class="video-js vjs-default-skin" width="' . $img_width . '" height="' . $img_height . '" controls preload="auto" poster="' . $img_src . '" data-setup="{}">';
				$result .= '<source src="' . SA_DIR_STORAGE . "/" . $this->flag_basename . "/" . $this->flag_filename . '" type="video/mp4">';
				$result .= '</video>';
				if ($this->use_caption) {
					$result .= '<div class="Caption">';
					$result .= '<div class="CaptionInner">';
					$result .= '<h3 title="' . $img_title . '">' . $img_title . '</h3>';
					if (strlen($img_alt)>0) $result .= '<div class="Description">' . $img_alt . '</div>';
					$result .= '</div>';
					$result .= '</div>';
				}
			} else {
				$a_href = $this->href;
				$a_target = $this->target;
				if ( $a_href!="" ) {
					$result .= '<a href="' . $a_href . '" target="' . $a_target . '">';
				}
				if ( $useSrcSet ) {
					$result .= '<img src="' . $this->sourceBlank() . '" data-src="' . $this->source() . '" data-srcset="' . $this->sourceSet() . '" width="' . $img_width . '" height="' . $img_height . '" ';
				} else {
					$result .= '<img src="' . $img_src . '" width="' . $img_width . '" height="' . $img_height . '" ';
				}
				if ($this->use_caption) {
					$result .= 'alt="" />';
					$result .= '<div class="Caption">';
					$result .= '<div class="CaptionInner">';
					$result .= '<h3 title="' . $img_title . '">' . $img_title . '</h3>';
					if (strlen($img_alt)>0) $result .= '<div class="Description">' . " - " . $img_alt . '</div>';
					$result .= '</div>';
					$result .= '</div>';
				} else {
					$result .= 'title="' . $img_title . '" alt="' . $img_alt . '" />';
				}
				if ( $a_href!="" ) {
					$result .= '</a>';
				}
			}
			$result .= '</div>';
			/* return it
				*/
			return $result;
		}

	}

?>