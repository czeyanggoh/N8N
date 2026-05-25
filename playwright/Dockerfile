# Headed Chromium under Xvfb so stealth tactics actually work against bank fingerprinting
FROM mcr.microsoft.com/playwright:v1.47.0-jammy

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    xvfb \
    dbus-x11 \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps first for layer caching
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY src ./src

# Persisted state lives outside the image
RUN mkdir -p /app/state /app/uploads /app/downloads /app/screenshots /app/traces

ENV NODE_ENV=production \
    DISPLAY=:99 \
    XVFB_RESOLUTION=1920x1080x24 \
    PORT=3000

EXPOSE 3000

# Wrap node in Xvfb so headed Chromium has a display
CMD ["sh", "-c", "Xvfb $DISPLAY -screen 0 $XVFB_RESOLUTION -ac +extension GLX +render -noreset & sleep 1 && node src/server.js"]
