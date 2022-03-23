<?php

	/* disable direct access
		*/
	if (count(get_included_files())==1) exit();

	/* extend the gateway class to include any custom functionality
		*/
	class LocalGraphic extends Graphic {
	}

	/* init the gateway
		*/
	$graphic = new LocalGraphic();
	$graphic->parseIngest();
	$graphic->process();

?>