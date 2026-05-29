import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendOtpToEmail(to, otp) {
  console.log(`[OTP] Đang chuẩn bị gửi OTP tới ${to}...`);

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to,
      subject: 'Your OTP Code',
      text: `Your OTP code is: ${otp}`,
      html: `<p>Your OTP code is: <b>${otp}</b></p>`,
    });

    if (error) {
      console.error(`[OTP] Lỗi từ Resend API:`, error);
      throw new Error(error.message);
    }

    console.log(`[OTP] Gửi thành công! Email ID: ${data.id}`);
  } catch (error) {
    console.error(`[OTP] Lỗi khi gửi mail qua Resend:`, error);
    throw error;
  }
}
