# Tree Cadastre - Frontend (React + Vite + OpenLayers)
FROM node:20-alpine

WORKDIR /app

# Dependencies
COPY package.json package-lock.json* ./
RUN npm ci 2>/dev/null || npm install

COPY . .

EXPOSE 5173

# Dev server with hot reload
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
