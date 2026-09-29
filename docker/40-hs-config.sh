#!/bin/sh
# Runs when the container starts (nginx's image runs /docker-entrypoint.d/*.sh before nginx):
# writes this deployment's addresses into config.js, and the site's own address into the
# link-preview tags of index.html, from a pristine copy, so a restart with new values works too.
# The image stays the same in every environment.
set -eu

: "${API_URL:?API_URL is required, e.g. https://api.heapedstacked.dev}"
: "${SITE_URL:?SITE_URL is required, e.g. https://heapedstacked.dev}"

html=/usr/share/nginx/html
printf 'window.HS_CONFIG = { apiUrl: "%s", siteUrl: "%s" };\n' "$API_URL" "$SITE_URL" > "$html/config.js"
sed "s|__SITE_URL__|$SITE_URL|g" "$html/index.template.html" > "$html/index.html"
