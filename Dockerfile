FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 3000
HEALTHCHECK --interval=5s --timeout=5s --retries=12 --start-period=45s \
  CMD node -e "require('http').get('http://127.0.0.1:3000/api',r=>process.exit(r.statusCode<500?0:1)).on('error',()=>process.exit(1))"
CMD ["node", "dist/src/main.js"]
