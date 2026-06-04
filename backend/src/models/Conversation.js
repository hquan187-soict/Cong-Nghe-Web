import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],

    isGroup: {
      type: Boolean,
      default: false,
    },

    name: {
      type: String,
      trim: true,
      maxlength: 100,
    },

    avatar: {
      type: String,
      default: null,
    },

    admins: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },

    addMemberPermission: {
      type: String,
      enum: ["anyone", "admin"],
      default: "anyone",
    },

    removedMembers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    pendingRequests: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    pinnedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    mutedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    archivedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // Map userId (string) -> nickname (string)
    nicknames: {
      type: Map,
      of: String,
      default: {},
    },

    // Map userId (string) -> label string ("Gia đình", "Bạn bè", "Công việc", "Khách hàng", "Khác")
    labels: {
      type: Map,
      of: String,
      default: {},
    },

    emoji: {
      type: String,
      default: "ThumbsUp",
    },

    themeColor: {
      type: String,
      default: null,
    },

    deletedAt: {
      type: Map,
      of: Date,
      default: {},
    },

    markedUnreadBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true }
);

conversationSchema.index({ members: 1 });
conversationSchema.index({ isGroup: 1, members: 1 });

export default mongoose.model("Conversation", conversationSchema);