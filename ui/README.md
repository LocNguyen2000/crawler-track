# spiderman-crawler UI

The UI is built with React and Vite.

## Setup

```sh
npm install
```

## Development

```sh
npm run dev
```

## Production build

```sh
npm run build
```

The crawler API is expected at `http://localhost:4000`.

## Accounts and authentication

The application requires a verified account to access crawler APIs. Accounts
are invite-only. From the repository root, configure `EMAILJS_TEMPLATE_ID`,
`EMAILJS_PUBLIC_KEY`, and `EMAILJS_PRIVATE_KEY` in `server/.env` (copy
`server/.env.example` first), set `AUTH_JWT_SECRET` to a random value of at
least 32 bytes, and set `APP_BASE_URL` to the UI origin. The EmailJS service ID
is preconfigured as `service_ywvscwl`.

Create an EmailJS verification template with `to_email` as the recipient
address and the variables `app_name` and `verification_url` in the message
body. A ready-to-copy HTML template is in
`server/email-templates/verification.html`. For scheduled-run notifications,
create a separate EmailJS template and set `EMAILJS_NOTIFICATION_TEMPLATE_ID`.
It receives `to_email`, `crawler_name`, `crawler_code`, `new_data_count`,
`new_data_json`, and `app_name`; a template is in
`server/email-templates/new-data-notification.html`. Then
create a one-time invitation:

```sh
npm run auth:invite -- user@example.com
```

Generate `AUTH_JWT_SECRET` locally with
`node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"`.
Do not commit the generated secret or the EmailJS private key.

The command prints a signup link valid for 72 hours. After signup, the user
must verify the email within 24 hours before signing in. The browser keeps
short-lived access tokens in memory and uses a rotating, HTTP-only refresh
cookie. All verified accounts currently share the existing crawler workspace.
New crawlers are associated with their creator's account for email alerts. An
existing crawler without an owner is associated with the signed-in user the
first time it is edited.

When running with Docker Compose, set the same authentication and EmailJS
variables in the repository-root `.env` file. Use HTTPS with
`AUTH_COOKIE_SECURE=true`; for a cross-site UI/API deployment, also set
`AUTH_COOKIE_SAME_SITE=none`.

## Deploy the backend to Vercel

Create a separate Vercel project for the backend and set its **Root Directory**
to `server`. Vercel detects the Express app exported from `src/index.mjs`; the
function duration is configured in `server/vercel.json`. Deploy the `server`
directory from the repository root with:

```sh
npx vercel --cwd server
npx vercel --cwd server --prod
```

Set these project environment variables in Vercel (Production, Preview, and
Development as needed):

- `MONGODB_URI`: a MongoDB connection string reachable from Vercel.
- `AUTH_JWT_SECRET`: a private random secret of at least 32 bytes.
- `APP_BASE_URL`: the deployed frontend origin, without a trailing path.
- `CORS_ORIGIN`: the exact frontend origin, for example
  `https://your-ui.vercel.app`.
- `EMAILJS_SERVICE_ID`, `EMAILJS_TEMPLATE_ID`,
  `EMAILJS_NOTIFICATION_TEMPLATE_ID`, `EMAILJS_PUBLIC_KEY`, and
  `EMAILJS_PRIVATE_KEY`.
- `AUTH_COOKIE_SECURE=true`.
- `PUPPETEER_SKIP_DOWNLOAD=true` to avoid downloading a local Chrome during
  Vercel builds. The Vercel crawler uses the bundled serverless Chromium.
- `PUPPETEER_HEADLESS=true`.

The UI must be deployed separately (set its Vercel Root Directory to `ui`) with
`VITE_API_BASE_URL` set to the backend deployment origin, such as
`https://your-api.vercel.app`. Rebuild the UI after changing this variable.
Configure `CORS_ORIGIN` and `APP_BASE_URL` to the final UI deployment origin.
If the UI and API are on different sites, also set
`AUTH_COOKIE_SAME_SITE=none`; this requires HTTPS and secure cookies.

Vercel Functions are stateless between invocations: the in-process cron
scheduler is disabled there, and scheduled crawls are rejected. Interactive
selector recording is also unavailable because it requires a visible browser;
enter CSS/XPath selectors manually. Headless crawling is supported, but each
request is subject to Vercel's function duration and package-size limits. Long
crawls or continuous schedules should run on an always-on worker rather than a
Vercel Function.

## Schedule crawls

In the crawler dialog, enter a five-field cron expression to enable scheduled
crawls, for example `0 9 * * *` to run every day at 09:00 in the server's local
time. Leave the field empty to disable scheduling. A scheduled crawler must
have at least one selector matching its selector type. Schedules are saved with
the crawler and restored when the server starts. After a scheduled run discovers
new rows, the server emails the crawler creator's verified account address.

## Run the full application with Docker

From the repository root, run `docker compose up --build`. Open the UI at
`http://localhost:8080`; the API is available at `http://localhost:4000`.
MongoDB data is stored in the `mongo-data` Docker volume. Stop the services with
`docker compose down`.
