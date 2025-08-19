import nodemailer from 'nodemailer';
import { mailCredential } from '../configDB';
import fs from 'fs';
import path from 'path';
import { IMailLog, MailLogModel, createMailLog } from '../models/mailLog.model';
import { VerificationCode } from '../models/userVerification.model';

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
        console.log(`Message preview URL: ${nodemailer.getTestMessageUrl(info)}`);
    } catch (err: any) {
        console.error('Error sending email:', err);
        mailLogData.status = 'failed';
        mailLogData.error = err?.message || 'Unknown error';
    }
    await createMailLog(mailLogData);
};

export const sendVerificationCode = async (match: any): Promise<boolean> => {
  try {
    const otp = Math.floor(100000 + Math.random() * 900000);
    const templatePath = path.join(__dirname, '../public/verificationCode.template.html');
    let htmlTemplate = fs.readFileSync(templatePath, 'utf8');
    htmlTemplate = htmlTemplate.replace('{{OTP}}', otp.toString());
    htmlTemplate = htmlTemplate.replace('{{YEAR}}', new Date().getFullYear().toString());
    htmlTemplate = htmlTemplate.replace('{{NAME}}', match.firstName + ' ' + match.lastName);
    const mailResponse = await sendMail({
      to: match.email,
      subject: 'Verify Your Email Address',
      html: htmlTemplate
    });
    await new VerificationCode({ email: match.email, firstName: match.firstName, lastName: match.lastName, code: otp.toString() }).save();
    console.log(mailResponse);
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}

export const sendPasswordChangeConfirmation = async (user: any): Promise<void> => {
  try {
    const templatePath = path.join(__dirname, '../public/confirmPasswordChange.template.html');
    let htmlTemplate = fs.readFileSync(templatePath, 'utf8');
    htmlTemplate = htmlTemplate.replace('{{userFullName}}', user.firstName + ' ' + user.lastName);
    htmlTemplate = htmlTemplate.replace('{{userName}}', user.username);
    await sendMail({
      to: user.email,
      subject: 'CMMS application password changed successfully.',
      html: htmlTemplate
    });
  } catch (error) {
    console.error('Error sending password change confirmation:', error);
  }
};

export const sendWorkOrderMail = async (user: any, workOrder: any): Promise<void> => {
  try {
    const templatePath = path.join(__dirname, '../public/workOrder.template.html');
    let htmlTemplate = fs.readFileSync(templatePath, 'utf8');
    htmlTemplate = htmlTemplate.replace('{{userFullName}}', user.firstName + ' ' + user.lastName);
    htmlTemplate = htmlTemplate.replace('{{workOrderId}}', workOrder.id);
    htmlTemplate = htmlTemplate.replace('{{workOrderDescription}}', workOrder.description);
    await sendMail({
      to: user.email,
      subject: 'New Work Order Assigned',
      html: htmlTemplate
    });
  } catch (error) {
    console.error('Error sending work order email:', error);
  }
};
