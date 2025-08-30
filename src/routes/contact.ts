// src/routes/contact.ts
import { Router, Request, Response } from 'express';
import { sendMail } from '../email';

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
      return res.status(400).json({ ok: false, error: 'name, email and message are required' });
    }

    // basic subject sanitization / fallback
    const subject = `[Contact] ${ (subjectRaw || 'New message').slice(0, 200) }${project ? ' — ' + project : ''}`;

    // build HTML email safely
    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safePhone = phone ? escapeHtml(phone) : '';
    const safeProject = project ? escapeHtml(project) : '';
    const safeMessageHtml = escapeHtml(message).replace(/\n/g, '<br/>');

    const html = `
      <h2>New contact form submission</h2>
      <p><strong>Name:</strong> ${safeName}</p>
      <p><strong>Email:</strong> ${safeEmail}</p>
      ${safePhone ? `<p><strong>Phone:</strong> ${safePhone}</p>` : ''}
      ${safeProject ? `<p><strong>Project:</strong> ${safeProject}</p>` : ''}
      <hr/>
      <p>${safeMessageHtml}</p>
    `;

    await sendMail({ subject, html, text: message });

    await sendMail({
      to: email, // 👈 send back to the user
      subject: "Thanks for contacting us!",
      html: `<p>Hi ${name || "there"},</p>
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
