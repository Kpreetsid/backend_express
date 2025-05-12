import nodemailer from 'nodemailer';
import { mailCredential } from '../configDB';

const transporter = nodemailer.createTransport({
    host: mailCredential.host,
    port: mailCredential.port,
    secure: mailCredential.secure,
    tls: {
        rejectUnauthorized: false
    },
    auth: {
        user: mailCredential.user,
        pass: mailCredential.pass
    }
});

interface MailOptions {
    to: string;
    subject: string;
    html: string;
}

export const sendMail = async ({ to, subject, html }: MailOptions): Promise<void> => {
    try {
        const info = await transporter.sendMail({
            from: `${mailCredential.user}`,
            to,
            subject,
            html
        });
        console.log('Email sent:', info.messageId);
    } catch (err) {
        console.error('Error sending email:', err);
        throw err;
    }
};
