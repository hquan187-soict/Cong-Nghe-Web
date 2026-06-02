import mongoose from "mongoose";

const OTPLOGSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: true,
            index: true,
        },
        otp: {
            type: String,
            required: true,
        },
        createdAt: {
            type: Date,
            default: Date.now,
            expires: 300, // OTP sẽ tự động xóa sau 5 phút
        }
    }
);

export default mongoose.model("OTPLog", OTPLOGSchema);