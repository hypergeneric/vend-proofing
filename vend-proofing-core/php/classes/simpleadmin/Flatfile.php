<?php

	class Flatfile {

		/* ---- Public Methods ---- */

		public static function createUID () {
			$indexfile = SA_DIR_STORAGE . "/suid.index";
			/* get the current index
				assume 0, but if the index file exists, use that
				*/
			$current = file_exists($indexfile) ? trim(file_get_contents($indexfile)) : rand(10000, 50000);
			/* add one
				*/
			$current += 1;
			/* get the id
				*/
			$suid = dechex($current);
			/* resave the file
				*/
			Filesystem::makeFile($indexfile, $current);
			/* return the suid
				*/
			return $suid;
		}

		/* ---- File Upload Table Functions ---- */

		public static function checkFileSaftey ($filename) {
			$filename = strtolower($filename);
			$extension = substr(strrchr($filename, '.'), 1);
			$allowed = array("woff", "ttf", "otf", "mview", "txt","csv","htm","html","xml","css","js","doc","xls","rtf","ppt","pdf","zip","swf","flv","mp4","mp3","avi","wmv","mov","jpg","jpeg","gif","png","ico","webm","ogv");
			if (strpos($filename, ".")===false) return false;
			return in_array($extension, $allowed);
		}

		public static function checkFileSize ($fileobject) {
			$imagesize = getimagesize($fileobject["file"]["tmp"]);
			if ($imagesize) {
				$width = $imagesize[0];
				$height = $imagesize[1];
				if ( $width>3000 || $height>1600 ) {
					return false;
				}
				$fileobject["dimensions"] = $width . "x" . $height;
			}
			$filesize = @filesize($fileobject["file"]["tmp"]);
			$imagetypes = array("jpg","jpeg","gif","png");
			if ($filesize && in_array($fileobject["file"]["ext"], $imagetypes)) {
				if ( $filesize>2621440 ) {
					return false;
				}
				$fileobject["size"] = $filesize;
			}
			return $fileobject;
		}

		public static function getFileAttributes ($fileobject) {
			if (!class_exists("getID3")) return $fileobject;
			$getID3 = new getID3;
			$fileinfo = $getID3->analyze($fileobject["file"]["path"]);
			/* if it's a simple image, just use that
				otherwise, use getid3 for the size info
				*/
			if (!isset($fileobject["dimensions"])) {
				$width = @$fileinfo["video"]["resolution_x"];
				$height = @$fileinfo["video"]["resolution_y"];
				if ($fileobject["file"]["ext"]=="flv") {
					$width = @$fileinfo["meta"]["onMetaData"]["width"];
					$height = @$fileinfo["meta"]["onMetaData"]["height"];
				}
				$fileobject["dimensions"] = $width . "x" . $height;
			}
			if (!isset($fileobject["size"])) {
				$fileobject["size"] = @filesize($fileobject["file"]["path"]);
			}
			$fileobject["duration"] = @$fileinfo['playtime_seconds'];
			return $fileobject;
		}
		
		public static function addSnapshot ($type, $folder=null, $filename=null, $data="") {
			if (SA_DEMOMODE) return -100;
			/* do some error checking
				*/
			if ($filename==null) {
				return -200; // filename required
			}
			if ($data=="") {
				return -300; // data required
			}
			$data = str_replace(' ', '+', $data);
			$data = substr($data, strpos($data, ",")+1);
			$data = base64_decode($data);
			/* get the path to the storage location
				*/
			if ($folder==null) $folder = $type;
			$directory = SA_DIR_STORAGE . "/$folder";
			$tablepath = SA_DIR_STORAGE . "/$folder/$type.table";
			/* make sure the folder exists
				*/
			Filesystem::makeFolder($directory);
			/* create the fileobject
				*/
			$filename = $filename . ".snapshot.jpg";
			$filename = explode(".", $filename);
			$fileext = strtolower(array_pop($filename));
			$filename = implode(".", $filename);
			$filehash = $filename;
			$fileobject = array(
				"file" => array (
					"name" => $filename,
					"ext" => $fileext,
					"final" => $filehash . "." . $fileext,
					"path" => $directory . "/" . $filehash . "." . $fileext
				)
			);
			/* save the data to a file
				*/
			Filesystem::makeFile($fileobject["file"]["path"], $data);
			/* success
				*/
			return 100;
		}

		public static function addFileUrl ($type, $folder=null, $uri, $filename=null) {
			if (SA_DEMOMODE) return -100;
			/* get the path to the storage location
				*/
			if ($folder==null) $folder = $type;
			$directory = SA_DIR_STORAGE . "/$folder";
			$tablepath = SA_DIR_STORAGE . "/$folder/$type.table";
			/* start up the sideloader
				*/
			$proxy = new SideLoad;
			$proxy->metaOnly(true);
			$proxy->setURL($uri);
			/* check to see if it's valid
				*/
			$service = $proxy->getService();
			$services = array("vimeo", "youtube", "sketchfab");
			if (!in_array($service, $services)) {
				return -300;  // Cannot Copy Local File
			}
			/* make sure the folder exists
				*/
			Filesystem::makeFolder($directory);
			/* create a array to stuff our info into
				*/
			if ($filename==null) {
				$filename = $proxy->getBasename();
			}
			$fileext = $proxy->getExtension();
			$filehash = md5($filename) . "-" . Flatfile::createUID();
			$fileobject = array(
				"file" => array (
					"name" => $filename,
					"basename" => $filename,
					"ext" => $fileext,
					"hash" => $filehash,
					"final" => $filehash . "." . $fileext,
					"path" => $directory . "/" . $filehash . "." . $fileext
				)
			);
			/* check for errors
				*/
			if (!$proxy->downloadTo($fileobject["file"]["path"])) {
				return -200;  // Cannot Copy Local File
			}
			/* get the attributes
				*/
			$fileobject = Flatfile::getFileAttributes($fileobject);
			/* save it to the table
				*/
			return array($fileobject["file"]["final"], $fileobject["file"]["name"], $fileobject["dimensions"], 0, 0, "", $proxy->getURL(), $service);
		}
		
		public static function sideloadFile ($type, $folder=null, $uri, $filename=null) {
			if (SA_DEMOMODE) return -100;
			/* get the path to the storage location
				*/
			if ($folder==null) $folder = $type;
			$directory = SA_DIR_STORAGE . "/$folder";
			$tablepath = SA_DIR_STORAGE . "/$folder/$type.table";
			/* start up the sideloader
				*/
			if (!class_exists("SideLoad")) return -400;
			$proxy = new SideLoad;
			$proxy->setURL($uri);
			/* check to see if it's a safe file
				*/
			if (!Flatfile::checkFileSaftey($proxy->getFilename())) {
				return -500;  // Invalid File Type
			}
			/* make sure the folder exists
				*/
			Filesystem::makeFolder($directory);
			/* create a array to stuff our info into
				*/
			if ($filename==null) {
				$filename = $proxy->getBasename();
			}
			$fileext = $proxy->getExtension();
			$filehash = Func::homogenize($filename) . "-" . Flatfile::createUID();
			$fileobject = array(
				"file" => array (
					"name" => $filename,
					"basename" => $filename,
					"ext" => $fileext,
					"hash" => $filehash,
					"final" => $filehash . "." . $fileext,
					"path" => $directory . "/" . $filehash . "." . $fileext
				)
			);
			/* check for errors
				*/
			if ($proxy->isLocal()) {
				if (!$proxy->copyTo($fileobject["file"]["path"])) {
					return -200;  // Cannot Copy Local File
				}
			} else {
				if (!$proxy->downloadTo($fileobject["file"]["path"])) {
					return -200;  // Cannot Copy Local File
				}
			}
			/* get the attributes
				*/
			$fileobject = Flatfile::getFileAttributes($fileobject);
			/* save it to the table
				*/
			return array($fileobject["file"]["final"], $fileobject["file"]["name"], $fileobject["dimensions"], $fileobject["duration"], $fileobject["size"], "");
		}

		public static function uploadFile ($type, $folder=null, $snapshot="false", $snapshot_id=null) {
			if (SA_DEMOMODE) return -100;
			/* get the path to the storage location
				*/
			if ($folder==null) $folder = $type;
			$directory = SA_DIR_STORAGE . "/$folder";
			$tablepath = SA_DIR_STORAGE . "/$folder/$type.table";
			/* check to see if it's a safe file
				*/
			if (!Flatfile::checkFileSaftey($_FILES['Filedata']['name'])) {
				return -500;  // Invalid File Type
			}
			/* make sure the folder exists
				*/
			Filesystem::makeFolder($directory);
			/* create a array to stuff our info into
				*/
			$filename = $_FILES['Filedata']['name'];
			$filename = explode(".", $filename);
			$fileext = strtolower(array_pop($filename));
			$filename = implode(".", $filename);
			$filehash = Func::homogenize($filename) . "-" . Flatfile::createUID();
			if ($snapshot=="true") {
				$filename = $snapshot_id . ".snapshot.jpg";
				$filename = explode(".", $filename);
				$fileext = strtolower(array_pop($filename));
				$filename = implode(".", $filename);
				$filehash = $filename;
			}
			$fileobject = array(
				"file" => array (
					"tmp" => $_FILES['Filedata']['tmp_name'],
					"name" => $_FILES['Filedata']['name'],
					"basename" => $filename,
					"ext" => $fileext,
					"hash" => $filehash,
					"final" => $filehash . "." . $fileext,
					"path" => $directory . "/" . $filehash . "." . $fileext
				)
			);
			/* check for file size issues
				*/
			$fileobject = Flatfile::checkFileSize($fileobject);
			if ($fileobject==false) {
				return -600;  // Image Too Large
			}
			/* check for errors
				*/
			if (!Filesystem::moveUploadedFile($_FILES['Filedata']['tmp_name'], $fileobject["file"]["path"])) {
				return -100;  // Cannot Import Uploaded File
			}
			/* get the attributes
				*/
			$fileobject = Flatfile::getFileAttributes($fileobject);
			/* save it to the table
				*/
			return array($fileobject["file"]["final"], $fileobject["file"]["name"], $fileobject["dimensions"], $fileobject["duration"], $fileobject["size"], "");
		}

		public static function saveFile ($row, $type, $folder=null) {
			/* get the path to the storage location
				*/
			if ($folder==null) $folder = $type;
			$tablepath = SA_DIR_STORAGE . "/$folder/$type.table";
			/* spit it out
				*/
			return Flatfile::updateTableRow($tablepath, $row);
		}

		public static function deleteFileTable ($type, $folder=null, $files) {
			/* get the path to the storage location
				*/
			if ($folder==null) $folder = $type;
			$directory = SA_DIR_STORAGE . "/$folder";
			$tablepath = SA_DIR_STORAGE . "/$folder/$type.table";
			/* loop through all the files and delete them
				*/
			for ($i=0; $i<count($files); ++$i) {
				$file = $files[$i];
				Filesystem::deleteFile("$directory/$file");
				Filesystem::deleteFile("$directory/$file.snapshot.jpg");
			}
			/* spit it out
				*/
			return Flatfile::deleteTableRow($tablepath, $files);
		}

		public static function listFileTable ($type, $folder=null) {
			/* get the path to the storage location
				*/
			if ($folder==null) $folder = $type;
			$tablepath = SA_DIR_STORAGE . "/$folder/$type.table";
			/* spit it out
				*/
			return Flatfile::getTableString($tablepath);
		}

		public static function getFileTable ($type, $folder=null) {
			/* get the path to the storage location
				*/
			if ($folder==null) $folder = $type;
			$tablepath = SA_DIR_STORAGE . "/$folder/$type.table";
			/* spit it out
				*/
			return Flatfile::getTableArray($tablepath);
		}

		public static function sortFileTable ($type, $folder=null, $to, $from) {
			/* get the path to the storage location
				*/
			if ($folder==null) $folder = $type;
			$tablepath = SA_DIR_STORAGE . "/$folder/$type.table";
			/* spit it out
				*/
			return Flatfile::reIndexRow($tablepath, $to, $from);
		}

		public static function updateFileTable ($type, $folder=null, $data) {
			/* delete any files and folders asscocated with the parent id
				*/
			if ($folder==null) $folder = $type;
			$tablepath = SA_DIR_STORAGE . "/$folder/$type.table";
			return Flatfile::updateTableRow($tablepath, $data);
		}

		public static function saveFileTable ($table, $type, $folder=null) {
			/* delete any files and folders asscocated with the parent id
				*/
			if ($folder==null) $folder = $type;
			$path = SA_DIR_STORAGE . "/$folder/$type.table";
			return Flatfile::saveTableArray($path, $table);
		}

		/* ---- Table Functions ---- */

		public static function getSetTableObject ($name, $id, $pid=null) {
			$path = Flatfile::getTablePath($name, $pid);
			$table = Flatfile::getTableArray($path);
			/* spit it out
				*/
			return $table[$id];
		}

		public static function getSetTable ($name, $pid=null) {
			$path = Flatfile::getTablePath($name, $pid);
			/* spit it out
				*/
			return Flatfile::getTableArray($path);
		}

		public static function listSetTable ($name, $pid=null) {
			$path = Flatfile::getTablePath($name, $pid);
			/* spit it out
				*/
			return Flatfile::getTableString($path);
		}

		public static function deleteSetTable ($name, $id=null, $pid=null) {
			/* delete any files and folders asscocated with the parent id
				*/
			$path = Flatfile::getTablePath($name, $pid);
			if (strlen($id)==0) return Flatfile::getTableArray($path); // must be some kind of mistake
			$setpath = SA_DIR_STORAGE . "/$id";
			if (file_exists($setpath)) {
				Filesystem::purgeFolder($setpath);
				Filesystem::deleteFolder($setpath);
			}
			return Flatfile::deleteTableRow($path, $id);
		}

		public static function sortSetTable ($name, $to, $from, $pid=null) {
			$path = Flatfile::getTablePath($name, $pid);
			/* spit it out
				*/
			return Flatfile::reIndexRow($path, $to, $from);
		}

		public static function updateSetTable ($name, $data, $pid=null) {
			/* delete any files and folders asscocated with the parent id
				*/
			$path = Flatfile::getTablePath($name, $pid);
			return Flatfile::updateTableRow($path, $data);
		}

		public static function saveSetTable ($table, $name, $pid=null) {
			/* delete any files and folders asscocated with the parent id
				*/
			$path = Flatfile::getTablePath($name, $pid);
			return Flatfile::saveTableArray($path, $table);
		}

		/* ---- Low Level Table Functions ---- */

		public static function getTablePath ($name, $pid=null) {
			$tablepath = SA_DIR_STORAGE . "/set.$name.table";
			if ($pid!=null) {
				$tablepath = SA_DIR_STORAGE . "/$pid/set.$name.table";
			}
			return $tablepath;
		}

		public static function getTableArray ($path) {
			/* load up the table file and parse it
				we're gonna create a 2-dimensional array to keep all our data in
				and it should mimic exactly what's in the file
				*/
			$lookup = array();
			$lines = Filesystem::getFileArray($path);
			$count = count($lines);
			for ($i=0; $i<$count; ++$i) {
				$line = trim($lines[$i], "\n");
				$emptycheck = trim($line);
				/* skip anything that is empty
					*/
				if (strlen($emptycheck)==0) continue;
				/* basically, add anything that dosent match our target key value
					*/
				$row = explode("\t", $line);
				$key = $row[0];
				$lookup[$key] = $row;
			}
			/* spit it out
				*/
			return $lookup;
		}

		public static function createTableString($path, $rows) {
			if (SA_DEMOMODE) return Flatfile::getTableString($path);
			/* generate a table string, and save it
				*/
			$output = array();
			foreach ($rows as $row) $output[] = implode("\t", $row);
			$output = implode("\n", $output);
			Filesystem::makeFile($path, $output);
			return $output;
		}

		public static function getTableString ($path) {
			/* spit it out
				*/
			return @file_get_contents($path);
		}

		public static function saveTableArray($path, $table) {
			/* create table string
				*/
			return Flatfile::createTableString($path, $table);
		}

		public static function updateTableRow($table, $row_data, $key_index=0, $auto_sort=false) {
			/* load up the table file and parse it
				we're gonna create a 2-dimensional array to keep all our data in
				and it should mimic exactly what's in the file
				*/
			$lookup = Flatfile::getTableArray($table);
			if (SA_DEMOMODE) return $lookup;
			/* grab the live key from our current row
				*/
			$key = $row_data[$key_index];
			/* if a key value is set in the row data
				and there are null items in there too, we must be
				updating an existing entry.
				so, only update anything that isn't null
				*/
			$row = array();
			$count = count($row_data);
			if (isset($lookup[$key])) { // check for any length discrepancies, always default to a longer array
				$count = max($count, count($lookup[$key]));
			}
			for ($i=0; $i<$count; ++$i) {
				$value = ""; // default to empty string
				if (isset($row_data[$i])) { // see if the data is in the incoming array -- any empty values should be null or inexistent
					$value = $row_data[$i];
				} else { // ok no incoing data, check the existing array
					if (isset($lookup[$key])) {
						if (isset($lookup[$key][$i])) {
							$value = $lookup[$key][$i];
						}
					}
				}
				$row[] = $value;
			}
			$lookup[$key] = $row;
			/* auto sort if necessary
				*/
			if ($auto_sort) ksort($lookup);
			/* return the lookup table
				*/
			return $lookup;
		}

		public static function deleteTableRow($table, $key_values, $index=0, $auto_sort=false) {
			/* load up the table file and parse it
				we're gonna create a 2-dimensional array to keep all our data in
				and it should mimic exactly what's in the file
				*/
			$lookup = Flatfile::getTableArray($table);
			if (SA_DEMOMODE) return $lookup;
			if (is_array($key_values)) {
				for ($i=0; $i<count($key_values); ++$i) {
					unset($lookup[$key_values[$i]]);
				}
			} else {
				unset($lookup[$key_values]);
			}
			/* auto sort if necessary
				*/
			if ($auto_sort) ksort($lookup);
			/* return the lookup table
				*/
			return $lookup;
		}

		public static function reIndexRow($table, $oIndex, $nIndex) {
			if (SA_DEMOMODE) return Flatfile::getTableString($table);
			/* load up the table file and parse it
				we're gonna create a 2-dimensional array to keep all our data in
				and it should mimic exactly what's in the file
				*/
			$lookup = array();
			$lines = Filesystem::getFileArray($table);
			$count = count($lines);
			for ($i=0; $i<$count; ++$i) {
				$line = $lines[$i];
				$emptycheck = trim($line);
				/* skip anything that is empty
					*/
				if (strlen($emptycheck)==0) continue;
				/* append to our lookup
					*/
				$lookup[] = trim($line, "\n");
			}
			/* do the old swaperoo
				*/
			if (is_array($oIndex)&&is_array($nIndex)) {
				$lookup2 = array();
				for ($i=0; $i<count($oIndex); ++$i) {
					$lookup2[$nIndex[$i]] = $lookup[$oIndex[$i]];
				}
				ksort($lookup2);
				$lookup = $lookup2;
			} else {
				$out = array_splice($lookup, $oIndex, 1);
				array_splice($lookup, $nIndex, 0, $out);
				/*$oData = $lookup[$oIndex];
				$lookup[$oIndex] = $lookup[$nIndex];
				$lookup[$nIndex] = $oData;*/
			}
			/* generate a table string, and save it
				*/
			$output = implode("\n", $lookup);
			Filesystem::makeFile($table, $output);
			return $output;
		}

		/* ---- XML File System ---- */

		public static function getTrueXmlPath ($type, $suid=null) {
			/* the default
				*/
			$default = SA_DIR_DEFAULTS . "/$type.xml";
			/* pull in the right xml doc, depending if we're looking in a set
				or if we're pulling a global setup file
				*/
			$path = SA_DIR_STORAGE . "/$type.xml";
			if ($suid!=null) $path = SA_DIR_STORAGE . "/$suid/$type.xml";
			/* load the file in as a string
				*/
			return file_exists($path) ? $path : $default;
		}

		public static function createXmlString ($type, $suid=null, $data="") {
			/* pull in the right xml doc, depending if we're looking in a set
				or if we're pulling a global setup file
				*/
			$path = SA_DIR_STORAGE . "/$type.xml";
			if ($suid!=null) $path = SA_DIR_STORAGE . "/$suid/$type.xml";
			return Filesystem::makeFile($path, $data);
		}

		public static function revertXmlString ($type, $suid=null) {
			$path = Flatfile::getTrueXmlPath($type, $suid);
			return Filesystem::deleteFile($path);
		}

		public static function getXmlDefaults ($type) {
			$default = SA_DIR_DEFAULTS . "/$type.xml";
			return @file_get_contents($default);
		}
		
		public static function getXmlString ($type, $suid=null, $required=false) {
			$default = SA_DIR_DEFAULTS . "/$type.xml";
			$path = Flatfile::getTrueXmlPath($type, $suid);
			if ($path==$default&&$required==true) return "";
			return @file_get_contents($path);
		}

		public static function getXmlArray ($type, $suid=null, $required=false) {
			$default = SA_DIR_DEFAULTS . "/$type.xml";
			$path = Flatfile::getTrueXmlPath($type, $suid);
			if ($path==$default&&$required==true) return "";
			$xml_obj = new SimpleXML4();
			$xml_obj->load($path);
			return $xml_obj;
		}

	}

?>