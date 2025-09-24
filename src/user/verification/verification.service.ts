import { sendVerificationCode } from "../../_config/mailer";
import { VerificationCodeModel } from "../../models/userVerification.model";

export const sendVerificationEmailCode = async (match: { email: string; firstName: string; lastName: string }) => {
    return await sendVerificationCode(match);
}

export const verifyOTPExists = async (match: { email: string; firstName: string; lastName: string }) => {
    return await VerificationCodeModel.findOne(match);
}

export const verifyUserOTP = async (match: { email: string; firstName: string; lastName: string; code: string }) => {
    return await VerificationCodeModel.findOne(match);
}

export const deleteVerificationCode = async (match: { email: string }) => {
    return await VerificationCodeModel.deleteOne(match);
}