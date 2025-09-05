# Hi — I’m **Mofey** 👋  
_Full-stack developer • MERN / PERN • TypeScript • Tailwind CSS • Python • Machine Learning_

This repository (`Mofey/mofey`) is my GitHub **profile README** — a quick snapshot of who I am and a featured utility project I use across my personal sites.

---

# Node / Express TypeScript Email Backend (No DB)

A small, focused Express + TypeScript backend that accepts contact form and subscription requests from multiple frontends and forwards them as email notifications using **nodemailer**. No database required — lightweight and easy to drop into any personal site or static frontend.

## Why this repo
I keep this repo public so visitors can quickly see a working backend I use for contact forms and newsletter signups without needing a full database. It’s simple, secure by default, and easy to configure for production SMTP providers.

## Features
- `POST /api/contact` — receive contact form submissions and forward them as an email
- `POST /api/subscribe` — receive newsletter subscription requests and forward as an email
- No database required — emails are forwarded to a notification address
- Configurable SMTP via environment variables or Ethereal for local testing
- CORS support (configurable)
- Basic rate limiting and security headers included

---

## Quick start

1. Copy `.env.example` → `.env` and add your SMTP credentials (or leave blank to use Ethereal while developing).
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run in development:
   ```bash
   npm run dev
   ```
   or build + start for production:
   ```bash
   npm run build
   npm start
   ```
4. Server listens on `PORT` (`4000` by default).

---

## Environment variables

See `.env.example`. Key settings:

- `NOTIFICATION_EMAIL` — where contact/subscribe messages are sent (default in repo: `mohfey@gmail.com`)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` — SMTP credentials for nodemailer
- `ALLOWED_ORIGINS` — comma-separated list of allowed CORS origins

---

## API

### `POST /api/contact`
**Body (JSON)**:
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
- Responds with `{ "ok": true }` on success.

### `POST /api/subscribe`
**Body (JSON)**:
```json
{
  "email": "john@example.com",
  "project": "optional-project-id-or-name"
}
```
- `email` is required.
- Responds with `{ "ok": true }` on success.

---

## Example frontend fetch (contact)
```ts
const payload = { name, email, phone, subject, message, project: 'my-site' };
await fetch('https://your-backend.example.com/api/contact', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
```

---

## Notes & security
- For production use a reputable SMTP provider (SendGrid, Mailgun, Amazon SES, Gmail with App Password, etc.).
- **Do not** commit real credentials to source control — keep `.env` out of the repo.
- This service forwards emails directly; add frontend spam protection (reCAPTCHA/honeypot) as needed.
- Consider adding message validation and stronger rate limits if public-facing.

---

## Tech & other projects
I primarily work with:
- **MERN / PERN** stacks (MongoDB / Postgres + Express + React + Node)
- **TypeScript** across backend and frontend
- **Tailwind CSS** for UI
- **Python** and **Machine Learning** projects (data pipelines, models, experimentation)

Explore my other repos for examples of React components, full-stack apps, and ML experiments.

---

## Contact & license
- Default notification address in this project: `mohfey@gmail.com` (change via `.env`)
- License: MIT (feel free to reuse or adapt this code — attribution appreciated)

---

Thanks for stopping by — if you like what you see, follow the profile for updates. 🚀

