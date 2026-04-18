import jwt from "jsonwebtoken";
import User from "../models/User.js";

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

    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      const error = new Error("Người dùng không tồn tại hoặc token không hợp lệ.");
      error.statusCode = 401;
      return next(error);
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