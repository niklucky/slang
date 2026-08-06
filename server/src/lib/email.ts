import { env } from '../env.js';

const RESEND_URL = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'Slang <onboarding@resend.dev>';
/** Dev default: the Vite web server (the API port only serves the built UI). */
const DEFAULT_PUBLIC_URL = 'http://localhost:5800';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function publicUrl(): string {
  return (env.PUBLIC_URL ?? '').replace(/\/+$/, '') || DEFAULT_PUBLIC_URL;
}

/** Loose shape check, good enough for invitation targeting. */
export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export interface InvitationEmailInput {
  to: string;
  key: string;
  projectName: string;
  inviterName: string;
}

/**
 * Sends through the Resend HTTP API. Returns false when RESEND_API_KEY is
 * unset (local dev without email); throws when the API rejects the request.
 */
export async function sendInvitationEmail(input: InvitationEmailInput): Promise<boolean> {
  if (!env.RESEND_API_KEY) {
    console.warn(`RESEND_API_KEY is not set; skipping invitation email to ${input.to}`);
    return false;
  }

  const link = `${publicUrl()}/register?key=${encodeURIComponent(input.key)}`;
  const projectName = escapeHtml(input.projectName);
  const inviterName = escapeHtml(input.inviterName);
  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:32px 16px;color:#18181b">
  <p style="font-size:15px;line-height:1.6">${inviterName} invited you to join the project <strong>${projectName}</strong> on Slang.</p>
  <p style="margin:24px 0">
    <a href="${link}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 20px;border-radius:8px">Accept invitation</a>
  </p>
  <p style="font-size:13px;color:#71717a;line-height:1.6">Or open this link in your browser:<br/><a href="${link}" style="color:#71717a">${link}</a></p>
  <p style="font-size:13px;color:#71717a">The invitation expires in 24 hours.</p>
</div>`.trim();

  const response = await fetch(RESEND_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM || DEFAULT_FROM,
      to: [input.to],
      subject: `${input.inviterName} invited you to "${input.projectName}" on Slang`,
      html,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`resend_error: ${response.status} ${body}`);
  }
  return true;
}
