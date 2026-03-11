FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache bash git python3 make g++

COPY package*.json ./
RUN npm install

COPY . .

# Se tiveres .env local, opcional:
COPY .env .env

# Só o que realmente usas (exemplos)
ARG COHERE_API_KEY
ARG SUPABASE_URL
ARG SUPABASE_ANON_KEY


EXPOSE 8081 19000 19001 19002

ENV EXPO_NO_INTERACTIVE=1 \
    EXPO_DEVTOOLS_LISTEN_ADDRESS=0.0.0.0

CMD ["npx", "expo", "start"]