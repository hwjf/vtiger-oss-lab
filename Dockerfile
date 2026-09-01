FROM php:8.2.29-apache-bookworm@sha256:c2408ddfc8988020e521f5a666cf23e11cba795f03fc1dbc4b1c233337ca7d5f

ARG VTIGER_VERSION
ARG VTIGER_SHA256

RUN apt-get update \
	&& apt-get install -y --no-install-recommends \
		ca-certificates curl \
		libc-client2007e-dev libkrb5-dev \
		libcurl4-openssl-dev \
		libfreetype6-dev libjpeg62-turbo-dev libpng-dev \
		libonig-dev libxml2-dev libzip-dev zlib1g-dev \
	&& docker-php-ext-configure gd --with-freetype --with-jpeg \
	&& docker-php-ext-configure imap --with-kerberos --with-imap-ssl \
	&& docker-php-ext-install -j"$(nproc)" curl exif gd imap mbstring mysqli opcache pdo_mysql simplexml xml zip \
	&& a2enmod headers expires rewrite \
	&& rm -rf /var/lib/apt/lists/*

COPY vtiger.ini /usr/local/etc/php/conf.d/99-vtiger.ini
COPY check-vtiger-install.sh /usr/local/bin/check-vtiger-install
COPY install-vtiger.sh /usr/local/bin/install-vtiger
COPY lab-entrypoint.sh /usr/local/bin/lab-entrypoint

RUN set -eux; \
	url="https://downloads.sourceforge.net/project/vtigercrm/vtiger%20CRM%20${VTIGER_VERSION}/Core%20Product/vtigercrm${VTIGER_VERSION}.tar.gz"; \
	curl -fL --retry 5 --retry-all-errors "$url" -o /tmp/vtiger.tar.gz; \
	echo "${VTIGER_SHA256}  /tmp/vtiger.tar.gz" | sha256sum -c -; \
	rm -rf /var/www/html/*; \
	tar -xzf /tmp/vtiger.tar.gz --strip-components=1 -C /var/www/html; \
	rm /tmp/vtiger.tar.gz; \
	touch /var/www/html/config.inc.php; \
	chown -R www-data:www-data /var/www/html; \
	chmod +x /usr/local/bin/check-vtiger-install /usr/local/bin/install-vtiger /usr/local/bin/lab-entrypoint

WORKDIR /var/www/html
ENTRYPOINT ["lab-entrypoint"]
CMD ["apache2-foreground"]
