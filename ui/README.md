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

Create an EmailJS email template with `to_email` as the recipient address and
the variables `app_name` and `verification_url` in the message body. A ready-
to-copy HTML template is in `server/email-templates/verification.html`. Then
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
cookie. All verified accounts currently share the existing crawler workspace;
authentication does not assign crawler records to individual accounts.

When running with Docker Compose, set the same authentication and EmailJS
variables in the repository-root `.env` file. Use HTTPS with
`AUTH_COOKIE_SECURE=true`; for a cross-site UI/API deployment, also set
`AUTH_COOKIE_SAME_SITE=none`.

## Schedule crawls

In the crawler dialog, enter a five-field cron expression to enable scheduled
crawls, for example `0 9 * * *` to run every day at 09:00 in the server's local
time. Leave the field empty to disable scheduling. A scheduled crawler must
have at least one selector matching its selector type. Schedules are saved with
the crawler and restored when the server starts.

## Run the full application with Docker

From the repository root, run `docker compose up --build`. Open the UI at
`http://localhost:8080`; the API is available at `http://localhost:4000`.
MongoDB data is stored in the `mongo-data` Docker volume. Stop the services with
`docker compose down`.
