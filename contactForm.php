<?php

if (isset($_POST['submit'])) {
	$name = $_POST['name'];
	$email = $_POST['email'];
	$businessName = $_POST['bussinessName'];
	$additionalInfo = $_POST['additionalInfo'];

	$subject = "Submission - ".$bussinessName;
	$mailTo = "ncarlson29@gmail.com";
	$header = "From: ".$email;
	$txt = "Name: ".$name."\n E-mail: ".$email."\n Business Name: ".$bussinessName."\n Additional Info: ".$additionalInfo;

	mail($mailTo, $subject, $txt, $header);
	header("Location: index.php?mailSend");
}

?>