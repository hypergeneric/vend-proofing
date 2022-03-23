<?php

	class SimpleXML4 {
		
		/* ---- Public Properties ---- */
		
		public function save($str=null) {
			$path = isset($str) ? $str : $this->file_path;
			Filesystem::makeFile($path, $this->toString());
		}

		public function load($str) {
			$this->file_path = $str;
			$xmlstr = Filesystem::getFileData($str);
			$this->parse($xmlstr);
			return $xmlstr;
		}

		public function merge($xmlobj) {
			$result = array_merge_recursive($this->toArray(), $xmlobj->toArray());
			$this->xml_array = $result;
		}

		public function toArray() {
			return $this->xml_array;
		}

		public function toString() {
			$decl = $this->xml_decl;
			$xml = $this->ary2xml($this->xml_array);
			return "$decl\n$xml";
		}

		public function editNode ($path, $val=null, $att=null) {
			if ($att!=null) {
				$items = explode(";", $att);
				$att = array();
				for ($i=0; $i<count($items); ++$i) {
					$bits = explode("=", $items[$i]);
					$name = $bits[0];
					$value = $bits[1];
					$att[$name] = $value;
				}
			}
			$this->_editNode($this->xml_array, $path, $val, $att);
		}

		public function removeNode ($path) {
			$this->_removeNode($this->xml_array, $path);
		}

		public function getNodeVal ($path) {
			return $this->_getNodeVal($this->xml_array, $path);
		}

		public function getAttrVal ($path) {
			return $this->_getAttrVal($this->xml_array, $path);
		}
		
		/* ---- Constructor ---- */
		
		public function __construct($str=null) {
			if (isset($str)) {
				$this->parse($str);
			}
		}
		
		/* ---- Private Properties ---- */

		public $xml_array;
		protected $xml_decl = '<?xml version="1.0" encoding="UTF-8"?>';
		protected $file_path = '';
		
		protected function parse($str) {
			$bom = pack("CCC", 0xef, 0xbb, 0xbf);
			if (0 == strncmp($str, $bom, 3)) {
				$str = substr($str, 3);
			}
			$this->xml_array = $this->xml2ary($str);
		}

		protected function _getNodeVal (&$source, $path) {
			$nodes = explode(".", $path);
			while(count($nodes)>0) {
				$label = array_shift($nodes);
				$isLast = count($nodes)==0;
				$node = &$source[$label];
				if (!isset($node)) return null;
				if ($isLast) {
					if (isset($node["_v"])) return $node["_v"];
					else return null;
				}
				$source = &$source[$label]["_c"];
			}
		}

		protected function _getAttrVal (&$source, $path) {
			$nodes = explode(".", $path);
			$att = array_pop($nodes);
			while(count($nodes)>0) {
				$label = array_shift($nodes);
				$isLast = count($nodes)==0;
				$node = &$source[$label];
				if (!isset($node)) return null;
				if ($isLast) {
					if (isset($node["_a"][$att])) return $node["_a"][$att];
					else return null;
				}
				$source = &$source[$label]["_c"];
			}
		}

		protected function _removeNode (&$source, $path) {
			$nodes = explode(".", $path);
			while(count($nodes)>0) {
				$label = array_shift($nodes);
				$isLast = count($nodes)==0;
				$node = &$source[$label];
				if (!isset($node)) return false;
				if ($isLast) {
					unset($source[$label]);
					return true;
				}
				$source = &$source[$label]["_c"];
			}
		}

		protected function _editNode (&$source, $path, $val=null, $att=null) {
			$nodes = explode(".", $path);
			while(count($nodes)>0) {
				$label = array_shift($nodes);
				$isLast = count($nodes)==0;
				$node = &$source[$label];
				if (!$isLast) {
					if (!isset($node)) {
						$source[$label] = array();
						$source[$label]["_c"] = array();
					}
				} else {
					if (!isset($node)) {
						$source[$label] = array();
					}
					if ($val!=null) $source[$label]["_v"] = $val;
					if ($att!=null) {
						if (isset($source[$label]["_a"])) $source[$label]["_a"] = array_merge($source[$label]["_a"], $att);
						else $source[$label]["_a"] = $att;
					}
				}
				$source = &$source[$label]["_c"];
			}
		}

		protected function xml2ary(&$string) {
		    $parser = xml_parser_create("");
		    xml_parser_set_option($parser, XML_OPTION_CASE_FOLDING, 0);
		    xml_parse_into_struct($parser, $string, $vals, $index);
		    xml_parser_free($parser);

		    $mnary=array();
		    $ary=&$mnary;
		    foreach ($vals as $r) {
			  $t=$r['tag'];
			  if ($r['type']=='open') {
				if (isset($ary[$t])) {
				    if (isset($ary[$t][0])) $ary[$t][]=array(); else $ary[$t]=array($ary[$t], array());
				    $cv=&$ary[$t][count($ary[$t])-1];
				} else $cv=&$ary[$t];
				if (isset($r['attributes'])) {foreach ($r['attributes'] as $k=>$v) $cv['_a'][$k]=$v;}
				$cv['_c']=array();
				$cv['_c']['_p']=&$ary;
				$ary=&$cv['_c'];

			  } elseif ($r['type']=='complete') {
				if (isset($ary[$t])) { // same as open
				    if (isset($ary[$t][0])) $ary[$t][]=array(); else $ary[$t]=array($ary[$t], array());
				    $cv=&$ary[$t][count($ary[$t])-1];
				} else $cv=&$ary[$t];
				if (isset($r['attributes'])) {foreach ($r['attributes'] as $k=>$v) $cv['_a'][$k]=$v;}
				$cv['_v']=(isset($r['value']) ? $r['value'] : '');

			  } elseif ($r['type']=='close') {
				$ary=&$ary['_p'];
			  }
		    }

		    $this->_del_p($mnary);
		    return $mnary;
		}

		// _Internal: Remove recursion in result array
		protected function _del_p(&$ary) {
		    foreach ($ary as $k=>$v) {
			  if ($k==='_p') unset($ary[$k]);
			  elseif (is_array($ary[$k])) $this->_del_p($ary[$k]);
		    }
		}

		// Array to XML
		protected function ary2xml($arr, $d=0, $forcetag='') {
		    $result = array();
		    foreach ($arr as $tag => $r) {
			  if (isset($r[0])) {
				$result[] = $this->ary2xml($r, $d, $tag);
			  } else {
				if ($forcetag) {
					$tag = $forcetag;
				}
				$tabs = str_repeat("\t", $d);
				$result[] = "$tabs<$tag";
				if (isset($r['_a'])) {
					foreach ($r['_a'] as $at => $av) {
						if (is_array($av)) $av = reset($av);
						$av = htmlspecialchars($av);
						$result[] = " $at=\"$av\"";
					}
				}
				$result[] = ">" . ((isset($r['_c'])) ? "\n" : '');
				if (isset($r['_c'])) {
					$result[] = $this->ary2xml($r['_c'], $d+1);
				} elseif (isset($r['_v'])) {
					$value = $r['_v'];
					if (is_array($value)) $value = reset($r['_v']);
					$value = htmlspecialchars($value);
					$result[]= $value;
				}
				$result[] = (isset($r['_c']) ? $tabs : '') . "</$tag>\n";
			  }

		    }
		    return implode('', $result);
		}

		// Insert element into array
		protected function ins2ary(&$ary, $element, $pos) {
		    $ar1=array_slice($ary, 0, $pos); $ar1[]=$element;
		    $ary=array_merge($ar1, array_slice($ary, $pos));
		}

	}

?>