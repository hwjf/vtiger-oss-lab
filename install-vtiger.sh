#!/bin/sh
set -eu

if [ -s /var/www/html/config.inc.php ]; then
	exit 0
fi

base_url="http://127.0.0.1"
host_header="localhost:${VTIGER_PUBLIC_PORT}"
cookie_jar="$(mktemp)"
step4="$(mktemp)"
step5="$(mktemp)"
step7="$(mktemp)"

cleanup() {
	rm -f "$cookie_jar" "$step4" "$step5" "$step7"
}
trap cleanup EXIT

curl --fail --silent --show-error \
	--header "Host: $host_header" \
	--cookie-jar "$cookie_jar" \
	--cookie "$cookie_jar" \
	"$base_url/index.php?module=Install&view=Index&mode=Step4&lang=en_us" \
	--output "$step4"

csrf="$(grep -o "name='__vtrftk' value=\"[^\"]*\"" "$step4" | head -n 1 | sed 's/^[^\"]*\"//; s/\"$//')"
test -n "$csrf"

curl --fail --silent --show-error \
	--header "Host: $host_header" \
	--cookie-jar "$cookie_jar" \
	--cookie "$cookie_jar" \
	--request POST \
	--data-urlencode "module=Install" \
	--data-urlencode "view=Index" \
	--data-urlencode "mode=Step5" \
	--data-urlencode "__vtrftk=$csrf" \
	--data-urlencode "db_type=mysqli" \
	--data-urlencode "db_hostname=${VTIGER_DB_HOST}:3306" \
	--data-urlencode "db_username=${VTIGER_DB_USER}" \
	--data-urlencode "db_password=${VTIGER_DB_PASSWORD}" \
	--data-urlencode "db_name=${VTIGER_DB_NAME}" \
	--data-urlencode "currency_name=USA, Dollars" \
	--data-urlencode "admin=admin" \
	--data-urlencode "password=${VTIGER_ADMIN_PASSWORD}" \
	--data-urlencode "retype_password=${VTIGER_ADMIN_PASSWORD}" \
	--data-urlencode "firstname=Lab" \
	--data-urlencode "lastname=Administrator" \
	--data-urlencode "admin_email=admin@example.invalid" \
	--data-urlencode "dateformat=yyyy-mm-dd" \
	--data-urlencode "timezone=UTC" \
	"$base_url/index.php" \
	--output "$step5"

auth_key="$(grep -o 'name="auth_key" value="[^"]*"' "$step5" | head -n 1 | sed 's/.*value="//; s/"$//')"
csrf="$(grep -o "name='__vtrftk' value=\"[^\"]*\"" "$step5" | head -n 1 | sed 's/^[^\"]*\"//; s/\"$//')"
test -n "$auth_key"
test -n "$csrf"

curl --fail --silent --show-error \
	--header "Host: $host_header" \
	--cookie-jar "$cookie_jar" \
	--cookie "$cookie_jar" \
	--request POST \
	--data-urlencode "module=Install" \
	--data-urlencode "view=Index" \
	--data-urlencode "mode=Step7" \
	--data-urlencode "__vtrftk=$csrf" \
	--data-urlencode "auth_key=$auth_key" \
	--data-urlencode "myname=Local Docker Lab" \
	--data-urlencode "myemail=admin@example.invalid" \
	--data-urlencode "industry=Other" \
	"$base_url/index.php" \
	--output "$step7"

test -s /var/www/html/config.inc.php
grep -q 'application_unique_key' /var/www/html/config.inc.php

php -r '
$db = new mysqli(getenv("VTIGER_DB_HOST"), getenv("VTIGER_DB_USER"), getenv("VTIGER_DB_PASSWORD"), getenv("VTIGER_DB_NAME"));
$statement = $db->prepare("UPDATE vtiger_users SET accesskey = ? WHERE user_name = \"admin\"");
$accessKey = getenv("VTIGER_ACCESS_KEY");
$statement->bind_param("s", $accessKey);
$statement->execute();
'
