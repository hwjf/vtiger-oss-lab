#!/bin/sh
set -eu

[ -s /var/www/html/config.inc.php ]
grep -q 'application_unique_key' /var/www/html/config.inc.php

php -r '
mysqli_report(MYSQLI_REPORT_OFF);
$db = @new mysqli(getenv("VTIGER_DB_HOST"), getenv("VTIGER_DB_USER"), getenv("VTIGER_DB_PASSWORD"), getenv("VTIGER_DB_NAME"));
if ($db->connect_errno) exit(1);
$statement = $db->prepare("SELECT 1 FROM vtiger_users WHERE user_name = \"admin\" AND accesskey = ? LIMIT 1");
if (!$statement) exit(1);
$accessKey = getenv("VTIGER_ACCESS_KEY");
$statement->bind_param("s", $accessKey);
$statement->execute();
$result = $statement->get_result();
exit($result && $result->num_rows === 1 ? 0 : 1);
'
