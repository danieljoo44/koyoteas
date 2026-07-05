FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
ENV DATA_DIR=/data
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server/index.js"]
