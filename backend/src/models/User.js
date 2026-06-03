import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
    },
    fullName: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    avatar: {
      type: String,
      default: "",
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    lastSeen: {
      type: Date,
      default: null,
    },
    showActiveStatus: {
      type: Boolean,
      default: true,
    },
    friends: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    friendRequests: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    blockedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    passwordChangedAt: {
      type: Date,
      default: null,
    },
    coverColor: {
      type: String,
      default: "",
    },
    birthday: {
      type: Date,
      default: null,
    },
    gender: {
      type: String,
      enum: ["male", "female", "other", ""],
      default: "",
    },
    phone: {
      type: String,
      default: "",
    },
    address: {
      type: String,
      default: "",
    },
    hometown: {
      type: String,
      default: "",
    },
    hobbies: {
      type: String,
      default: "",
    },
    occupation: {
      type: String,
      default: "",
    },
    education: {
      type: String,
      default: "",
    },
    bio: {
      type: String,
      default: "",
      maxlength: 500,
    },
    profileVisibility: {
      birthday: { type: String, enum: ["private", "friends", "public"], default: "friends" },
      gender: { type: String, enum: ["private", "friends", "public"], default: "friends" },
      phone: { type: String, enum: ["private", "friends", "public"], default: "friends" },
      address: { type: String, enum: ["private", "friends", "public"], default: "friends" },
      hometown: { type: String, enum: ["private", "friends", "public"], default: "friends" },
      hobbies: { type: String, enum: ["private", "friends", "public"], default: "public" },
      occupation: { type: String, enum: ["private", "friends", "public"], default: "public" },
      education: { type: String, enum: ["private", "friends", "public"], default: "public" },
      bio: { type: String, enum: ["private", "friends", "public"], default: "public" },
    },
  },
  { timestamps: true },
);

export default mongoose.model("User", userSchema);
