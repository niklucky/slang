# Deployment

CI/CD is driven by GitHub Actions. Docker images are published to the GitHub
Container Registry (`ghcr.io/niklucky/slang`) and the production stack runs on
a VPS behind nginx.

## Pipeline overview

| Trigger                | Jobs                                                        |
| ---------------------- | ----------------------------------------------------------- |
| Pull request           | lint, typecheck, unit tests                                 |
| push to `main`         | lint, typecheck, unit tests, build + push image (`<sha>`, `latest`) |
| push tag `vX.Y.Z`      | lint, typecheck, unit tests, build + push image (`X.Y.Z`), deploy to VPS |

- `main` images are for dev/staging: they are tagged with the short commit SHA
  and `latest`.
- Release images are pinned to the version (the `v` is stripped, so tag
  `v1.4.2` becomes image tag `1.4.2`). Only tagged releases deploy to the VPS.

Workflows:

- `.github/workflows/check.yml` — reusable lint + typecheck + test job (also
  runs directly for pull requests). Server tests use a throwaway Postgres
  service container.
- `.github/workflows/main.yml` — builds and pushes images on `main`.
- `.github/workflows/release.yml` — builds, pushes, and deploys on version tags.

## Required GitHub secrets

Configure these under **Settings → Secrets and variables → Actions**:

| Secret             | Description                                          |
| ------------------ | ---------------------------------------------------- |
| `SSH_HOST`         | VPS hostname or IP                                   |
| `SSH_USER`         | SSH login user on the VPS                            |
| `SSH_PRIVATE_KEY`  | Private key authorized for `SSH_USER` on the VPS     |
| `SLANG_ENV`        | Full contents of the production `.env` file (below)  |

`SLANG_ENV` holds the runtime secrets, one `KEY=value` per line:

```
POSTGRES_PASSWORD=<strong random password>
JWT_SECRET=<openssl rand -hex 32>
```

On every release the deploy job writes it to `/opt/slang/.env` (mode 600) next
to the compose file. The compose file builds `DATABASE_URL` from these values
and talks to the bundled Postgres container; `JWT_SECRET` signs auth tokens.
Note: `POSTGRES_PASSWORD` is only consumed when the Postgres volume is first
initialized — changing it later will not rotate the existing database password.

No registry secret is needed: the build pushes to GHCR using the built-in
`GITHUB_TOKEN`.

## One-time VPS setup

1. Install Docker and the `docker compose` plugin, and make sure the SSH
   deploy user can run `docker` (e.g. is in the `docker` group).

2. Create the app directory owned by the deploy user:

   ```sh
   sudo mkdir -p /opt/slang
   sudo chown <deploy-user>:<deploy-user> /opt/slang
   ```

   The `.env` file needs no manual setup — CI writes it from the `SLANG_ENV`
   secret on every release.

3. Configure nginx to reverse-proxy to the app:

   ```nginx
   location / {
     proxy_pass http://127.0.0.1:5800;
     proxy_set_header Host $host;
     proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
     proxy_set_header X-Forwarded-Proto $scheme;
   }
   ```

   The app container binds only to `127.0.0.1:5800`, so it is reachable solely
   through nginx.

CI copies `deploy/compose.yml` to `/opt/slang/compose.yml` on every release,
so the repo stays the source of truth for the stack.

## Releasing

Bump versions, commit, then tag and push:

```sh
git tag v1.4.2
git push origin v1.4.2
```

The release workflow builds `ghcr.io/niklucky/slang:1.4.2`, then on the VPS:
pulls the image, recreates the app container, waits for it to respond, and
leaves Postgres and its volume untouched. Database migrations run automatically
when the server starts.

The deploy job uses the `production` GitHub environment — you can attach
required reviewers there to gate deployments.

### Rollback

Point the VPS back at an older image tag:

```sh
ssh $SSH_USER@$SSH_HOST \
  "cd /opt/slang && SLANG_VERSION=1.4.1 docker compose up -d"
```

## Pulling images elsewhere

The repository is public, so GHCR images are publicly readable and can be
pulled without authentication:

```sh
docker pull ghcr.io/niklucky/slang:latest
```

If the repo ever becomes private, the VPS (and any other consumer) will need a
`docker login ghcr.io` with a token that has `packages:read`.

## npm publishing (manual)

The React client (`@warpunit/slang-react`) is published manually for now:

```sh
cd react
pnpm publish --no-git-checks
```

The package's `prepublishOnly` hook runs typecheck and tests first. Bump the
`version` field in `react/package.json` before publishing.
