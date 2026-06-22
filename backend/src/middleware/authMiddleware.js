import jwt from "jsonwebtoken";
import User from "../models/User.js";
import TokenBlacklist from "../models/TokenBlacklist.js";

export const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const bearerToken =
      authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.split(" ")[1]
        : null;

    const token = req.cookies?.jwt || bearerToken;

    if (!token) {
      const error = new Error("Bạn cần đăng nhập để truy cập tài nguyên này.");
      error.statusCode = 401;
      return next(error);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    try {
      const blacklisted = await TokenBlacklist.findOne({ token });
      if (blacklisted) {
        const error = new Error("Token đã bị thu hồi.");
        error.statusCode = 401;
        return next(error);
      }
    } catch (dbError) {
      console.error("Blacklist check failed:", dbError.message);
    }

    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      const error = new Error("Người dùng không tồn tại hoặc token không hợp lệ.");
      error.statusCode = 401;
      return next(error);
    }

    if (user.status === "deleted") {
      const error = new Error("Tài khoản này đã bị xóa.");
      error.statusCode = 401;
      return next(error);
    }

    if (user.passwordChangedAt && decoded.iat < user.passwordChangedAt.getTime() / 1000) {
      const error = new Error("Mật khẩu đã được thay đổi. Vui lòng đăng nhập lại.");
      error.statusCode = 401;
      return next(error);
    }

    if (user.banStatus === "banned") {
      if (user.banExpiresAt && new Date() >= user.banExpiresAt) {
        user.banStatus = "none";
        user.banExpiresAt = null;
        await user.save();
      } else {
        const error = new Error("Tài khoản của bạn đã bị cấm.");
        error.statusCode = 403;
        return next(error);
      }
    }

    if (user.banStatus === "warning" && user.warningExpiresAt && new Date() >= user.warningExpiresAt) {
      user.banStatus = "none";
      user.warningExpiresAt = null;
      await user.save();
    }

    req.user = user;
    next();

  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      error.statusCode = 401;
      error.message = "Token không hợp lệ hoặc đã hết hạn.";
    }

    return next(error);
  }
};