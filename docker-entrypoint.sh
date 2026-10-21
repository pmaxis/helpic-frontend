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

# The page may call only its own origin and the API's: the CSP names it.
# A relative address (/api/v1) is the site's own origin.
origin=""
case "${api:-${BAKED_API_BASE_URL:-}}" in
  http://*|https://*)
    origin=$(printf '%s' "${api:-${BAKED_API_BASE_URL:-}}" | sed -E 's#^(https?://[^/]+).*#\1#')
    if ! printf '%s' "$origin" | grep -Eq '^https?://[A-Za-z0-9.-]+(:[0-9]+)?$'; then
      echo "API_BASE_URL must be an http(s) URL with a plain host" >&2
      exit 1
    fi
    ;;
esac
sed "s#__API_ORIGIN__#$origin#" /etc/nginx/security.conf.template > /etc/nginx/security.conf
exec nginx -g 'daemon off;'
