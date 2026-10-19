FROM node:18-alpine

# Alpine doang, gak ada dependency eksternal (zero-dep app).
WORKDIR /app

# Copy source. Gak ada npm install (zero-dep) -> build super cepat.
COPY . .

# Folder persistent buat data (links + analytics).
# Di PaaS, mount VOLUME/DISK ke /app/data biar gak ilang pas redeploy.
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8080
ENV DATA_FILE=/app/data/links.json
ENV ANALYTICS_FILE=/app/data/analytics.json

EXPOSE 8080

# Healthcheck biar orchestrator tau server hidup.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
