# LeiBlog Server

Requires Bun, PostgreSQL and Redis. `compose.yml` starts local development data services on loopback ports only. Keep the databases and Redis on a private network in production.

## Development

Configure the variables from `.env.example`, then run `bun run dev` from this directory. The API uses port 3000 and the frontend uses port 5174 by default. Initial setup is available during development; complete it before production deployment or configure a bootstrap administrator.

## Production

- Use [`deploy/leiblog.sh`](../deploy/leiblog.sh). The production deployment, HTTPS setup, backup and recovery guide is [`docs/cloud-server-deployment.md`](../docs/cloud-server-deployment.md). Do not run the development `compose.yml` as a production stack.
- Set `NODE_ENV=production`. The Docker image sets this automatically.
- Explicitly configure `DATABASE_URL`, `REDIS_URL` and exact HTTPS frontend origins in `CORS_ORIGINS`. Credentialed wildcard origins are rejected.
- Set `PUBLIC_SITE_URL` to the canonical HTTPS origin. Email asset URLs and default OAuth callbacks use this origin, rather than an internal container address. If omitted in production, the first allowed frontend origin is used.
- Configure unique random `JWT_SECRET`, `CONFIG_ENCRYPTION_SECRET` and `ALTCHA_SECRET`, each at least 32 characters. Generate them with `openssl rand -hex 32`. Keep the encryption key stable while encrypted settings are in use.
- If using bootstrap, set a strong `ADMIN_BOOTSTRAP_PASSWORD` and the administrator email. Remove the bootstrap password after setup.
- Only trust the actual reverse proxy IPs in `TRUSTED_PROXY_IPS`. Configure the proxy to append the real peer to `X-Forwarded-For`, or overwrite it if there is only one proxy.
- Serve the frontend over HTTPS. Also set the frontend's CSP, frame and referrer policies on its web server; API response headers do not protect a separately hosted HTML document.
- Keep uploads on a writable persistent volume. Local active content is sandboxed by API response headers. New SVG uploads are rejected; supported media must match their file signatures.
- Password and email-code flows require server-verified ALTCHA. Redis-backed throttles fail closed when Redis is unavailable.
- Browser admin sessions use HttpOnly cookies; production cookies have the `__Host-` prefix, Secure and SameSite=Lax. Bearer API clients remain supported. A frontend served from an unrelated registrable domain needs a deliberate same-site deployment or separately designed cross-site cookie policy.
- Production initial-setup writes are disabled. Full backups retain password hashes and personal data; protect exported archives. API keys, OAuth client secrets and active sessions are excluded from exports.

## Checks

Run `../check.sh` from this directory, or `./check.sh` from the project root, for format/lint/type checks, unit tests, builds and dependency audits.

Run `bun run test:security` for the real authentication regression suite. It creates disposable PostgreSQL and Redis containers on random loopback ports, uses synthetic records, disables external email/OAuth traffic, and removes its containers on exit. Docker is required. The suite refuses the default Redis port or a database without the `leiblog_test_` prefix to prevent accidental testing against development data.

Transport limits: JSON/text requests 2 MiB; multipart uploads configured file size plus 1 MiB overhead; backup requests 65 MiB. Backup archives allow 64 MiB compressed, 256 MiB expanded, 64 MiB per entry, 16 MiB JSON and 10,000 entries.
