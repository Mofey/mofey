# Node/Express TypeScript Email Backend (No DB)

This project is a small Express + TypeScript backend that accepts contact form and subscription requests from multiple frontend projects and forwards them as emails using **nodemailer**. No database is required.

## Features
- `POST /api/contact` — send contact form submissions
- `POST /api/subscribe` — send newsletter subscription notifications
- No database; uses **nodemailer** to forward emails to a notification address (default: `mohfey@gmail.com`)
- Configurable SMTP via environment variables (recommended) or an Ethereal test account for local testing
- CORS support (configurable)
- Basic rate-limiting and security headers

## Quick start

1. Copy `.env.example` to `.env` and fill in your SMTP credentials (or leave blank to use Ethereal for testing).
2. Install deps:
   ```bash
   npm install
   ```
3. Run in development:
   ```bash
   npm run dev
   ```
   or build + start:
   ```bash
   npm run build
   npm start
   ```
4. The server listens on `PORT` (default `4000`).

## Environment variables

See `.env.example`. Key settings:
- `NOTIFICATION_EMAIL` — where you want to receive contact/subscribe messages (default `mohfey@gmail.com`)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` — SMTP settings for nodemailer
- `ALLOWED_ORIGINS` — comma-separated allowed origins for CORS

## API

### POST /api/contact
Body (JSON):
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+234 ... (optional)",
  "subject": "Subject text (optional)",
  "message": "Message body",
  "project": "optional-project-id-or-name"
}
```
- `name`, `email`, and `message` are required.
- Responds with `{ ok: true }` on success.

### POST /api/subscribe
Body (JSON):
```json
{
  "email": "john@example.com",
  "project": "optional-project-id-or-name"
}
```
- `email` is required.
- Responds with `{ ok: true }` on success.

## Example frontend fetch (Contact)
```ts
const payload = { name, email, phone, subject, message, project: 'my-site' };
await fetch('https://your-backend.example.com/api/contact', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
```

## Notes & security
- For production, configure a proper SMTP provider (SendGrid, Mailgun, SES, Gmail with App Password, etc.).
- Do **not** commit `.env` with real credentials.
- This backend sends emails directly — consider adding spam protection (CAPTCHA) on the frontend if needed.
