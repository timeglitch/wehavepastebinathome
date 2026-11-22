FROM node:24-alpine

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server.js db.js ./
COPY public ./public

# Writable only where the database lives; the app code stays root-owned.
RUN mkdir /data && chown node:node /data
USER node

ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DB_PATH=/data/pastes.db
EXPOSE 3000
CMD ["node", "server.js"]
