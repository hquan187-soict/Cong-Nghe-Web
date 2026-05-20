import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

export async function sendOtpToEmail(to, otp) {
  // Configure your SMTP transporter
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER, // Your email address
      pass: process.env.EMAIL_PASS, // Your email password or app password
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to,
    subject: 'Your OTP Code',
    text: `Your OTP code is: ${otp}`,
    html: `<p>Your OTP code is: <b>${otp}</b></p>`,
  };

  await transporter.sendMail(mailOptions);
}

