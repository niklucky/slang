FROM node:18-alpine AS build

WORKDIR /app
COPY . .
RUN npm install
RUN npm run build
RUN npx prisma generate

FROM node:18-alpine AS worker

WORKDIR /app
RUN rm -rf ./*
COPY --from=build /app/package.json .
COPY --from=build /app/build build
RUN pwd && ls -l
RUN npm install --omit=dev

EXPOSE 3000
CMD ["node", "build"]