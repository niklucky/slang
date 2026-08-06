# slang-example-react-basic

A one-page React app that exercises [`@warpunit/slang-react`](../../react): bundled
`resources`, `t()` interpolation, `fallbackLocale`, `setLocale`, `ready` and `refresh`.

## Run it

```bash
# from the repo root
pnpm install
pnpm --filter slang-example-react-basic dev
```

Then open http://localhost:5803.

Out of the box the app renders from the bundled `src/locales/*.json` and makes no
network calls, so it works with nothing else running.

## Test against a live server

1. Start the database and API (see the root `DEPLOYMENT.md`); the API listens on `:5801`.
2. Create a project in the web UI and copy its API key.
3. Seed the server with this example's locales using the CLI's `--in` flag:

   ```bash
   node ../../react/bin/slang.mjs push \
     --in ./src/locales --url http://localhost:5801 --key <your-api-key>
   ```

4. `cp .env.example .env` and set `VITE_SLANG_API_KEY=<your-api-key>`.
5. Restart `pnpm --filter slang-example-react-basic dev`.

The provider now fetches `/api/translations` through Vite's `/api` proxy (same-origin,
so no CORS). Edit a string in the UI's project and hit **Refresh from server** to see the
client pick it up.

## Notes

- The dev server runs on **5803** (the project port pool is 5800–5900) and proxies
  `/api` to `http://localhost:5801`.
- `fallback_demo` exists only in `en.json` on purpose, to show the fallback locale.
