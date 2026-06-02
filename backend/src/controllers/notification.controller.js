import mongoose from "mongoose";
import Notification from "../models/Notification.js";

export const getNotifications = async (req, res, next) => {
  try {
    const currentUserId = req.user?._id;
    if (!currentUserId) {
      const error = new Error("Bạn chưa đăng nhập.");
      error.statusCode = 401;
      throw error;
    }

    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
    const skip = (page - 1) * limit;

    const notifications = await Notification.find({ recipient: currentUserId })
      .populate("sender", "fullName avatar")
      .populate("conversation", "name isGroup avatar members")
      .populate({
        path: "message",
        select: "text messageType isRecalled createdAt",
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit + 1);

    const hasMore = notifications.length > limit;
    const items = hasMore ? notifications.slice(0, limit) : notifications;

    const unreadCount = await Notification.countDocuments({
      recipient: currentUserId,
      isRead: false,
    });

    return res.status(200).json({
      notifications: items,
      unreadCount,
      pagination: { page, limit, hasMore },
    });
  } catch (error) {
    return next(error);
  }
};

export const markNotificationRead = async (req, res, next) => {
  try {
    const currentUserId = req.user?._id;
    const { notificationId } = req.params;

    if (!currentUserId) {
      const error = new Error("Bạn chưa đăng nhập.");
      error.statusCode = 401;
      throw error;
    }

    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      const error = new Error("notificationId không hợp lệ.");
      error.statusCode = 400;
      throw error;
    }

    await Notification.findOneAndUpdate(
      { _id: notificationId, recipient: currentUserId },
      { isRead: true },
    );

    return res.status(200).json({ message: "OK" });
  } catch (error) {
    return next(error);
  }
};

export const markAllNotificationsRead = async (req, res, next) => {
  try {
    const currentUserId = req.user?._id;
    if (!currentUserId) {
      const error = new Error("Bạn chưa đăng nhập.");
      error.statusCode = 401;
      throw error;
    }

    await Notification.updateMany(
      { recipient: currentUserId, isRead: false },
      { isRead: true },
    );

    return res.status(200).json({ message: "OK" });
  } catch (error) {
    return next(error);
  }
};

export const getUnreadCount = async (req, res, next) => {
  try {
    const currentUserId = req.user?._id;
    if (!currentUserId) {
      const error = new Error("Bạn chưa đăng nhập.");
      error.statusCode = 401;
      throw error;
    }

    const count = await Notification.countDocuments({
      recipient: currentUserId,
      isRead: false,
    });

    return res.status(200).json({ unreadCount: count });
  } catch (error) {
    return next(error);
  }
};
