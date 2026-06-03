import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    image: {
      type: String,
    },
    file: {
      url: { type: String },
      name: { type: String },
      size: { type: Number },
      type: { type: String },
      duration: { type: Number },
    },
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    messageType: {
      type: String,
      enum: ["text", "image", "file", "audio", "system", "like", "call", "poll"],
      default: "text",
    },
    mentions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    mentionAll: {
      type: Boolean,
      default: false,
    },
    reactions: [
      {
        emoji: { type: String, required: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      },
    ],
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
    isPinned: {
      type: Boolean,
      default: false,
    },
    isForwarded: {
      type: Boolean,
      default: false,
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
    isDeletedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    isRecalled: {
      type: Boolean,
      default: false,
    },
    editedAt: {
      type: Date,
      default: null,
    },
    callInfo: {
      callId: { type: mongoose.Schema.Types.ObjectId, ref: "Call" },
      callType: { type: String, enum: ["voice", "video"] },
      duration: { type: Number },
      status: { type: String, enum: ["missed", "rejected", "ended", "no_answer"] },
    },
    poll: {
      question: { type: String, trim: true, maxlength: 500 },
      options: [
        {
          text: { type: String, trim: true, maxlength: 200 },
          voters: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
        },
      ],
      allowMultiple: { type: Boolean, default: false },
      allowChange: { type: Boolean, default: true },
      deadline: { type: Date, default: null },
      isClosed: { type: Boolean, default: false },
    },
  },
  { timestamps: true },
);

messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ conversationId: 1, senderId: 1, readBy: 1 });
messageSchema.index({ conversationId: 1, isPinned: 1, createdAt: -1 });
messageSchema.index({ conversationId: 1, messageType: 1, isRecalled: 1, createdAt: -1 });
messageSchema.index({ conversationId: 1, isRecalled: 1, messageType: 1 });

export default mongoose.model("Message", messageSchema);
