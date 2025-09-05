// src/routes/contact.ts
import { Router, Request, Response } from 'express';
import { sendMail } from '../email';
import dns from 'dns/promises';

const router = Router();

type ContactPayload = {
  name?: string;
  email?: string;
  phone?: string;
  subject?: string;
  message?: string;
  project?: string;
};

function escapeHtml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Email acceptance checks (same logic used for subscribe route)
 * Returns { ok: true } or { ok: false, reason: string }
 */
async function isAcceptableEmail(email: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const raw = (email || '').trim();
  if (!raw) return { ok: false, reason: 'empty email' };

  const simpleEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!simpleEmailRegex.test(raw)) return { ok: false, reason: 'invalid format' };

  const [localPart, domainPart] = raw.split('@');
  if (!localPart || !domainPart) return { ok: false, reason: 'invalid format' };

  if (localPart.length > 64) return { ok: false, reason: 'local part too long' };
  if (domainPart.length > 255) return { ok: false, reason: 'domain too long' };

  if (localPart.startsWith('.') || localPart.endsWith('.') || localPart.includes('..')) {
    return { ok: false, reason: 'invalid local' };
  }
  if (domainPart.startsWith('-') || domainPart.endsWith('-') || domainPart.includes('..')) {
    return { ok: false, reason: 'invalid domain' };
  }

  const lowerLocal = localPart.toLowerCase();
  const lowerDomain = domainPart.toLowerCase();

  const exampleDomains = new Set([
    'example.com',
    'example.org',
    'example.net',
    'example.co',
    'example'
  ]);
  if (exampleDomains.has(lowerDomain) || lowerDomain.includes('example')) {
    return { ok: false, reason: 'blocked domain (example)' };
  }

  const disposableDomains = new Set([
    'mailinator.com',
    '10minutemail.com',
    'temp-mail.org',
    'tempmail.net',
    'yopmail.com',
    'guerrillamail.com',
    'maildrop.cc',
    'getnada.com',
    'trashmail.com',
    'dispostable.com',
    'trashmail.net',
    'mailnesia.com',
    'temp-mail.io',
    'spamgourmet.com',
    'mintemail.com',
    'mail-temporaire.fr',
    'caainpt.com'
  ]);
  if (disposableDomains.has(lowerDomain)) {
    return { ok: false, reason: 'disposable email provider' };
  }

  const blockedLocalExact = new Set([
    'admin',
    'administrator',
    'postmaster',
    'hostmaster',
    'webmaster',
    'info',
    'support',
    'sales',
    'contact',
    'abuse',
    'security',
    'noreply',
    'no-reply',
    'notifications',
    'mailer-daemon',
    'root',
    'test',
    'example',
    'null',
    'dummy'
  ]);
  if (blockedLocalExact.has(lowerLocal)) {
    return { ok: false, reason: 'role or test account blocked' };
  }

  if (/^test\d*$/i.test(lowerLocal) || lowerLocal.includes('test') || lowerLocal.includes('dummy')) {
    return { ok: false, reason: 'test/dummy address blocked' };
  }

  if (/^\d+$/.test(lowerDomain.replace(/\./g, ''))) {
    return { ok: false, reason: 'suspicious domain' };
  }

  const shouldCheckMx = process.env.MX_CHECK === 'true';
  if (shouldCheckMx) {
    try {
      const mx = await dns.resolveMx(domainPart);
      if (!mx || mx.length === 0) {
        const a = await dns.resolve(domainPart, 'A').catch(() => []);
        const aaaa = await dns.resolve(domainPart, 'AAAA').catch(() => []);
        if ((!a || a.length === 0) && (!aaaa || aaaa.length === 0)) {
          return { ok: false, reason: 'no mail servers for domain (MX/A/AAAA missing)' };
        }
      }
    } catch (e) {
      return { ok: false, reason: 'domain verification failed' };
    }
  }

  return { ok: true };
}

// Map internal reasons to friendly UI messages + stable codes
function userMessageForReason(reason: string) {
  const r = (reason || '').toLowerCase();

  if (r.includes('empty')) {
    return { code: 'email_missing', message: 'Please enter your email address.', field: 'email' };
  }
  if (r.includes('invalid format') || r.includes('invalid local') || r.includes('invalid domain')) {
    return { code: 'email_invalid_format', message: "That email address doesn't look right — please check and try again.", field: 'email' };
  }
  if (r.includes('local part too long') || r.includes('domain too long')) {
    return { code: 'email_too_long', message: 'That email address is too long. Try a shorter address.', field: 'email' };
  }
  if (r.includes('blocked domain') || r.includes('example')) {
    return { code: 'email_blocked_domain', message: "We don't accept addresses from that domain. Please use a different email.", field: 'email' };
  }
  if (r.includes('disposable') || r.includes('temporary') || r.includes('temp')) {
    return { code: 'email_disposable', message: "Temporary/disposable email addresses aren't accepted. Please use an address you check regularly.", field: 'email' };
  }
  if (r.includes('role') || r.includes('test') || r.includes('dummy') || r.includes('role or test')) {
    return { code: 'email_role_or_test', message: "Please enter a personal email address (not 'admin', 'info', or 'test').", field: 'email' };
  }
  if (r.includes('no mail servers') || r.includes('domain verification failed')) {
    return { code: 'email_domain_unverified', message: "We couldn't verify that email's domain. Please check your email or try another address.", field: 'email' };
  }

  return { code: 'email_unacceptable', message: "We can't send a confirmation to that email address. Please try a different one.", field: 'email' };
}

router.post('/contact', async (req: Request, res: Response) => {
  try {
    const body = req.body as ContactPayload;
    const name = (body.name ?? '').toString().trim();
    const email = (body.email ?? '').toString().trim();
    const message = (body.message ?? '').toString().trim();
    const phone = body.phone ? body.phone.toString().trim() : undefined;
    const subjectRaw = body.subject ? body.subject.toString().trim() : '';
    const project = body.project ? body.project.toString().trim() : undefined;

    if (!name || !email || !message) {
      return res.status(400).json({ ok: false, code: 'missing_fields', message: 'Name, email and message are required.', field: 'email' });
    }

    // run the email acceptance checks BEFORE sending anything
    const check = await isAcceptableEmail(email);
    if (!check.ok) {
      const userMsg = userMessageForReason(check.reason || '');
      return res.status(422).json({
        ok: false,
        code: userMsg.code,
        message: userMsg.message,
        field: userMsg.field,
        // reason: check.reason // optional: include for debugging; remove if you don't want internal reasons exposed
      });
    }

    // basic subject sanitization / fallback
    const subject = `[Contact] ${ (subjectRaw || 'New message').slice(0, 200) }${project ? ' — ' + project : ''}`;

    // build HTML email safely
    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safePhone = phone ? escapeHtml(phone) : '';
    const safeProject = project ? escapeHtml(project) : '';
    const safeSubject = escapeHtml(subjectRaw || '');
    const safeMessageHtml = escapeHtml(message).replace(/\n/g, '<br/>');

    const html = `
      <h2>New contact form submission</h2>
      <p><strong>Subject:</strong> ${safeSubject}</p>
      <p><strong>Name:</strong> ${safeName}</p>
      <p><strong>Email:</strong> ${safeEmail}</p>
      ${safePhone ? `<p><strong>Phone:</strong> ${safePhone}</p>` : ''}
      ${safeProject ? `<p><strong>Project:</strong> ${safeProject}</p>` : ''}
      <hr/>
      <p>${safeMessageHtml}</p>
    `;

    // Admin notification
    await sendMail({ subject, html, text: message });

    // Autoresponder to sender
    await sendMail({
      to: email,
      subject: 'Thanks for contacting us!',
      html: `<p>Hi ${escapeHtml(name) || 'there'},</p>
             <p>I received your message and I'll get back to you soon.</p>
             <p>Best regards,<br/>Mofetoluwa</p>`
    });

    return res.json({ ok: true });
  } catch (err: any) {
    console.error('contact error', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Failed to send' });
  }
});

export default router;
