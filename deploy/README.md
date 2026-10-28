# Debian deployment

The application is designed for a single Node process on the specified Debian server. Build on Linux with `npm ci && npm run build` so native SQLite modules match the production OS. Copy `.next/standalone` into the release directory, then copy `public` and `.next/static` into that directory as `public` and `.next/static` before starting `server.js`.

Recommended directories:

- application: `/srv/meloday/app`
- database: `/srv/meloday/data/meloday.sqlite`
- media: `/srv/meloday/data/media`

Set the production environment before starting:

```ini
NODE_ENV=production
MELODAY_PROVIDER_MODE=real
MELODAY_DATABASE_PATH=/srv/meloday/data/meloday.sqlite
MELODAY_MEDIA_DIR=/srv/meloday/data/media
MELODAY_GENERATION_MAX_CONCURRENT=2
MELODAY_GENERATION_QUEUE_LIMIT=20
TOKENHUB_API_KEY=...
TOKENHUB_BASE_URL=https://tokenhub.tencentmaas.com/v1
TOKENHUB_TEXT_MODEL=deepseek/deepseek-flash
TOKENHUB_MUSIC_MODEL=minimax-music-v3.0
TOKENHUB_IMAGE_MODEL=seedream-image-v5.0-flash
```

Run `npm run db:migrate` once before starting. The process listens on `127.0.0.1:3000`; terminate it through systemd and place Nginx/TLS in front. Provider media downloads remain restricted to HTTPS on the default port, with redirects disabled and response type/size checks enforced. Example unit and reverse-proxy files are in [meloday.service.example](./meloday.service.example) and [nginx.conf.example](./nginx.conf.example).

Schedule `npm run cleanup` daily. Back up SQLite using its backup-aware command while the service is running, then copy the media directory alongside it:

```bash
sqlite3 /srv/meloday/data/meloday.sqlite ".backup '/srv/meloday/backups/meloday-$(date +%F).sqlite'"
rsync -a --delete /srv/meloday/data/media/ /srv/meloday/backups/media/
```

Check `curl -fsS http://127.0.0.1:3000/health` after restarts. Do not put API keys in client-side `NEXT_PUBLIC_*` variables.

Keep `client_max_body_size 11m` in Nginx to accommodate a 10 MB photo plus multipart overhead. The server also bounds streamed uploads. Cookies follow the public request protocol; the reverse proxy must overwrite `X-Forwarded-Proto` and `X-Forwarded-Host`. Use TLS for production sign-in and browser speech input.

`TOKENHUB_IMAGE_MODEL` defaults to `seedream-image-v5.0-flash`. Configure `TOKENHUB_ALLOWED_DOWNLOAD_HOSTS` with the exact CDN hostnames returned by the music/image service. Other hosts and redirects are rejected.

Only application startup recovers interrupted jobs. Maintenance commands can open the database without cancelling active generation. Orphaned media have a five-minute attachment grace period; historical revisions retain their referenced files.
