FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY src ./src

EXPOSE 5000

# Used by Kubernetes liveness/readiness probes
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/health || exit 1

CMD ["node", "src/server.js"]
