import nodemailer, { Transporter } from 'nodemailer';
import { mailCredential } from '../configDB';
import fs from 'fs';
import path from 'path';
import { IMailLog, MailLogModel, createMailLog } from '../models/mailLog.model';
import { VerificationCodeModel } from '../models/userVerification.model';

interface MailPayload {
  to: string;
  subject: string;
  html: string;
}

export class MailerService {
  private readonly transporter: Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      service: mailCredential.service,
      host: mailCredential.host,
      port: mailCredential.port,
      secure: mailCredential.secure,
      tls: { rejectUnauthorized: false },
      auth: {
        user: mailCredential.user,
        pass: mailCredential.pass
      }
    });
  }

  private async send({ to, subject, html }: MailPayload): Promise<void> {
    const mailLog: IMailLog = new MailLogModel({ to, subject, html });
    try {
      await this.transporter.verify();
      console.log('Mail verified');
      const info = await this.transporter.sendMail({
        from: `Presage Insights <${mailCredential.from}>`,
        to,
        subject,
        html
      });
      mailLog.messageId = info.messageId;
      mailLog.mailInfo = info;
      mailLog.status = 'success';
      console.log(`Message Id: ${info.messageId}, Accepted: ${info.accepted}, Rejected: ${info.rejected}, Response: ${info.response}`);
    } catch (error: any) {
      console.error('Error sending email:', error);
      mailLog.status = 'failed';
      mailLog.error = error;
      throw error;
    } finally {
      await createMailLog(mailLog);
    }
  }

  private loadTemplate(templateName: string): string {
    const templatePath = path.join(__dirname,`../public/${templateName}`);
    return fs.readFileSync(templatePath, 'utf8');
  }

  private replace(template: string, data: Record<string, string>): string {
    let html = template;
    for (const key in data) {
      html = html.replaceAll(`{{${key}}}`, data[key]);
    }
    return html;
  }

  private getFullName(user: any): string {
    return [user.firstName, user.lastName].filter(Boolean).join(' ');
  }

  async sendVerificationCode(user: any): Promise<boolean> {
    try {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const fileName = this.loadTemplate(`verificationCode.template.html`);
      const html = this.replace(fileName,
        {
          OTP: otp,
          YEAR: new Date().getFullYear().toString(),
          NAME: this.getFullName(user)
        }
      );
      await this.send({to: user.email, subject: 'Email Verification Required – Presage CMMS', html});
      await VerificationCodeModel.create({email: user.email, firstName: user.firstName, code: otp});
      return true;
    } catch {
      return false;
    }
  }

  async sendRegistrationConfirmation(user: any): Promise<boolean> {
    try {
      const fileName = this.loadTemplate(`registration.template.html`);
      const html = this.replace(fileName,
        {
          YEAR: new Date().getFullYear().toString(),
          fullName: this.getFullName(user),
          userName: user.username,
          userEmail: user.email,
          registrationDate: new Date().toLocaleString(),
          loginLink: mailCredential.loginUrl
        }
      );
      await this.send({to: user.email, subject: 'Welcome to Presage CMMS - Your Registration Is Complete', html});
      return true;
    } catch {
      return false;
    }
  }

  async sendPasswordChangeConfirmation(user: any): Promise<void> {
    const fileName = this.loadTemplate(`confirmPasswordChange.template.html`);
    const html = this.replace(fileName,
      {
        userFullName: this.getFullName(user),
        userName: user.username,
        changedAt: new Date().toLocaleString(),
        loginUrl: mailCredential.loginUrl
      }
    );
    await this.send({to: user.email, subject: 'Your Presage CMMS Password Has Been Updated', html});
  }

  async sendWorkOrderMail(workOrder: any, assignedUser: any, createdBy: any): Promise<void> {
    const fileName = this.loadTemplate(`workOrder.template.html`);
    const html = this.replace(fileName,
      {
        userFullName: this.getFullName(assignedUser),
        workOrderNo: workOrder.order_no,
        title: workOrder.title,
        workOrderDescription: workOrder.description,
        locationName: workOrder.location?.location_name || '',
        assetName: workOrder.asset?.asset_name || '',
        datetime: new Date().toLocaleString(),
        createdBy: this.getFullName(createdBy),
        startDate: workOrder.start_date.toISOString().split('T')[0],
        endDate: workOrder.end_date.toISOString().split('T')[0],
        status: workOrder.status,
        detailsLink: `${mailCredential.loginUrl}/work-order/list/1/${workOrder._id}/info`
      }
    );
    await this.send({to: assignedUser.email, subject: `${workOrder.title} - New Work Order Assigned`, html});
  }

  async sendUserCreatedMail(data: { userName: string; userEmail: string;}): Promise<void> {
    const fileName = this.loadTemplate(`userRegister.template.html`);
    const html = this.replace(fileName,
      {
        userName: data.userName,
        userEmail: data.userEmail,
        loginUrl: mailCredential.loginUrl,
        companyName: 'Presage Insights Pvt. Ltd.',
        createdAt: new Date().toLocaleString(),
        year: new Date().getFullYear().toString()
      }
    );
    await this.send({to: data.userEmail, subject: 'Welcome to Presage Insights - Your Account Is Ready', html});
  }
}