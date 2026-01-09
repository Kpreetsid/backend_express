import nodemailer from 'nodemailer';
import { mailCredential } from '../configDB';
import fs from 'fs';
import path from 'path';
import { IMailLog, MailLogModel, createMailLog } from '../models/mailLog.model';
import { VerificationCodeModel } from '../models/userVerification.model';

const transporter = nodemailer.createTransport({
  service: mailCredential.service,
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

const sendMail = async ({ to, subject, html }: MailOptions): Promise<void> => {
  const mailLogData: IMailLog = new MailLogModel({ to, subject, html });
  try {
    await transporter.verify();
    console.log("SMTP verified successfully.")
    const info = await transporter.sendMail({ from: `Presage Insights <${mailCredential.from}>`, to, subject, html });
    mailLogData.messageId = info.messageId;
    mailLogData.mailInfo = info;
    mailLogData.status = 'success';
    console.log(`Message Id: ${info.messageId}, Accepted: ${info.accepted}, Rejected: ${info.rejected}, Response: ${info.response}`);
  } catch (error: any) {
    console.error('Error sending email:', error);
    mailLogData.status = 'failed';
    mailLogData.error = error || 'Unknown error';
    throw error;
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
    const fullName = match.firstName;
    if (match.lastName) {
      match.fullName = fullName + ' ' + match.lastName;
    }
    htmlTemplate = htmlTemplate.replace('{{NAME}}', match.fullName);
    const mailResponse = await sendMail({
      to: match.email,
      subject: 'Email Verification Required – Presage CMMS',
      html: htmlTemplate
    });
    await new VerificationCodeModel({ email: match.email, firstName: match.firstName, code: otp.toString() }).save();
    console.log(mailResponse);
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}

export const sendRegistrationConfirmation = async (match: any): Promise<boolean> => {
  try {
    const templatePath = path.join(__dirname, '../public/registration.template.html');
    let htmlTemplate = fs.readFileSync(templatePath, 'utf8');
    htmlTemplate = htmlTemplate.replace('{{YEAR}}', new Date().getFullYear().toString());
    const fullName = match.firstName;
    if (match.lastName) {
      match.fullName = fullName + ' ' + match.lastName;
    }
    htmlTemplate = htmlTemplate.replace('{{fullName}}', match.fullName);
    htmlTemplate = htmlTemplate.replace('{{userName}}', match.username);
    htmlTemplate = htmlTemplate.replace('{{userEmail}}', match.email);
    htmlTemplate = htmlTemplate.replace('{{registrationDate}}', new Date().toLocaleString());
    htmlTemplate = htmlTemplate.replace('{{loginLink}}', mailCredential.loginUrl);
    const mailResponse = await sendMail({
      to: match.email,
      subject: `Welcome to Presage CMMS - Your Registration Is Complete`,
      html: htmlTemplate
    });
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
    htmlTemplate = htmlTemplate.replace('{{changedAt}}', new Date().toLocaleString());
    await sendMail({
      to: user.email,
      subject: 'Your Presage CMMS Password Has Been Updated',
      html: htmlTemplate
    });
  } catch (error) {
    console.error('Error sending password change confirmation:', error);
  }
};

export const sendWorkOrderMail = async (workOrder: any, assignedUsers: any, user: any): Promise<void> => {
  try {
    const templatePath = path.join(__dirname, '../public/workOrder.template.html');
    let htmlTemplate = fs.readFileSync(templatePath, 'utf8');
    htmlTemplate = htmlTemplate.replace('{{userFullName}}', assignedUsers.firstName + ' ' + assignedUsers.lastName);
    htmlTemplate = htmlTemplate.replaceAll('{{workOrderNo}}', workOrder.order_no);
    htmlTemplate = htmlTemplate.replace('{{workOrderDescription}}', workOrder.description);
    htmlTemplate = htmlTemplate.replaceAll('{{title}}', workOrder.title);
    htmlTemplate = htmlTemplate.replace('{{locationName}}', workOrder.location?.location_name);
    htmlTemplate = htmlTemplate.replace('{{assetName}}', workOrder.asset?.asset_name);
    htmlTemplate = htmlTemplate.replace('{{datetime}}', new Date().toLocaleString());
    htmlTemplate = htmlTemplate.replace('{{createdBy}}', `${user.firstName} ${user.lastName}`);
    htmlTemplate = htmlTemplate.replace('{{startDate}}', workOrder.start_date.toISOString().split('T')[0]);
    htmlTemplate = htmlTemplate.replace('{{endDate}}', workOrder.end_date.toISOString().split('T')[0]);
    htmlTemplate = htmlTemplate.replace('{{status}}', workOrder.status);
    htmlTemplate = htmlTemplate.replace('{{detailsLink}}', `${mailCredential.loginUrl}/work-order/list/1/${workOrder.id || workOrder._id}/info`);
    await sendMail({
      to: assignedUsers.email,
      subject: `${workOrder.title} - New Work Order Assigned by ${user.firstName} ${user.lastName}`,
      // Action Required: "${workOrder.title}" Work Order Assigned by ${user.firstName} ${user.lastName}
      html: htmlTemplate
    });
  } catch (error) {
    console.error('Error sending work order email:', error);
  }
};

export const sendUserCreatedMail = async (data: { userName: string; userEmail: string; }) => {
  const templatePath = path.join(__dirname, '../public/userRegister.template.html');
  let html = fs.readFileSync(templatePath, 'utf8');
  html = html
    .replace('{{userName}}', data.userName)
    .replace('{{userEmail}}', data.userEmail)
    .replace('{{loginUrl}}', mailCredential.loginUrl)
    .replace('{{companyName}}', 'Presage Insights Pvt. Ltd.')
    .replace('{{createdAt}}', new Date().toLocaleString())
    .replace('{{year}}', new Date().getFullYear().toString());

  await sendMail({
    to: data.userEmail,
    subject: 'Welcome to Presage Insights - Your Account Is Ready',
    html,
  });
};