# Usa Node 18
FROM node:18-alpine

# Define diretório de trabalho
WORKDIR /app

# Copia package.json e package-lock.json do backend
COPY ./backend/package*.json ./

# Instala dependências do backend
RUN npm install --production

# Copia o código do backend
COPY ./backend .

# Expõe a porta
EXPOSE 3333

# Comando para iniciar o servidor
CMD ["npm", "start"]
