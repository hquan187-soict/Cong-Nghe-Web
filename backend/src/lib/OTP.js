import { BrevoClient } from '@getbrevo/brevo';

const brevo = new BrevoClient({
  apiKey: process.env.BREVO_API_KEY,
});

export async function sendOtpToEmail(to, otp) {
  console.log(`[OTP] Đang chuẩn bị gửi OTP tới ${to}...`);

  try {
    const result = await brevo.transactionalEmails.sendTransacEmail({
      subject: 'Your OTP Code',
      sender: {
        name: process.env.BREVO_SENDER_NAME || 'ChatApp',
        email: process.env.BREVO_SENDER_EMAIL,
      },
      to: [{ email: to }],
      textContent: `Your OTP code is: ${otp}`,
      htmlContent: `<p>Your OTP code is: <b>${otp}</b></p>`,
    });

    console.log(`[OTP] Gửi thành công! Message ID: ${result.messageId}`);
  } catch (error) {
    console.error(`[OTP] Lỗi khi gửi mail qua Brevo:`, error);
    throw error;
  }
}
