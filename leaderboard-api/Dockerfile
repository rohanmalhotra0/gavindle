FROM node:20-alpine

WORKDIR /app

COPY package.json ./

# no deps (keep layer stable)

COPY . .

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "server.js"]

