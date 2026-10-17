FROM nginx:stable-alpine3.24

COPY nginx/no-cache.conf /etc/nginx/conf.d/default.conf


WORKDIR /usr/share/nginx/html

COPY ./dist .