# Local LAN HTTPS

ALTCHA requires a browser secure context. HTTP localhost works on the server computer, but another device visiting a LAN HTTP address needs HTTPS.

## Start

Install Bun, Docker and mkcert (`brew install mkcert` on macOS), then run from the repository root:

```bash
bash start-https.sh 192.168.3.125
```

Omit the IP to detect a private IPv4 address automatically. The HTTPS frontend listens on port 5175 and reuses a healthy backend on port 3000. Existing HTTP development servers are left running. API and upload requests use the same HTTPS origin; ALTCHA verification remains enabled.

The script generates a dedicated local CA and server certificate under `~/.local/share/leiblog/dev-https`, outside the repository. It does not install a system root certificate. Never distribute `ca/rootCA-key.pem` or `server-key.pem`.

## Trust The Public Certificate

On each phone or other computer, install only the public `ca/rootCA.pem` certificate. If the HTTP development server is running, it is also available at:

```text
http://192.168.3.125:5174/__dev/leiblog-local-ca.crt
```

Compare the certificate SHA-256 fingerprint with the value printed on the server computer before trusting it. The download endpoint is development-only and returns only the parsed public certificate in DER format, never private keys.

- Windows: import the certificate into Trusted Root Certification Authorities for the current user, then restart the browser.
- iOS/iPadOS: install the certificate profile, then enable full trust under Settings > General > About > Certificate Trust Settings.
- Android: install it as a CA certificate in the device's certificate/security settings. A screen lock and a managed-device policy may be required. Browser trust depends on the browser and device policy.

Then open `https://192.168.3.125:5175/admin/`. The browser must trust the certificate without a certificate warning for secure-context APIs to work reliably. Do not disable browser security or bypass ALTCHA.

The CA grants local certificate-signing authority on devices that trust it. Keep its private key private, use it only on your own development devices, and remove the trusted certificate when no longer needed.

If `CORS_ORIGINS` is explicitly configured for the backend, add the exact HTTPS development origin and restart the backend. Default development origins already include private LAN HTTPS on port 5175; production still requires its own explicit HTTPS origins.
