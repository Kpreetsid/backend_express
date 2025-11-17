import { sendVerificationCode } from "../../_config/mailer";
import { VerificationCodeModel } from "../../models/userVerification.model";

export const sendVerificationEmailCode = async (match: any) => {
    return await sendVerificationCode(match);
}

export const verifyOTPExists = async (match: any) => {
    return await VerificationCodeModel.findOne(match);
}

export const verifyUserOTP = async (match: any) => {
    return await VerificationCodeModel.findOne(match);
}

export const deleteVerificationCode = async (match: { email: string }) => {
    return await VerificationCodeModel.deleteOne(match);
}