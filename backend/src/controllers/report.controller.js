import Report from "../models/Report.js";
import User from "../models/User.js";
import Message from "../models/Message.js";

export const createReport = async (req, res, next) => {
  try {
    const { reportedUserId, messageId, reason, description } = req.body;
    const reporterId = req.user._id;

    if (!reportedUserId || !reason) {
      const error = new Error("Thiếu thông tin bắt buộc (reportedUserId, reason).");
      error.statusCode = 400;
      throw error;
    }

    if (reportedUserId === reporterId.toString()) {
      const error = new Error("Bạn không thể báo cáo chính mình.");
      error.statusCode = 400;
      throw error;
    }

    const targetUser = await User.findById(reportedUserId);
    if (!targetUser) {
      const error = new Error("Người dùng bị báo cáo không tồn tại.");
      error.statusCode = 404;
      throw error;
    }

    if (messageId) {
      const msg = await Message.findById(messageId);
      if (!msg) {
        const error = new Error("Tin nhắn bị báo cáo không tồn tại.");
        error.statusCode = 404;
        throw error;
      }
    }

    const report = await Report.create({
      reporterId,
      reportedUserId,
      messageId: messageId || null,
      reason,
      description: description || "",
    });

    res.status(201).json({ message: "Báo cáo đã được gửi thành công.", report });
  } catch (error) {
    return next(error);
  }
};
