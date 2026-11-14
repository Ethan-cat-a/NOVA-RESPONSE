# NOVA RESPONSE

NOVA RESPONSE is an installable, self-hosted Outlook inbox app. It uses **NOVA V8** at https://nova-v8.vercel.app/api/chat to draft replies. The app imports Outlook inbox messages, automatically drafts replies for exact allowlisted senders, and leaves every send action for you to approve.

## Features

- Outlook inbox and Microsoft Graph sign-in using device code.
- Automatic inbox and draft sync every 60 seconds while the app server is running.
- NOVA V8 reply drafts for senders in your exact ALLOWED_SENDERS list.
- Replies remain editable and are sent only after you click **Send reply**.
- Installable PWA with automatic shell updates when a new app version is published.
- API responses and mail are never cached by the service worker.
- Demo inbox when no Outlook account is connected.

## Run locally

Requires Node.js 22 or later.

    npm install
    cp .env.example .env
    npm start

Open http://localhost:3000, open **Settings**, and connect Outlook. You can install the app from the browser’s **Install app** button when the browser supports PWA installation. Localhost is treated as a secure origin for app installation.

## Connect NOVA V8

The default endpoint is https://nova-v8.vercel.app/api/chat and the default mode is fast. Set NOVA_V8_API_KEY only if your NOVA V8 deployment requires a key. The key stays in the local .env file and is sent only from the server to NOVA V8.

## Connect Outlook

1. In the [Microsoft Entra admin center](https://entra.microsoft.com/), register a public client application that supports the account types you use.
2. Enable public client flows for the registration.
3. Add these **delegated** Microsoft Graph permissions: User.Read, Mail.ReadWrite, and Mail.Send.
4. Copy the application (client) ID into MICROSOFT_CLIENT_ID in .env.
5. Set exact addresses in ALLOWED_SENDERS, then restart the server.
6. In NOVA RESPONSE Settings, click **Connect Outlook** and enter the Microsoft device code.

MSAL stores its token cache using the operating system’s protected credential service: Keychain on macOS, DPAPI on Windows, and Secret Service/LibSecret on Linux. Linux must have a Secret Service provider available; the app does not fall back to a plaintext token cache.

## Environment variables

| Variable | Purpose |
| --- | --- |
| NOVA_V8_API_URL | NOVA V8 API endpoint; defaults to https://nova-v8.vercel.app/api/chat |
| NOVA_V8_API_KEY | Optional server-side credential, if the NOVA V8 endpoint requires it |
| NOVA_V8_MODE | NOVA V8 generation mode; defaults to fast |
| MICROSOFT_CLIENT_ID | Microsoft Entra public client application ID |
| MICROSOFT_AUTHORITY | Entra authority; defaults to common for personal and work/school accounts |
| ALLOWED_SENDERS | Exact comma-separated addresses whose email content may be sent to NOVA V8 |
| REPLY_TONE | Tone guidance for generated replies |
| BUSINESS_CONTEXT | Factual context for generated replies |
| DASHBOARD_PASSWORD | Optional local dashboard password; required for non-loopback HOST |
| HOST / PORT | Bind address and port; default is 127.0.0.1:3000 |

## Automatic updates

While the NOVA RESPONSE server is running, it syncs Outlook every minute. The installed PWA checks for a new app shell every five minutes while open. When a new version is published, the service worker installs it and reloads the app automatically. A stopped local server cannot sync mail or retrieve app updates.

For public or shared hosting, use HTTPS and set a strong DASHBOARD_PASSWORD. Do not deploy this local JSON store to an ephemeral serverless filesystem: Outlook sign-in cache and inbox data need persistent storage. The repository does not include deployment credentials or mailbox tokens.

## Safety and privacy

- Only exact addresses in ALLOWED_SENDERS have their message bodies retrieved for NOVA V8.
- Untrusted email content is framed as data. The model has no tools and is told to ignore instructions embedded in messages.
- AI output is never sent automatically. The app uses Microsoft Graph to create and send a reply only after a user action.
- Messages and local state are stored in data/emails.json, which is ignored by Git.
- Keep .env private. It is ignored by Git.

## License

MIT
