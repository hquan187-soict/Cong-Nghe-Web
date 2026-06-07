import bcrypt from "bcryptjs";
import User from "../models/User.js";

const ADMIN_EMAIL = "admin@chatapp.com";
const ADMIN_PASSWORD = "Admin@123456";
const ADMIN_NAME = "Admin";

export const seedAdmin = async () => {
  try {
    const existing = await User.findOne({ email: ADMIN_EMAIL });
    if (existing) {
      if (existing.role !== "admin") {
        existing.role = "admin";
        await existing.save();
        console.log("Seeder: upgraded existing account to admin role.");
      }
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, salt);

    await User.create({
      fullName: ADMIN_NAME,
      email: ADMIN_EMAIL,
      password: hashedPassword,
      authProvider: "local",
      role: "admin",
    });

    console.log(`Seeder: admin account created (${ADMIN_EMAIL}).`);
  } catch (error) {
    console.error("Seeder: failed to create admin account:", error.message);
  }
};
