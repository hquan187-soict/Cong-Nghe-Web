import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

export async function sendOtpToEmail(to, otp) {
  console.log(`[OTP] Đang chuẩn bị gửi OTP tới ${to}...`);
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // true for 465
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to,
    subject: 'Your OTP Code',
    text: `Your OTP code is: ${otp}`,
    html: `<p>Your OTP code is: <b>${otp}</b></p>`,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[OTP] Gửi thành công! Message ID: ${info.messageId}`);
  } catch (error) {
    console.error(`[OTP] Lỗi khi gửi mail qua Nodemailer:`, error);
    throw error;
  }
}

