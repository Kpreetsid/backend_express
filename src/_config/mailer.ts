import nodemailer from 'nodemailer';
import { mailCredential } from '../configDB';
import { IMailLog, MailLogModel, createMailLog } from '../_models/mailLog.model';

const transporter = nodemailer.createTransport({
    host: mailCredential.host,
    port: mailCredential.port,
    secure: mailCredential.secure,
    tls: { rejectUnauthorized: false },
    auth: { user: mailCredential.user, pass: mailCredential.pass }
});

interface MailOptions {
    to: string;
    subject: string;
    html: string;
}

export const sendMail = async ({ to, subject, html }: MailOptions): Promise<void> => {
    const mailLogData: IMailLog = new MailLogModel({ to, subject, html});
    try {
        const info = await transporter.sendMail({ from: `${mailCredential.user}`, to, subject, html });
        mailLogData.messageId = info.messageId;
        mailLogData.mailInfo = info;
        mailLogData.status = 'success';
    } catch (err: any) {
        console.error('Error sending email:', err);
        mailLogData.status = 'failed';
        mailLogData.error = err?.message || 'Unknown error';
    }
    await createMailLog(mailLogData);
};
