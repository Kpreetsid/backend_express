import { applicationLogger } from '../observability/logger';
import nodemailer, { Transporter } from 'nodemailer';
import { mailCredential } from '../configDB';
import { generateExternalAccessToken } from './auth';
import fs from 'fs';
import path from 'path';
import { IMailLog, MailLogModel, createMailLog } from '../models/mailLog.model';
import { VERIFICATION_CODE_EXPIRY_SECONDS } from '../models/userVerification.model';
import { passwordResetAuthorizationService } from '../user/resetPassword/passwordResetAuthorization.service';

interface MailPayload {
  to: string;
  subject: string;
  html: string;
  messageId?: string;
}

export class MailerService {
  private readonly transporter: Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      service: mailCredential.service,
      host: mailCredential.host,
      port: mailCredential.port,
      secure: mailCredential.secure,
      tls: { rejectUnauthorized: mailCredential.tlsRejectUnauthorized },
      auth: {
        user: mailCredential.user,
        pass: mailCredential.pass
      }
    });
  }

  private async send({ to, subject, html, messageId }: MailPayload): Promise<void> {
    if (messageId && await MailLogModel.exists({ messageId, status: 'success' })) {
      applicationLogger.info({ messageId, to }, 'Email delivery already recorded; skipping retry');
      return;
    }
    const mailLog: IMailLog = new MailLogModel({ to, subject, html, messageId });
    try {
      await this.transporter.verify();
      applicationLogger.info('Mail verified');
      const info = await this.transporter.sendMail({
        from: `Presage Insights <${mailCredential.from}>`,
        to,
        subject,
        html,
        ...(messageId ? { messageId } : {})
      });
      mailLog.messageId = messageId || info.messageId;
      mailLog.mailInfo = info;
      mailLog.status = 'success';
      applicationLogger.info(`Message Id: ${info.messageId}, Accepted: ${info.accepted}, Rejected: ${info.rejected}, Response: ${info.response}`);
    } catch (error: any) {
      applicationLogger.error({ err: error }, 'Error sending email:');
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
      html = html.replaceAll(`{{${key}}}`, data[key]!);
    }
    return html;
  }

  private getFullName(user: any): string {
    return [user.firstName, user.lastName].filter(Boolean).join(' ');
  }

  private getExperienceProfileLabel(value: any): string {
    switch (String(value || '').trim()) {
      case 'oem':
        return 'Pump OEM';
      case 'standard_account':
      default:
        return 'Standard CMMS';
    }
  }

  private formatDate(value: any): string {
    if (!value) {
      return 'Not scheduled';
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'Not scheduled';
    }
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  private formatDuration(value: any): string {
    const duration = Number(value);
    if (!Number.isFinite(duration) || duration <= 0) {
      return 'Not estimated';
    }
    return `${duration}h`;
  }

  private stripHtml(value: any): string {
    return String(value || '')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private truncate(value: string, maxLength: number): string {
    if (!value || value.length <= maxLength) {
      return value || '';
    }
    return `${value.slice(0, maxLength - 1).trim()}…`;
  }

  private expiryDurationFormat(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return `${minutes} minute${minutes === 1 ? '' : 's'}`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) {
      return `${hours} hour${hours === 1 ? '' : 's'}`;
    }

    return `${hours} hour${hours === 1 ? '' : 's'} ${remainingMinutes} minute${remainingMinutes === 1 ? '' : 's'}`;
  }

  async sendVerificationCode(user: any): Promise<boolean> {
    try {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const fileName = this.loadTemplate(`verificationCode.template.html`);
      const html = this.replace(fileName,
        {
          OTP: otp,
          OTP_EXPIRY: this.expiryDurationFormat(VERIFICATION_CODE_EXPIRY_SECONDS),
          YEAR: new Date().getFullYear().toString(),
          NAME: this.getFullName(user) || user.username || 'there',
          EMAIL: user.email || 'your email address',
          LOGIN_LINK: mailCredential.loginUrl
        }
      );
      await this.send({to: user.email, subject: 'Verify your email address for Presage CMMS', html});
      await VerificationCodeModel.findOneAndUpdate(
        { email: user.email },
        { firstName: user.firstName, code: otp, createdAt: new Date() },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      return true;
    } catch {
      return false;
    }
  }

  async sendRegistrationConfirmation(user: any, account?: any): Promise<boolean> {
    try {
      const fileName = this.loadTemplate(`registration.template.html`);
      const html = this.replace(fileName,
        {
          YEAR: new Date().getFullYear().toString(),
          fullName: this.getFullName(user),
          userName: user.username,
          userEmail: user.email,
          registrationDate: new Date().toLocaleString(),
          loginLink: mailCredential.loginUrl,
          accountName: account?.account_name || 'Your organization',
          experienceProfile: this.getExperienceProfileLabel(account?.experience_profile),
          roleName: 'Administrator',
          companyType: account?.type || 'CMMS account'
        }
      );
      await this.send({to: user.email, subject: `Welcome to Presage CMMS - ${account?.account_name || 'Your account'} is ready`, html});
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
        loginUrl: mailCredential.loginUrl,
        YEAR: new Date().getFullYear().toString()
      }
    );
    await this.send({to: user.email, subject: 'Your Presage CMMS Password Has Been Updated', html});
  }

  async sendWorkOrderMail(
    workOrder: any,
    assignedUser: any,
    createdBy: any,
    messageId?: string
  ): Promise<void> {
    const fileName = this.loadTemplate(`workOrder.template.html`);
    const descriptionPreview = this.truncate(this.stripHtml(workOrder.description), 220) || 'No description provided.';
    const procedureCount = Array.isArray(workOrder.procedures)
      ? workOrder.procedures.length
      : Array.isArray(workOrder.procedure_entries)
        ? workOrder.procedure_entries.length
        : Array.isArray(workOrder.procedure_ids)
          ? workOrder.procedure_ids.length
          : 0;
    const plannedPartsCount = Array.isArray(workOrder.parts) ? workOrder.parts.length : 0;
    const startDate = this.formatDate(workOrder.start_date);
    const endDate = this.formatDate(workOrder.end_date);
    const estimatedDuration = this.formatDuration(workOrder.estimated_time);
    const workSource = workOrder.createdFrom || 'Work Order';
    const workType = workOrder.nature_of_work || workOrder.type || 'General';
    const assetName = workOrder.asset?.asset_name || 'Not linked';
    const locationName = workOrder.location?.location_name || 'Not linked';
    const subject = `Work Order - [${workOrder.order_no}] ${workOrder.priority || 'Medium'} Priority • ${workOrder.title}`;
    const externalToken = generateExternalAccessToken(
      {
        email: assignedUser.email,
        org_id: assignedUser.account_id,
        isExternal: false,
        isInternal: true,
        redirectPath: `/work-order/details/${workOrder._id}?source=email`
      },
      7 * 24 * 60 * 60
    );
    const html = this.replace(fileName,
      {
        userFullName: this.getFullName(assignedUser),
        workOrderNo: workOrder.order_no,
        title: workOrder.title,
        workOrderDescription: descriptionPreview,
        locationName,
        assetName,
        datetime: new Date().toLocaleString(),
        createdBy: this.getFullName(createdBy),
        assignedTo: this.getFullName(assignedUser) || assignedUser.email || 'Assigned user',
        startDate,
        endDate,
        estimatedDuration,
        status: workOrder.status,
        priority: workOrder.priority || 'Medium',
        workType,
        workSource,
        procedureCount: String(procedureCount),
        plannedPartsCount: String(plannedPartsCount),
        detailsLink: `${mailCredential.loginUrl}/external?token=${encodeURIComponent(externalToken)}`,
        YEAR: new Date().getFullYear().toString()
      }
    );
    await this.send({
      to: assignedUser.email,
      subject,
      html,
      ...(messageId ? { messageId } : {})
    });
  }

  async sendUserCreatedMail(
    data: { userName: string; userEmail: string; },
    messageId?: string
  ): Promise<void> {
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
    await this.send({
      to: data.userEmail,
      subject: 'Welcome to Presage Insights - Your Account Is Ready',
      html,
      ...(messageId ? { messageId } : {})
    });
  }
}

export const mailerService = new MailerService();
