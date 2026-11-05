import nodemailer from 'nodemailer';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mailCredential } from '../../core/config/env.config';

type TransportFactory = (options: any) => { sendMail: (payload: any) => Promise<any> };
const unavailable = () => Object.assign(new Error('Verification email could not be delivered. Please try again later.'),
  { status: 503, code: 'TWO_STEP_UNAVAILABLE' });

export function renderTwoStepLoginEmail(code: string): { text: string; html: string } {
  // The only dynamic HTML value is restricted to four digits, so it cannot
  // introduce markup. Do not interpolate recipient data or challenge tokens.
  if (!/^\d{4}$/.test(code)) throw unavailable();
  const template = readFileSync(join(__dirname, '../../public/twoStepLogin.template.html'), 'utf8');
  return {
    text: `Your Presage CMMS login verification code is ${code}. Enter it on the sign-in screen. It expires in five minutes. Do not share this code with anyone. If you did not request this sign-in, you can ignore this email.`,
    html: template.replace(/\{\{CODE\}\}/g, code)
  };
}

export function createTwoStepMailer(createTransport: TransportFactory = nodemailer.createTransport) {
  return {
    async send(email: string, code: string): Promise<void> {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !/^\d{4}$/.test(code)) throw unavailable();
      try {
        const message = renderTwoStepLoginEmail(code);
        // Avoid the legacy mailer, which accepts unverified certificates and
        // writes message bodies/SMTP responses to mail_logs.
        const transporter = createTransport({
          host: mailCredential.host, port: mailCredential.port,
          secure: mailCredential.port === 465, requireTLS: true,
          tls: { rejectUnauthorized: true, minVersion: 'TLSv1.2' },
          auth: { user: mailCredential.user, pass: mailCredential.pass },
          logger: false, debug: false, disableFileAccess: true, disableUrlAccess: true,
          connectionTimeout: 15_000, greetingTimeout: 15_000, socketTimeout: 30_000
        });
        const info = await transporter.sendMail({
          from: `Presage Insights <${mailCredential.from}>`, to: email,
          subject: 'Your Presage CMMS login verification code',
          ...message,
          sensitive: true
        });
        const accepted = Array.isArray(info?.accepted) && info.accepted.some((recipient: any) =>
          String(typeof recipient === 'string' ? recipient : recipient?.address).toLowerCase() === email.toLowerCase());
        if (!accepted || (Array.isArray(info?.rejected) && info.rejected.length)) throw unavailable();
      } catch {
        // Never retain or log SMTP exceptions: they may contain credentials or code.
        throw unavailable();
      }
    }
  };
}

export const twoStepMailer = createTwoStepMailer();
