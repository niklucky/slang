FROM node:18-alpine AS build
WORKDIR /app
COPY . .
RUN npm install
RUN npm run build

FROM node:18-alpine as prisma
ARG dbprovider=sqlite

WORKDIR /app
COPY package.json package.json

COPY prisma prisma
RUN sed -i "s/sqlite/${dbprovider}/g" ./prisma/schema.prisma

RUN npm install --omit=dev
RUN npx prisma generate


FROM node:18-alpine AS worker
WORKDIR /app
RUN rm -rf ./*
COPY --from=build /app/package.json .
COPY --from=build /app/.env .
COPY --from=build /app/build build
COPY --from=build /app/scripts/start.sh slang.sh
COPY --from=prisma /app/prisma prisma
COPY --from=prisma /app/node_modules node_modules

RUN chmod u+x ./slang.sh

EXPOSE 3000
CMD ["./slang.sh"]