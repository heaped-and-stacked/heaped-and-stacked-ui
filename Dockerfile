# Builds the UI and serves it with nginx (build arguments VITE_API_URL and VITE_SITE_URL).
# For day-to-day UI work use `npm run dev` (hot reload) instead.

# ---- build ---------------------------------------------------------------
FROM node:24-alpine AS build
WORKDIR /app

# Dependencies first, so they're cached until the lock file changes.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# The API's URL as the browser sees it; baked into the bundle at build time.
ARG VITE_API_URL=http://localhost:8080
ENV VITE_API_URL=$VITE_API_URL
# The web app's own address, for the link-preview tags in index.html.
ARG VITE_SITE_URL=http://localhost:5173
ENV VITE_SITE_URL=$VITE_SITE_URL
RUN npm run build

# ---- serve ---------------------------------------------------------------
FROM nginx:1.29-alpine
# The image fills in ${API_ORIGIN} when the container starts (templates/*.template -> conf.d/*);
# it's the same API address the bundle was built with, so the Content-Security-Policy matches.
ARG VITE_API_URL=http://localhost:8080
ENV API_ORIGIN=$VITE_API_URL
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
