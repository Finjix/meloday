# Debian deployment

The application is designed for a single Node process on the specified Debian server. Build locally or on the server with `npm ci && npm run build`, then run the standalone server from `.next/standalone`.

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
# Include only trusted provider/CDN hostnames when generation returns signed download URLs.
TOKENHUB_ALLOWED_DOWNLOAD_HOSTS=trusted-cdn.example.com
TOKENHUB_API_KEY=...
TOKENHUB_BASE_URL=https://tokenhub.tencentmaas.com/v1
TOKENHUB_TEXT_MODEL=deepseek/deepseek-flash
TOKENHUB_MUSIC_MODEL=minimax-music-v3.0
TOKENHUB_IMAGE_MODEL=seedream-image-v5.0-lite
```

Run `npm run db:migrate` once before starting. The process listens on `127.0.0.1:3000`; terminate it through systemd and place Nginx/TLS in front. Keep the download-host allowlist complete: unlisted signed CDN URLs are rejected rather than fetched by the server. Example unit and reverse-proxy files are in [meloday.service.example](./meloday.service.example) and [nginx.conf.example](./nginx.conf.example).

Schedule `npm run cleanup` daily. Back up SQLite using its backup-aware command while the service is running, then copy the media directory alongside it:

```bash
sqlite3 /srv/meloday/data/meloday.sqlite ".backup '/srv/meloday/backups/meloday-$(date +%F).sqlite'"
rsync -a --delete /srv/meloday/data/media/ /srv/meloday/backups/media/
```

Check `curl -fsS http://127.0.0.1:3000/health` after restarts. Do not put API keys in client-side `NEXT_PUBLIC_*` variables.
