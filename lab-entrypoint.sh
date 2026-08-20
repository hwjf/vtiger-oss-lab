#!/bin/sh
set -eu

if [ ! -f /var/www/html/.lab-install-complete ]; then
	(
		for attempt in $(seq 1 60); do
			if curl --silent --fail http://127.0.0.1/index.php >/dev/null 2>&1; then
				if install-vtiger; then
					touch /var/www/html/.lab-install-complete
					exit 0
				fi
			fi
			sleep 5
		done
		echo "vtiger lab installation failed" >&2
		exit 1
	) &
fi

exec docker-php-entrypoint "$@"
