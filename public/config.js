// The addresses this deployment talks to. Empty in development, where the .env values apply; the
// container writes the real ones when it starts (docker/40-hs-config.sh), so one image serves
// every environment.
window.HS_CONFIG = {};
