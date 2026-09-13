# Meloday

Meloday is a warm, mobile-first music diary. A temporary conversation helps a user turn a day's fragments into a diary entry, then generates a title, summary, cover and instrumental music card.

## Quick start

```powershell
npm install
Copy-Item .env.example .env.local
npm run db:migrate
npm run dev
```

The default development provider mode is `fake`, so the complete UI flow can be exercised without paid API calls. Set `MELODAY_PROVIDER_MODE=real` and configure `TOKENHUB_API_KEY` before live generation.

## Commands

- `npm run dev` starts the development server.
- `npm run lint` runs ESLint.
- `npm test` runs unit and integration tests.
- `npm run build` creates the standalone production build.
- `npm run db:migrate` initializes or upgrades SQLite.
- `npm run cleanup` removes expired temporary sessions and orphaned media.
- `npm run capacity:grant -- alice 10` grants capacity using `MELODAY_ADMIN_TOKEN`.

## Production notes

Run one standalone Node process behind Nginx, keep `MELODAY_DATABASE_PATH` and `MELODAY_MEDIA_DIR` on a persistent disk, enable SQLite WAL, and back up both paths. The generation runner intentionally marks in-flight work as failed after a process restart; the user can retry without provider polling or hidden background work.

See [`deploy/README.md`](deploy/README.md) for Debian/systemd/Nginx setup.
