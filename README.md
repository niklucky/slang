# Slang: UI & API for i18n

> This is an educational pet-project to learn SvelteKit by practice.

🚨🚧🚧🚧🚧🚧🚧🚧🚧🚧🚨

This is just a draft and not event tested properly yet!

# Starting & deploying project

## Docker run commands

docker run -d \
  -p 3001:3000 \
  --name slang \
  -e DATABASE_URL=file:/data/slang.db \
  -v /data/slang/sqlite:/data \
  niklucky/slang:latest

## Simple docker-compose

Super easy way to kickstart project

### Postgres version (not implemented yet!)

```yml
version: '3.8'

services:
  slang:
    image: niklucky/slang:0.1-pg
    environment:
      - DATABASE_URL: postgres://dbslang:secure_pass@slang-db:5432/slang
    ports:
      - target: 3000
        published: 3000
        protocol: tcp
    logging:
      driver: 'json-file'
      options:
        max-size: '50k'
        max-file: '2'

  slang-db:
    image: postgres:15
    ports:
      - target: 5432
        published: 3001
        protocol: tcp
    volumes:
      - /data/db:/var/lib/postgresql/data
    environment:
      POSTGRES_USER: dbslang
      POSTGRES_PASSWORD: secure_pass
      POSTGRES_DB: slang

```

### Sqlite version

```yml
version: '3.8'

services:
  slang:
    image: niklucky/slang:latest
    environment:
      - DATABASE_URL: file:/data/slang.db
    volumes:
      - /data/slang:/data
    ports:
      - target: 3000
        published: 3000
        protocol: tcp
    logging:
      driver: 'json-file'
      options:
        max-size: '50k'
        max-file: '2'
```

## Usage in code

### React/React native

🚧 Will put code in `examples` folder after implementation