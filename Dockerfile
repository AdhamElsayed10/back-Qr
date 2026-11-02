FROM node:20-alpine
RUN apk add --no-cache openssl libcrypto3 libssl3
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY prisma ./prisma
RUN npx --no-install prisma generate
COPY . .
RUN mkdir -p uploads/originals uploads/processed uploads/qrcodes
EXPOSE 5000
CMD ["sh", "-c", "npx --no-install prisma db push && node prisma/seed.js && node src/app.js"]
