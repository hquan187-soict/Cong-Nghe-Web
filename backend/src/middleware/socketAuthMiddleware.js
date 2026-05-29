import jwt from "jsonwebtoken";
import User from "../models/User.js";
import dotenv from "dotenv";

dotenv.config();

export const socketAuthMiddleware = async (socket, next) => {
    try {
        let token = socket.handshake.auth?.token;
        if (!token) {
            token = socket.handshake.headers.cookie
                ?.split("; ")
                .find((row) => row.startsWith("jwt="))
                ?.split("=")[1];
        }
        if (!token) {
            console.error("Không tìm thấy token trong auth hoặc cookie");
            return next(new Error("Lỗi xác thực: Không tìm thấy token"));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded) {
            console.error("Token không hợp lệ");
            return next(new Error("Lỗi xác thực: Token không hợp lệ"));
        }

        const user = await User.findById(decoded.userId).select("-password");
        if (!user) {
            console.error("Người dùng không tồn tại");
            return next(new Error("Lỗi xác thực: Người dùng không tồn tại"));   
        }

        socket.user = user;
        socket.userId = user._id.toString();
        console.log(`Người dùng đã kết nối: ${user.fullName} (${socket.userId})`);
        next();
    } catch (error) {
        next(new Error("Lỗi xác thực: " + error.message ));
        console.error("Lỗi trong socketAuthMiddleware:", error);
    }
};