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
    },
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
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
    messageType: {
      type: String,
      enum: ["text", "image", "file", "system"],
      default: "text",
    },
    editedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

messageSchema.index({ conversationId: 1, createdAt: -1 });

export default mongoose.model("Message", messageSchema);
