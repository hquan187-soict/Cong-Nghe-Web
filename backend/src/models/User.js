import mongoose from "mongoose";

const coverCropAreaSchema = new mongoose.Schema(
  {
    x: { type: Number, min: 0, max: 100, required: true },
    y: { type: Number, min: 0, max: 100, required: true },
    width: { type: Number, min: 0, max: 100, required: true },
    height: { type: Number, min: 0, max: 100, required: true },
  },
  { _id: false }
);

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
      required: function() { return this.authProvider === 'local'; },
      minlength: 6,
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },
    authProvider: {
      type: String,
      enum: ['local', 'google'],
      default: 'local',
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
    coverImage: {
      type: String,
      default: "",
    },
    coverOriginalImage: {
      type: String,
      default: "",
    },
    coverCropArea: {
      type: coverCropAreaSchema,
      default: null,
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
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    banStatus: {
      type: String,
      enum: ["none", "warning", "banned"],
      default: "none",
    },
    banExpiresAt: {
      type: Date,
      default: null,
    },
    warningExpiresAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["active", "deleted"],
      default: "active",
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
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
