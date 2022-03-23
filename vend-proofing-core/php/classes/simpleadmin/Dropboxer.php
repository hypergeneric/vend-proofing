<?php

	use Kunnu\Dropbox\Dropbox;
	use Kunnu\Dropbox\DropboxApp;

	class Dropboxer {
		
		/* ---- Public Properties ---- */
		
		public function authorize () {
			if ( strlen($this->dropbox_api_key)>0 && strlen($this->dropbox_api_secret)>0 ) {
				try {
					$app = new DropboxApp($this->dropbox_api_key, $this->dropbox_api_secret);
					$dropbox = new Dropbox($app);
					$authHelper = $dropbox->getAuthHelper();
					return array(true, $authHelper->getAuthUrl(), "");
				} catch( Exception $e ) { 
					return array(false, 'Dropbox Setup Failure', $e->getMessage());
				}
			} else {
				return array(false, 'Dropbox Setup Failure', "");
			}
		}
		
		public function connect () {
			if ( strlen($this->dropbox_api_key)>0 && strlen($this->dropbox_api_secret)>0 && strlen($this->dropbox_authorization_code)>0 ) { // only do this is if we have it setup
				try {
					if ( $this->dropbox_hash!=md5($this->dropbox_authorization_code) || strlen($this->dropbox_token)==0 ) { // ok, the auth code is new or changed, re-auth
						$app = new DropboxApp($this->dropbox_api_key, $this->dropbox_api_secret);
						$dropbox = new Dropbox($app);
						$authHelper = $dropbox->getAuthHelper();
						$accessToken = $authHelper->getAccessToken($this->dropbox_authorization_code);
						// we only want to do this once per change, so set the token to a hidden field in the xml and use the has to track it
						$this->dropbox_token = $accessToken->getToken();
						$this->setup->editNode("data.payment_gateway.dropbox_token", $this->dropbox_token, "hash=".md5($this->dropbox_authorization_code));
						$this->setup->save();
					}
					$app = new DropboxApp($this->dropbox_api_key, $this->dropbox_api_secret, $this->dropbox_token);	
					$dropbox = new Dropbox($app);
					$this->app = $app;
					$this->client = $dropbox;
					return array(true, $this->dropbox_token, "");
				} catch( Exception $e ) { // fail -- just print out the message from dropbox as-is
					return array(false, 'Dropbox Setup Failure', $e->getMessage());
				}
			} else {
				return array(false, 'Dropbox Setup Failure', "");
			}
		}
		
		public function syncFolder ($suid="") {
			if ($suid=="") {
				return array(false, 'No Set Id Provided', "");
			}
			// get our list of images recursively
			$imagelist = $this->parseFolderMeta("tree", "/$suid");
			if (count($imagelist)==0) {
				return array(false, "Files or Folders Do Not Exist", "");
			}
			// build our list of either flat images or foldered images
			$images = array();
			$categories = array();
			foreach ($imagelist as $path) {
				$filepath = str_replace("/$suid/", "", $path);
				$filepath = trim($filepath, "/");
				$filebits = explode("/", $filepath);
				$filename = array_pop($filebits);
				$extension = strtolower(substr($filename, strrpos($filename, '.')+1));
				if (in_array($extension, array("jpg", "jpeg", "png"))==false) continue;
				$folder = array_pop($filebits);
				$folderhash = md5($folder);
				if ($folder!=null) {
					if (isset($categories[$folderhash])==false) {
						$categories[$folderhash] = array();
						$categories[$folderhash]["images"] = array();
						$categories[$folderhash]["category"] = $folder;
					}
					$categories[$folderhash]["images"][] = $path;
				} else {
					$images[] = $path;
				}
			}
			// can't have both -- either images or folders of images
			if ( count($categories)>0 && count($images)>0 ) {
				return array(false, "Both Folders and Images In Same Set", "");
			}
			// generate the index table strings and keep running tallies
			$category_index = "";
			$category_total = 0;
			$image_index = "";
			$image_total = 0;
			if ( count($categories)>0 ) {
				foreach ($categories as $folderhash => $obj) {
					$image_count = count($obj["images"]);
					if ($image_count==0) continue;
					$image_total += $image_count;
					$category_total += 1;
					$category_index .= $folderhash . "\t" . $obj["category"] . "\t" . $image_count . "\n";
					foreach ($obj["images"] as $path) {
						$filename = basename($path);
						$filename = explode(".", $filename);
						$fileext = strtolower(array_pop($filename));
						$filename = implode(".", $filename);
						$filehash = Func::homogenize($filename) . "-" . Flatfile::createUID();
						$image_index .= $filehash . "." . $fileext . "\t" . $path . "\t0x0\t\t0\t\t" . $folderhash . "\t" . $path . "\n";
					}
				}
			} else {
				$image_total = count($images);
				foreach ($images as $path) {
					$filename = basename($path);
					$filename = explode(".", $filename);
					$fileext = strtolower(array_pop($filename));
					$filename = implode(".", $filename);
					$filehash = Func::homogenize($filename) . "-" . Flatfile::createUID();
					$image_index .= $filehash . "." . $fileext . "\t" . $path . "\t0x0\t\t0\t\t\t" . $path . "\n";
				}
			}
			// delete any existing files in the image table
			$existing = Flatfile::getFileTable("image", $suid);
			foreach ($existing as $filename => $object) {
				@unlink(SA_DIR_STORAGE."/$suid/$filename");
			}
			// rewrite the image and category tables
			$category_index = trim($category_index);
			$image_index = trim($image_index);
			if ( count($categories)>0 ) {
				Filesystem::makeFile(SA_DIR_STORAGE."/$suid/set.category.table", $category_index);
			}
			Filesystem::makeFile(SA_DIR_STORAGE."/$suid/image.table", $image_index);
			// update the page table with the image count
			$table = Flatfile::getSetTable("page");
			$table = Flatfile::updateSetTable("page", array($suid, null, null, $image_total));
			Flatfile::saveSetTable($table, "page");
			// delete the existing sessions and the session table
			$session = Flatfile::getSetTable("session", $suid);
			foreach ($session as $hash => $object) {
				@unlink(SA_DIR_STORAGE."/$suid/set.$hash.table");
			}
			@unlink(SA_DIR_STORAGE."/$suid/set.session.table");
			// complete
			return array(true, "", "");
		}
		
		public function processNextChunk ($suid) {
			if ($suid=="") {
				return array(false, 'No Set Id Provided', "");
			}
			try {
				$start = microtime(true);
				// pull up the image table
				$images = Flatfile::getFileTable("image", $suid);
				$complete = 0;
				foreach ($images as $filename => $object) {
					$filepath = SA_DIR_STORAGE."/$suid/$filename";
					if (file_exists($filepath)) {
						$complete += 1;
						continue;
					}
					$file = $this->client->getThumbnail($object[1], "huge", "jpeg");
					file_put_contents($filepath, $file->getContents());
					$imagesize = getimagesize($filepath);
					$image_width = $imagesize[0];
					$image_height = $imagesize[1];
					$filesize = filesize($filepath);
					$images[$filename][1] = basename($object[1]);
					$images[$filename][2] = $image_width . "x" . $image_height;
					$images[$filename][4] = $filesize;
					$complete += 1;
					// check the timer
					$current = microtime(true);
					$elapsed = $current - $start;
					if ($elapsed>=$this->max_time) break;
				}
				Flatfile::saveFileTable($images, "image", $suid);
				// complete
				return array(true, $complete / count($images), "");
			} catch( Exception $e ) {
				return array(false, 'Dropbox Setup Failure', $e->getMessage());
			}
		}
		
		public function getOrderInfo ($orderid) {
			if ($orderid=="") {
				return array(false, 'No Order Id Provided', "");
			}
			$data = $this->getOrderFlags($orderid);
			return array(true, explode("\n", $data), "");
		}
		
		public function getImageData ($orderid) {
			// load session vars
			$order_object = $_SESSION["order_object"];
			$sessionobj = $_SESSION["session_object"];
			// we are going to create a local temp file to keep track of order images that have been transferred
			$imagelist_path = SA_DIR_TEMP."/".md5("dropboxlist".$orderid).".txt";
			$imagelist_data = "";
			// get the local set file list
			$setid = $order_object[1];
			$local_image_list = Flatfile::getFileTable("image", $setid);
			// get the remote file list
			$filedata = $this->parseFolderMeta("flat", "/$setid");
			// there is 1gb zip folde limit to dropbox
			$chunk_downloads = false;
			$maxsize = 1000000000;
			$totalsize = 0;
			foreach ($sessionobj as $hash => $sessionitem) {
				if (substr($hash, -2)=="-f") continue; // filter out any favorites
				if (substr($hash, -2)=="-p") continue; // filter out any packages
				if (substr($hash, -2)=="-d") { // download
					$local_image_hash = $sessionitem[2];
					$quality = $sessionitem[5]; // high/low
					if (!isset($local_image_list[$local_image_hash])) {
						continue;
					} 
					$local_image_data = $local_image_list[$local_image_hash];
					$local_image_size = $local_image_data[4];
					$remote_image_path = $local_image_data[7];
					// remote file does not exist, skip
					if (!isset($filedata[md5($remote_image_path)])) {
						continue;
					}
					// ok, we're in biz
					$remote_image_data = $filedata[md5($remote_image_path)];
					$remote_image_size = $remote_image_data->getSize();	
					// size it up
					$totalsize += $quality=="low" ? $local_image_size : $remote_image_size;
				}
			}
			$chunk_downloads = $totalsize > $maxsize;
			$chunk_num = 0;
			$chunk_total = 0;
			foreach ($sessionobj as $hash => $sessionitem) {
				if (substr($hash, -2)=="-f") continue; // filter out any favorites
				if (substr($hash, -2)=="-p") continue; // filter out any packages
				if (substr($hash, -2)=="-d") { // download
					// local set image does not exist
					$local_image_hash = $sessionitem[2];
					$quality = $sessionitem[5]; // high/low
					if (!isset($local_image_list[$local_image_hash])) {
						continue;
					} 
					$local_image_data = $local_image_list[$local_image_hash];
					$local_image_size = $local_image_data[4];
					$local_image_path = $quality=="low" ? SA_DIR_STORAGE . "/" . $setid . "/" . $local_image_data[0] : "";
					$remote_image_path = $local_image_data[7];
					// remote file does not exist, skip
					if (!isset($filedata[md5($remote_image_path)])) {
						continue;
					}
					// ok, we're in biz
					$remote_image_data = $filedata[md5($remote_image_path)];
					$remote_image_size = $remote_image_data->getSize();	
					// size it up
					$chunk_total += $quality=="low" ? $local_image_size : $remote_image_size;
					if ($chunk_total>$maxsize) {
						$chunk_num += 1;
						$chunk_total = 0;
					}
					// get rid of the first slash and set id
					$clean_remote_image_path = explode("/", $remote_image_path);
						array_shift($clean_remote_image_path);
						array_shift($clean_remote_image_path);
					$clean_remote_image_path = "/" . implode("/", $clean_remote_image_path);
					// add it to our file
					$remote_final_path = "/orders/$orderid/" . ($chunk_downloads?"files-$chunk_num/":"files/") . $quality . $clean_remote_image_path;
					$imagelist_data .= $remote_image_path . "\t" . $remote_final_path . "\t" . $local_image_path . "\n";
				}
			}
			// save the image processing list
			$imagelist_data = trim($imagelist_data, "\n");
			Filesystem::makeFile ($imagelist_path, $imagelist_data);
			//update the order flags
			$data = $this->getOrderFlags($orderid);
				$data = explode("\n", $data);
				$data[2] = $chunk_num;
				$data = implode("\n", $data);
			$this->setOrderFlags($orderid, $data);
			// finish up
			return array(true, $filedata, "");
		}
		
		public function copyOrderChunk ($orderid) {
			$start = microtime(true);
			// pull up the image table
			$imagelist_path = SA_DIR_TEMP."/".md5("dropboxlist".$orderid).".txt";
			$imagelist_data = Filesystem::getFileArray($imagelist_path);
			// start transferring files to the order folder
			$complete = 0;
			for ($i=0; $i<count($imagelist_data); ++$i) {
				$imagelist_row = trim($imagelist_data[$i], "\n");
				if ($imagelist_row=="") {
					$complete += 1;
					continue;
				}
				$item = explode("\t", $imagelist_row);
				$remote_image_path = $item[0];
				$remote_final_path = $item[1];
				$local_image_path = trim($item[2]);
				try {
					$file_info = $this->client->getMetadata($remote_final_path);
				} catch( Exception $e ) {
					try {
						if ($local_image_path=="") {
							$copyReference = $this->client->getCopyReference($remote_image_path);
							$reference = $copyReference->getReference();
							$file_info = $this->client->saveCopyReference($remote_final_path, $reference);
						} else {
							$file_info = $this->client->upload($local_image_path, $remote_final_path, ['mode' => 'overwrite', "mute" => true]);
						}
					} catch( Exception $e ) {
						continue;
					}
				}
				$complete += 1;
				$imagelist_data[$i] = "\n";
				// check the timer
				$current = microtime(true);
				$elapsed = $current - $start;
				if ($elapsed>=$this->max_time) break;
			}
			//update the order flags
			$progress = $complete / count($imagelist_data);
			$data = $this->getOrderFlags($orderid);
				$data = explode("\n", $data);
				$data[1] = $progress;
				$data = implode("\n", $data);
			$this->setOrderFlags($orderid, $data);
			// update the local list
			Filesystem::makeFile ($imagelist_path, implode("", $imagelist_data));
			// complete
			return array(true, $progress, "");
		}
		
		public function getShareLinks ($orderid) {
			$data = $this->getOrderFlags($orderid);
				$data = explode("\n", $data);
				$urls = array();
				if ($data[2]>0) {
					for ($i=0; $i<=$data[2]; ++$i) {
						$shared_folder = $this->getSharedLink("/orders/$orderid/files-$i", true);
						$urls[] = $shared_folder;
					}
				} else {
					$shared_folder = $this->getSharedLink("/orders/$orderid/files", true);
					$urls[] = $shared_folder;
				}
				$data[0] += 1;
				$data = implode("\n", $data);
			$this->setOrderFlags($orderid, $data);
			return array(true, implode(",", $urls), "");
		}
		
		public function resetDownloadCount ($orderid) {
			//update the order flags
			$data = $this->getOrderFlags($orderid);
				$data = explode("\n", $data);
				$data[0] = 0;
				$data = implode("\n", $data);
			$this->setOrderFlags($orderid, $data);
			// complete
			return array(true, "", "");
		}
		
		public function deleteDownloadFiles ($orderid) {
			try {
				$folder_info = $this->client->delete("/orders/$orderid");
			} catch( Exception $e ) {}
			return array(true, "", "");
		}
		
		public function purgeOldOrders ($expiry) {
			$response = array();
			$folderdata = $this->client->listFolder("/orders");
			$items = $folderdata->getItems()->all();
			while ($folderdata->hasMoreItems()) {
				$cursor = $folderdata->getCursor();
				$folderdata = $this->client->listFolderContinue($cursor);
				$more = $folderdata->getItems()->all();
				$items = array_merge($items, $more);
			}
			foreach($items as $item) {
				if (is_a($item, "Kunnu\Dropbox\Models\FolderMetadata")) {
					$path = $item->getPathLower();
					$filedata = $this->client->getMetadata($path."/info.txt");
					$info = array();
						$info["id"] = basename($path);
						$info["deleted"] = false;
						$info["created"] = strtotime($filedata->getServerModified());
					$current = round(microtime(true));
					$diff = $current - $info["created"]; // future - past
					$delete = $diff>$expiry;
					if ($delete) {
						$info["deleted"] = true;
						$folder_info = $this->client->delete($path);
					}
					$response[] = $info;
				}
			}
			return array(true, $response, "");
		}
		
		/* ---- Constructor ---- */
		
		public function __construct() {
			$max_time = ini_get("max_execution_time");
			if ( $max_time==null || $max_time=="" ) $max_time = 15;
			$max_time = $max_time/2;
			if ($max_time>15) $max_time = 15;
			$this->max_time = $max_time;
			$this->setup = Flatfile::getXmlArray("ordering");
			$this->dropbox_api_key = base64_decode($this->setup->getNodeVal("data.payment_gateway.dropbox_api_key"));
			$this->dropbox_api_secret = base64_decode($this->setup->getNodeVal("data.payment_gateway.dropbox_api_secret"));
			$this->dropbox_authorization_code = base64_decode($this->setup->getNodeVal("data.payment_gateway.dropbox_authorization_code"));
			$this->dropbox_hash = $this->setup->getAttrVal("data.payment_gateway.dropbox_token.hash");
			$this->dropbox_token = $this->setup->getNodeVal("data.payment_gateway.dropbox_token");
		}
		
		/* ---- Private Properties ---- */
		
		protected $max_time;
		protected $setup;
		protected $dropbox_api_key;
		protected $dropbox_api_secret;
		protected $dropbox_authorization_code;
		protected $dropbox_hash;
		protected $dropbox_token;
		protected $app;
		protected $client;
		
		protected function getOrderFlags ($oid, $default="0\n0\n0") {
			try {
				// get the order folder info
				$file = $this->client->download("/orders/$oid/info.txt");
				$data = $file->getContents();
			} catch( Exception $e ) {
				// does not exist, lets create a blank
				$data = $default;
				$this->setOrderFlags($oid, $data);
			}
			return $data;
		}
		
		protected function setOrderFlags ($oid, $data) {
			$tempfile = SA_DIR_TEMP."/".md5("dropbox".$oid).".txt";
			Filesystem::makeFile($tempfile, $data);
			$file = $this->client->upload($tempfile, "/orders/$oid/info.txt", ['mode' => 'overwrite', "mute" => true]);
			Filesystem::deleteFile($tempfile);
		}

		protected function parseFolderMeta ($type="tree", $path) {
			$list = array();
			try {
				$folderdata = $this->client->listFolder($path);
				$items = $folderdata->getItems()->all();
				while ($folderdata->hasMoreItems()) {
					$cursor = $folderdata->getCursor();
					$folderdata = $this->client->listFolderContinue($cursor);
					$more = $folderdata->getItems()->all();
					$items = array_merge($items, $more);
				}
				foreach($items as $item) {
					$path = $item->getPathLower();
					if (is_a($item, "Kunnu\Dropbox\Models\FolderMetadata")) {
						$more = $this->parseFolderMeta($type, $path);
						$list = array_merge($list, $more);
					} else {
						$filename = basename($path);
						$extension = strtolower(substr($filename, strrpos($filename, '.')+1));
						if (in_array($extension, array("jpg", "jpeg", "png"))==false) continue;
						if ($type=="tree") {
							$list[] = $path;
						} else if ($type=="flat") {
							$list[md5($path)] = $item;
						}
					}
				}
			} catch( Exception $e ) { // fail -- just print out the message from dropbox as-is
				return $list;
			}
			if ($type=="tree") {
				natsort($list);
			}
			return $list;
		}
		
		protected function getSharedLink ($path, $zip=false) {
			$link = "";
			$account = $this->client->getCurrentAccount();
			$account_type = $account->getAccountType();
			$settings = array();
			$settings["basic"] = array (
				'requested_visibility' => "public"
			);
			$settings["pro"] = $settings["business"] = array (
				'requested_visibility' => "public"//,
				//'expires' => date("Y-m-d\TH:i:s\Z", time()+(7*86400))
			);
			try {
				$response = $this->client->postToAPI('/sharing/create_shared_link_with_settings', array( 'path' => $path, 'settings' => $settings[$account_type] ));
				$responseBody = $response->getDecodedBody();
				$link = $responseBody["url"];
			} catch( Exception $e ) {
				$response = $this->client->postToAPI('/sharing/list_shared_links', array( 'path' => $path ));
				$responseBody = $response->getDecodedBody();
				$link = $responseBody['links'][0]["url"];
				$response = $this->client->postToAPI('/sharing/modify_shared_link_settings', array( 'url' => $link, 'settings' => $settings[$account_type] ));
				$responseBody = $response->getDecodedBody();
				$link = $responseBody["url"];
			}
			if ($zip) {
				$link = str_replace("?dl=0", "?dl=1", $link);
			}
			return $link;
		}
		
	}

?>