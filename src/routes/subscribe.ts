// src/routes/subscribe.ts
import { Router, Request, Response } from 'express';
import { sendMail } from '../email';
import dns from 'dns/promises';

const router = Router();

type SubscribePayload = {
  email?: string;
  project?: string;
  name?: string;
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
 * Return { ok: true } or { ok: false, reason: '...' }
 * - performs: format checks, length limits, role-address checks, example/blocklist checks,
 *   disposable-domain checks, and optional MX lookup (enable with MX_CHECK=true).
 */
async function isAcceptableEmail(email: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const raw = (email || '').trim();
  if (!raw) return { ok: false, reason: 'empty email' };

  // Basic RFC-ish sanity check (simple and practical)
  const simpleEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!simpleEmailRegex.test(raw)) return { ok: false, reason: 'invalid format' };

  const [localPart, domainPart] = raw.split('@');
  if (!localPart || !domainPart) return { ok: false, reason: 'invalid format' };

  // length limits
  if (localPart.length > 64) return { ok: false, reason: 'local part too long' };
  if (domainPart.length > 255) return { ok: false, reason: 'domain too long' };

  // no leading/trailing/consecutive dots in local or domain
  if (localPart.startsWith('.') || localPart.endsWith('.') || localPart.includes('..')) {
    return { ok: false, reason: 'invalid local part' };
  }
  if (domainPart.startsWith('-') || domainPart.endsWith('-') || domainPart.includes('..')) {
    return { ok: false, reason: 'invalid domain' };
  }

  const lowerLocal = localPart.toLowerCase();
  const lowerDomain = domainPart.toLowerCase();

  // Block example domains and obvious test domains
  const exampleDomains = new Set([
    'example.com',
    'example.org',
    'example.net',
    'example.co',
    'example' // defensive
  ]);
  if (exampleDomains.has(lowerDomain) || lowerDomain.includes('example')) {
    return { ok: false, reason: 'blocked domain (example)' };
  }

  // Common disposable / throwaway domains (curated - not exhaustive)
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

  // Role accounts — often not real personal addresses (block by default)
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

  // If local part looks like "test123" or contains "test" or "dummy"
  if (/^test\d*$/i.test(lowerLocal) || lowerLocal.includes('test') || lowerLocal.includes('dummy')) {
    return { ok: false, reason: 'test/dummy address blocked' };
  }

  // If domain looks like a temporary hostname (numbers-only TLD-like patterns)
  if (/^\d+$/.test(lowerDomain.replace(/\./g, ''))) {
    return { ok: false, reason: 'suspicious domain' };
  }

  // Optional MX check (enable by setting MX_CHECK=true in environment).
  // If MX_CHECK is 'true', we will attempt to resolve MX records and fail if none exist.
  // This step is best-effort: network/DNS errors will be treated as "cannot verify" and we will fail closed.
  const shouldCheckMx = process.env.MX_CHECK === 'true';
  if (shouldCheckMx) {
    try {
      const mx = await dns.resolveMx(domainPart);
      if (!mx || mx.length === 0) {
        // fallback: try A/AAAA records
        const a = await dns.resolve(domainPart, 'A').catch(() => []);
        const aaaa = await dns.resolve(domainPart, 'AAAA').catch(() => []);
        if ((!a || a.length === 0) && (!aaaa || aaaa.length === 0)) {
          return { ok: false, reason: 'no mail servers for domain (MX/A/AAAA missing)' };
        }
      }
    } catch (e) {
      // DNS resolution failed — treat as unacceptable (fail closed).
      return { ok: false, reason: 'domain verification failed' };
    }
  }

  return { ok: true };
}

// Map internal reasons to friendly messages and stable machine codes
function userMessageForReason(reason: string) {
  const r = (reason || '').toLowerCase();

  if (r.includes('empty')) {
    return {
      code: 'email_missing',
      message: 'Please enter your email address.',
      field: 'email'
    };
  }
  if (r.includes('invalid format') || r.includes('invalid local') || r.includes('invalid domain') || r.includes('invalid format')) {
    return {
      code: 'email_invalid_format',
      message: 'That email address doesn\'t look right — please check and try again.',
      field: 'email'
    };
  }
  if (r.includes('local part too long') || r.includes('domain too long')) {
    return {
      code: 'email_too_long',
      message: 'That email address is too long. Try a shorter address.',
      field: 'email'
    };
  }
  if (r.includes('blocked domain') || r.includes('example')) {
    return {
      code: 'email_blocked_domain',
      message: "We don't accept addresses from that domain. Please use a different email.",
      field: 'email'
    };
  }
  if (r.includes('disposable') || r.includes('temporary') || r.includes('temp')) {
    return {
      code: 'email_disposable',
      message: "Temporary/disposable email addresses aren't accepted. Please use a real address you check regularly.",
      field: 'email'
    };
  }
  if (r.includes('role') || r.includes('test') || r.includes('dummy') || r.includes('role or test')) {
    return {
      code: 'email_role_or_test',
      message: "Please enter a personal email address (not 'admin', 'info', or 'test').",
      field: 'email'
    };
  }
  if (r.includes('no mail servers') || r.includes('domain verification failed')) {
    return {
      code: 'email_domain_unverified',
      message: "We couldn't verify the email's domain. Please check your email or try another address.",
      field: 'email'
    };
  }

  // Fallback generic message
  return {
    code: 'email_unacceptable',
    message: "We can't send a confirmation to that email address. Please try a different one.",
    field: 'email'
  };
}

router.post('/subscribe', async (req: Request, res: Response) => {
  try {
    const body = req.body as SubscribePayload;
    const email = (body.email ?? '').toString().trim();
    const project = body.project ? body.project.toString().trim() : '';
    const name = body.name ? body.name.toString().trim() : '';

    if (!email) {
      return res.status(400).json({ ok: false, error: 'email is required' });
    }

    // run the acceptance checks
    const check = await isAcceptableEmail(email);
    if (!check.ok) {
      const userMsg = userMessageForReason(check.reason || '');
      return res.status(422).json({
        ok: false,
        code: userMsg.code,
        message: userMsg.message,
        field: userMsg.field,
        // include raw reason only in non-production for debugging
        ...(process.env.NODE_ENV !== 'production' ? { reason: check.reason } : {})
      });
    }

    const subject = `[Subscribe] New subscriber${project ? ' — ' + project : ''}`.slice(0, 200);

    const safeEmail = escapeHtml(email);
    const safeName = name ? escapeHtml(name) : '';
    const safeProject = project ? escapeHtml(project) : '';

    const html = `
      <h2>New subscription</h2>
      <p><strong>Email:</strong> ${safeEmail}</p>
      ${safeName ? `<p><strong>Name:</strong> ${safeName}</p>` : ''}
      ${safeProject ? `<p><strong>Project:</strong> ${safeProject}</p>` : ''}
    `;

    // Admin notification (you can remove this if you don't want failed attempts logged to admin)
    await sendMail({ subject, html, text: `New subscriber: ${email}` });

    // Confirmation email to subscriber
    await sendMail({
      to: email,
      subject: 'Subscription Confirmed',
      html: `<p>Thank you for subscribing to my newsletter!</p>`
    });

    return res.json({ ok: true });
  } catch (err: any) {
    console.error('subscribe error', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Failed to send' });
  }
});

export default router;
