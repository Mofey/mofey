// src/routes/subscribe.ts
import { Router, Request, Response } from 'express';
import { sendMail } from '../email';

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

router.post('/subscribe', async (req: Request, res: Response) => {
  try {
    const body = req.body as SubscribePayload;
    const email = (body.email ?? '').toString().trim();
    const project = body.project ? body.project.toString().trim() : '';
    const name = body.name ? body.name.toString().trim() : '';

    if (!email) {
      return res.status(400).json({ ok: false, error: 'email is required' });
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

    await sendMail({ subject, html, text: `New subscriber: ${email}` });

     await sendMail({
      to: email,
      subject: "Subscription Confirmed",
      html: `<p>Thank you for subscribing to our newsletter!</p>`
    });

    return res.json({ ok: true });
  } catch (err: any) {
    console.error('subscribe error', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Failed to send' });
  }
});

export default router;
