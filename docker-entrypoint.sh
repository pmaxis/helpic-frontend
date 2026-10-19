#!/bin/sh
set -eu

api="${API_BASE_URL:-}"
case "$api" in
  *\"*|*\\*|*'
'*)
    echo "API_BASE_URL must not contain quotes, backslashes or line breaks" >&2
    exit 1
    ;;
esac

printf 'window.__HELpic_CONFIG__ = { apiBaseUrl: "%s" };\n' "$api" > /usr/share/nginx/html/config.js
exec nginx -g 'daemon off;'
