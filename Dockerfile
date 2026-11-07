# Builds the UI and serves it with nginx. One image for every environment: the container takes the
# addresses when it starts (environment API_URL and SITE_URL; see docker/40-hs-config.sh).
# For day-to-day UI work use `npm run dev` (hot reload) instead.

# ---- build ---------------------------------------------------------------
FROM node:26-alpine AS build
WORKDIR /app

# Dependencies first, so they're cached until the lock file changes.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# No addresses in the bundle: config.js brings them at startup. The link-preview tags get a
# placeholder the container fills in.
ENV VITE_API_URL=""
ENV VITE_SITE_URL=__SITE_URL__
RUN npm run build

# ---- serve ---------------------------------------------------------------
FROM nginx:1.31-alpine
# The base image's system packages, with the security fixes released since it was built.
RUN apk upgrade --no-cache
# At startup the image fills ${API_URL} into the nginx configuration (templates/*.template ->
# conf.d/*), and 40-hs-config.sh writes config.js and index.html from API_URL and SITE_URL.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
RUN cp /usr/share/nginx/html/index.html /usr/share/nginx/html/index.template.html
COPY docker/40-hs-config.sh /docker-entrypoint.d/40-hs-config.sh
RUN chmod 755 /docker-entrypoint.d/40-hs-config.sh
EXPOSE 80
