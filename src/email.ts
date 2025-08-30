// src/email.ts
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const notificationEmail = process.env.NOTIFICATION_EMAIL || 'mohfey@gmail.com';

export type MailOptions = {
  subject: string;
  text?: string;
  html?: string;
  to?: string;
};

type MaybeTransporter = nodemailer.Transporter;

let transporterPromise: Promise<MaybeTransporter> | null = null;

async function createTransporter(): Promise<MaybeTransporter> {
  // If SMTP is configured via env, use it.
  const host = process.env.SMTP_HOST?.trim();
  if (host) {
    const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
    const secure = (process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
    const user = (process.env.SMTP_USER || '').trim();
    const pass = (process.env.SMTP_PASS || '').trim();

    if (!user || !pass) {
      console.warn('SMTP_HOST is set but SMTP_USER or SMTP_PASS is missing. This will likely fail authentication.');
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    });

    // Verify transporter connection early (helpful for fast failure)
    try {
      await transporter.verify();
      console.log('SMTP transporter verified.');
    } catch (verifyErr: any) {
      console.warn('Warning: SMTP transporter verification failed (check credentials/network).', verifyErr?.message || verifyErr);
      // still return transporter — sendMail will show a more specific error if it fails
    }

    return transporter;
  }

  // Otherwise create an Ethereal test account (development only)
  console.log('No SMTP_HOST configured — creating an Ethereal test account for development (emails are not delivered).');
  const testAccount = await nodemailer.createTestAccount();

  const ethTransporter = nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: { user: testAccount.user, pass: testAccount.pass },
  });

  // no need to verify Ethereal usually
  return ethTransporter;
}

async function getTransporter(): Promise<MaybeTransporter> {
  if (!transporterPromise) {
    transporterPromise = createTransporter();
  }
  return transporterPromise;
}

export async function sendMail(opts: MailOptions) {
  const transporter = await getTransporter();
  const to = (opts.to || notificationEmail).trim();

  // Use a sane default `from` header — prefer explicit FROM_EMAIL or fallback to SMTP_USER or notification email
  const from =
    (process.env.FROM_EMAIL?.trim()) ||
    (process.env.SMTP_USER?.trim()) ||
    `no-reply@${process.env.SMTP_HOST ? (new URL(`http://${process.env.SMTP_HOST}`).hostname || 'example.com') : 'example.com'}`;

  try {
    const info = await transporter.sendMail({
      from: `"Website Contact" <${from}>`,
      to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    });

    // If using Ethereal, log preview URL
    const preview = nodemailer.getTestMessageUrl(info);
    if (preview) {
      console.log('Ethereal preview URL:', preview);
    }

    console.log(`Email sent: ${info.messageId} -> ${to}`);
    return info;
  } catch (err: any) {
    console.error('sendMail error:', err?.message || err);
    throw err;
  }
}
