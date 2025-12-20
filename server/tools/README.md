Server tools for secret generation and webhook testing

Files:
- `generate-secret.sh`  - generates a WEBHOOK_SECRET and ADMIN_API_KEY (prints them to stdout)
- `send-signed-webhook.sh` - sends a signed webhook to your backend using `WEBHOOK_SECRET`

Examples:

1) Generate secrets locally (do NOT commit the output):

```bash
./generate-secret.sh
```

2) Export your secret and send a signed webhook (replace with your real URL):

```bash
export WEBHOOK_SECRET=your_secret_here
./send-signed-webhook.sh --url https://your.backend/webhook/claim-processed --body '{"wallet":"0xabc","nonce":1,"txHash":"0x..."}'
```

How HMAC verification works:
- The sender computes HMAC-SHA256 over the **raw request body bytes** using `WEBHOOK_SECRET`.
- The server captures the raw body via Express `verify` callback and recomputes the HMAC.
- This ensures exact byte-for-byte verification, avoiding JSON serialization mismatches.
- The comparison uses `crypto.timingSafeEqual()` to prevent timing attacks.

Security:
- Never commit secrets to git. Use Render dashboard or GitHub Secrets to store values in production.
- `WEBHOOK_SECRET` should only exist on the backend and in the relayer that posts webhooks.
- `ADMIN_API_KEY` should be stored in your ops/admin tooling only.
- Rotate secrets regularly (every 90 days recommended) and after any suspected exposure.
