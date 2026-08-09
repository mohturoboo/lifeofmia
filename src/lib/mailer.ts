import { env, isSmtpConfigured } from '@/lib/env';

/**
 * Envoi d'emails transactionnels.
 *
 * Sans SMTP configure (cas du developpement), le message est ecrit dans la
 * console du serveur : le lien de verification ou de reinitialisation reste
 * donc utilisable immediatement, sans dependance externe.
 *
 * `nodemailer` est charge dynamiquement pour ne pas alourdir le bundle quand
 * l'envoi reel n'est pas active.
 */

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendMail(message: MailMessage): Promise<void> {
  if (!isSmtpConfigured()) {
    console.info(
      [
        '',
        '─────────────── EMAIL (mode developpement) ───────────────',
        `A       : ${message.to}`,
        `Sujet   : ${message.subject}`,
        '',
        message.text,
        '──────────────────────────────────────────────────────────',
        '',
      ].join('\n'),
    );
    return;
  }

  try {
    const { createTransport } = await import('nodemailer');
    const transport = createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpPort === 465,
      auth: { user: env.smtpUser, pass: env.smtpPassword },
    });
    await transport.sendMail({ from: env.emailFrom, ...message });
  } catch (error) {
    // Un email qui echoue ne doit jamais faire echouer l'inscription.
    console.error('[mailer] envoi impossible', error);
  }
}

/**
 * Gabarit d'email aux couleurs de la marque : noir et rose bebe.
 *
 * Les polices de la marque ne sont pas chargeables dans un client mail ; on
 * s'appuie donc sur une pile serif systeme pour le titre, qui conserve le
 * registre editorial, et sur une sans-serif systeme pour le corps.
 */
function layout(title: string, body: string, ctaLabel?: string, ctaUrl?: string): string {
  return `<!doctype html><html><body style="margin:0;background:#000000;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#ffffff">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:48px 16px">
<table width="100%" style="max-width:520px;background:#0b0b0b;border:1px solid #1e1e1e;border-radius:14px;overflow:hidden">
<tr><td style="padding:36px 36px 8px">
<div style="font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:500;letter-spacing:0.02em">LifeofM</div>
<div style="height:1px;width:56px;background:linear-gradient(90deg,#fbc7da,transparent);margin:14px 0 28px"></div>
<h1 style="margin:0 0 14px;font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:500;letter-spacing:-0.01em">${title}</h1>
<div style="font-size:15px;line-height:1.65;color:#b4b4b4">${body}</div>
${
  ctaUrl
    ? `<div style="margin:30px 0 8px"><a href="${ctaUrl}" style="display:inline-block;background:linear-gradient(135deg,#fddced,#fbc7da 46%,#f8b0c9);color:#0a0a0a;text-decoration:none;padding:13px 28px;border-radius:10px;font-weight:600;font-size:14px;letter-spacing:0.03em">${ctaLabel}</a></div>
       <div style="font-size:12px;color:#7a7a7a;margin-top:18px;word-break:break-all">Ou copiez ce lien : ${ctaUrl}</div>`
    : ''
}
</td></tr>
<tr><td style="padding:26px 36px 34px;font-size:12px;line-height:1.6;color:#7a7a7a;border-top:1px solid #1e1e1e">
Vous recevez cet email car un compte LifeofM est associe a cette adresse. Si vous n'etes pas a l'origine de cette demande, ignorez ce message.
</td></tr></table></td></tr></table></body></html>`;
}

export function verificationEmail(to: string, firstName: string, token: string): MailMessage {
  const url = `${env.appUrl}/verify-email?token=${encodeURIComponent(token)}`;
  return {
    to,
    subject: 'Confirmez votre adresse email — LifeofM',
    html: layout(
      `Bienvenue ${firstName} !`,
      "Il ne reste qu'une etape : confirmez votre adresse email pour activer votre espace personnel. Ce lien expire dans 24 heures.",
      'Confirmer mon email',
      url,
    ),
    text: `Bienvenue ${firstName} !\n\nConfirmez votre adresse email : ${url}\n\nCe lien expire dans 24 heures.`,
  };
}

export function passwordResetEmail(to: string, firstName: string, token: string): MailMessage {
  const url = `${env.appUrl}/reset-password?token=${encodeURIComponent(token)}`;
  return {
    to,
    subject: 'Reinitialisation de votre mot de passe — LifeofM',
    html: layout(
      `Bonjour ${firstName}`,
      'Vous avez demande la reinitialisation de votre mot de passe. Ce lien est valable une heure et ne peut servir qu\'une seule fois.',
      'Choisir un nouveau mot de passe',
      url,
    ),
    text: `Bonjour ${firstName},\n\nReinitialisez votre mot de passe : ${url}\n\nCe lien expire dans 1 heure.`,
  };
}
