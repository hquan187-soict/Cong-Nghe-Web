import User from "../models/User.js";
import Report from "../models/Report.js";
import Message from "../models/Message.js";
import { performAccountDeletion } from "./user.controller.js";

export const getUsers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || "";

    const filter = { role: { $ne: "admin" } };
    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select("fullName email avatar banStatus banExpiresAt createdAt isOnline lastSeen status")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    res.status(200).json({
      users,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return next(error);
  }
};

export const updateUserBan = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action } = req.body;

    if (id === req.user._id.toString()) {
      const error = new Error("Không thể khóa tài khoản quản trị tối cao.");
      error.statusCode = 400;
      throw error;
    }

    const user = await User.findById(id);
    if (!user) {
      const error = new Error("Người dùng không tồn tại.");
      error.statusCode = 404;
      throw error;
    }

    if (user.role === "admin") {
      const error = new Error("Không thể khóa tài khoản quản trị tối cao.");
      error.statusCode = 400;
      throw error;
    }

    const validActions = ["warning", "ban_3_days", "ban_7_days", "ban_1_month", "ban_permanent", "unban"];
    if (!validActions.includes(action)) {
      const error = new Error("Hành động không hợp lệ.");
      error.statusCode = 400;
      throw error;
    }

    switch (action) {
      case "warning":
        user.banStatus = "warning";
        user.banExpiresAt = null;
        break;
      case "ban_3_days":
        user.banStatus = "banned";
        user.banExpiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
        break;
      case "ban_7_days":
        user.banStatus = "banned";
        user.banExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        break;
      case "ban_1_month":
        user.banStatus = "banned";
        user.banExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        break;
      case "ban_permanent":
        user.banStatus = "banned";
        user.banExpiresAt = null;
        break;
      case "unban":
        user.banStatus = "none";
        user.banExpiresAt = null;
        break;
    }

    await user.save();

    res.status(200).json({
      message: "Cập nhật trạng thái người dùng thành công.",
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        banStatus: user.banStatus,
        banExpiresAt: user.banExpiresAt,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const getReports = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status || "";

    const filter = {};
    if (status && ["pending", "resolved", "dismissed"].includes(status)) {
      filter.status = status;
    }

    const [reports, total] = await Promise.all([
      Report.find(filter)
        .populate("reporterId", "fullName email avatar")
        .populate("reportedUserId", "fullName email avatar banStatus banExpiresAt")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Report.countDocuments(filter),
    ]);

    res.status(200).json({
      reports,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return next(error);
  }
};

export const updateReportStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["pending", "resolved", "dismissed"].includes(status)) {
      const error = new Error("Trạng thái không hợp lệ.");
      error.statusCode = 400;
      throw error;
    }

    const report = await Report.findByIdAndUpdate(id, { status }, { new: true })
      .populate("reporterId", "fullName email avatar")
      .populate("reportedUserId", "fullName email avatar banStatus banExpiresAt");

    if (!report) {
      const error = new Error("Báo cáo không tồn tại.");
      error.statusCode = 404;
      throw error;
    }

    res.status(200).json({ message: "Cập nhật trạng thái báo cáo thành công.", report });
  } catch (error) {
    return next(error);
  }
};

export const getReportContext = async (req, res, next) => {
  try {
    const { id } = req.params;

    const report = await Report.findById(id)
      .populate("reporterId", "fullName email avatar")
      .populate("reportedUserId", "fullName email avatar")
      .lean();

    if (!report) {
      const error = new Error("Báo cáo không tồn tại.");
      error.statusCode = 404;
      throw error;
    }

    let contextMessages = [];
    let reportedMessage = null;

    if (report.messageId) {
      reportedMessage = await Message.findById(report.messageId)
        .populate("senderId", "fullName avatar")
        .lean();
    }

    if (reportedMessage) {
      const beforeMessages = await Message.find({
        conversationId: reportedMessage.conversationId,
        createdAt: { $lt: reportedMessage.createdAt },
      })
        .populate("senderId", "fullName avatar")
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();

      const afterMessages = await Message.find({
        conversationId: reportedMessage.conversationId,
        createdAt: { $gt: reportedMessage.createdAt },
      })
        .populate("senderId", "fullName avatar")
        .sort({ createdAt: 1 })
        .limit(5)
        .lean();

      contextMessages = [
        ...beforeMessages.reverse(),
        { ...reportedMessage, isReportedMessage: true },
        ...afterMessages,
      ];
    }

    res.status(200).json({
      report,
      reportedMessage: reportedMessage
        ? { ...reportedMessage, isReportedMessage: true }
        : null,
      contextMessages,
    });
  } catch (error) {
    return next(error);
  }
};

export const purgeUserAccount = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (id === req.user._id.toString()) {
      const error = new Error("Không thể xóa tài khoản quản trị viên.");
      error.statusCode = 400;
      throw error;
    }

    const targetUser = await User.findById(id);
    if (!targetUser) {
      const error = new Error("Người dùng không tồn tại.");
      error.statusCode = 404;
      throw error;
    }

    if (targetUser.role === "admin") {
      const error = new Error("Không thể xóa tài khoản quản trị viên.");
      error.statusCode = 403;
      throw error;
    }

    if (targetUser.status === "deleted") {
      const error = new Error("Tài khoản này đã bị xóa trước đó.");
      error.statusCode = 400;
      throw error;
    }

    await performAccountDeletion(id);

    return res.status(200).json({
      message: "Tài khoản người dùng đã được xóa thành công.",
    });
  } catch (error) {
    return next(error);
  }
};
