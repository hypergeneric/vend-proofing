<?php
 $namespace = implode("-", array_slice(explode("-", basename(__FILE__, ".php")), 0, -1)); include "$namespace-config.php"; include $corepath."/php/gateway.php"; ?>