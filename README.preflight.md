# Trae Preflight

This folder is prepared for `wangxt-981-1`.

Use `.env` for stable local ports and compose project identity:

- APP_PORT: 18281
- API_PORT: 19281
- WEB_PORT: 20281
- DB_PORT: 21281
- REDIS_PORT: 22281

Smoke entry:

```bash
bash scripts/smoke.sh
```

The preflight files are environment scaffolding only. The generated business
project can replace or extend them when needed.
