# docker/php/Dockerfile
FROM php:8.3-fpm-alpine AS base

RUN apk add --no-cache \
    postgresql-dev \
    libpng-dev \
    libjpeg-turbo-dev \
    libwebp-dev \
    freetype-dev \
    icu-dev \
    oniguruma-dev \
    libzip-dev \
    libxml2-dev \
    freetype \
    fontconfig \
    font-dejavu \
    zip \
    unzip \
    git \
    curl \
    $PHPIZE_DEPS \
    && docker-php-ext-configure gd --with-freetype --with-jpeg --with-webp \
    && docker-php-ext-install \
        pdo \
        pdo_pgsql \
        pgsql \
        gd \
        intl \
        mbstring \
        opcache \
        pcntl \
        zip \
        exif \
    && pecl install redis \
    && docker-php-ext-enable redis

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

COPY docker/php/php.ini /usr/local/etc/php/conf.d/99-certhub.ini
COPY docker/php/www.conf /usr/local/etc/php-fpm.d/www.conf

# ──────────────────────────────────────────────────
# Stage développement
# ──────────────────────────────────────────────────
FROM base AS development

RUN apk add --no-cache linux-headers \
    && pecl install xdebug \
    && docker-php-ext-enable xdebug
COPY docker/php/xdebug.ini /usr/local/etc/php/conf.d/xdebug.ini
COPY docker/php/www.dev.conf /usr/local/etc/php-fpm.d/www.conf

# Reste root : le code arrive via bind mount depuis un hote Windows (voir
# www.dev.conf). Jamais utilise en production (stage separe, USER www-data).

# ──────────────────────────────────────────────────
# Stage production
# ──────────────────────────────────────────────────
FROM base AS production

COPY --chown=www-data:www-data api/ /var/www/html

RUN composer install \
    --no-dev \
    --no-interaction \
    --prefer-dist \
    --optimize-autoloader \
    --no-scripts

# Le cache de config n'est PAS construit ici : le vrai .env de production
# n'existe pas dans ce contexte de build (exclu par .dockerignore, comme il
# se doit — jamais de secrets dans une image). Le construire ici bake donc
# une config batie sur des valeurs par defaut (ex: DB_CONNECTION=sqlite),
# et une fois le cache present Laravel ignore totalement env()/.env au
# demarrage du vrai conteneur -> DB_CONNECTION reste bloque sur sqlite meme
# avec les bonnes variables d'environnement de prod, ce qui casse
# `php artisan migrate` des la premiere migration Postgres-specifique. Voir
# l'etape "Rafraichir les caches Laravel" de deploy.yml, qui construit ce
# cache correctement une fois le conteneur demarre avec le vrai .env.

COPY docker/php/opcache.ini /usr/local/etc/php/conf.d/opcache.ini

RUN chown -R www-data:www-data storage bootstrap/cache \
    && apk del --no-cache $PHPIZE_DEPS

USER www-data
EXPOSE 9000
