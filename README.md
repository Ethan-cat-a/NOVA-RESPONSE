# NOVA RESPONSE

NOVA RESPONSE is a small, self-hosted inbox for AI-assisted email replies. It receives messages through Resend, drafts a response with Vercel AI Gateway, and waits for a person to review and send it.

## What it does

- Shows an inbox, message details, and editable reply drafts.
- Accepts inbound messages through a signed Resend `email.received` webhook.
- Checks exact sender addresses against `ALLOWED_SENDERS` before calling the AI model.
- Treats incoming email as untrusted content and gives the model no tools or access to secrets.
- Sends only after a person clicks **Send reply**.
- Includes a sample inbox when credentials are not configured.

## Run locally

Requires Node.js 22 or later.

```sh
npm install
cp .env.example .env
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app starts in demo mode until credentials are configured.

### Configure Vercel AI Gateway

Create an AI Gateway key in Vercel and place it in `.env` as `AI_GATEWAY_API_KEY`. The default model is `amazon/nova-2-lite`, a current, cost-effective Nova model for everyday text drafting. The live Vercel catalog currently lists Nova 2 Lite, Nova Lite, Nova Micro, and Nova Pro; it has no model with the exact name “Nova v8.” `AI_GATEWAY_MODEL` can be changed to any exact `creator/model` ID returned by the [Gateway model list](https://vercel.com/ai-gateway/models).

The app reads `VERCEL_OIDC_TOKEN` as an authentication fallback when the runtime provides it.

### Configure inbound email with Resend

1. Enable receiving for a Resend-provided address or a domain/subdomain.
2. Set `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, and `REPLY_FROM` in `.env`.
3. Add your exact sender addresses to `ALLOWED_SENDERS`, comma-separated.
4. Register a public POST webhook at `/webhook` for the `email.received` event. For local development, expose the app through a stable HTTPS tunnel.
5. Send a message from an allowed address. NOVA RESPONSE creates a draft for review.

`REPLY_FROM` must be a verified sending identity in Resend. Do not expose the dashboard publicly without adding your own authentication and HTTPS protection. The webhook itself verifies Resend signatures against the raw request body.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `AI_GATEWAY_API_KEY` | Local/server AI Gateway authentication |
| `VERCEL_OIDC_TOKEN` | Optional Vercel deployment authentication fallback |
| `AI_GATEWAY_MODEL` | Exact model ID; defaults to `amazon/nova-2-lite` |
| `AI_GATEWAY_BASE_URL` | Gateway URL; defaults to `https://ai-gateway.vercel.sh/v1` |
| `RESEND_API_KEY` | Read inbound email and send replies through Resend |
| `RESEND_WEBHOOK_SECRET` | Verify inbound webhook signatures |
| `REPLY_FROM` | Verified sender identity used for approved replies |
| `ALLOWED_SENDERS` | Comma-separated exact sender addresses allowed for AI processing |
| `BUSINESS_CONTEXT` | Brief factual context for draft generation |
| `REPLY_TONE` | Draft tone guidance |
| `DASHBOARD_PASSWORD` | Optional password for the local dashboard API |
| `HOST` / `PORT` | Server bind address and port; defaults to `127.0.0.1:3000` |

## Security notes

- Keep `.env` private. It is ignored by Git.
- Start with a narrow sender allowlist. Messages from other senders are logged and not sent to the model.
- The model receives only the message metadata and body needed to write a reply. No tools are enabled.
- AI output is always a draft. Sending is a separate, explicit action in the dashboard.
- Local JSON data is stored under `data/` and is ignored by Git.

## License

MIT
