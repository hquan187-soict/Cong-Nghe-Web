import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
import connectDB from './lib/db.js';
import authRoutes from './routes/auth.routes.js';
import { globalErrorHandler } from './middleware/globalErrorHandler.js';
import userRoutes from './routes/user.routes.js';
import cors from 'cors';
import conversationRoutes from "./routes/conversation.routes.js";
import rateLimiter from './middleware/rateLimiter.js';
import messageRoutes from "./routes/message.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import callRoutes from "./routes/call.routes.js";
import configRoutes from "./routes/config.routes.js";
import reportRoutes from "./routes/report.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import { app, server } from './lib/socket.js';
import { seedAdmin } from './lib/seedAdmin.js';

//test import
import "./models/User.js";
import "./models/Conversation.js";
import "./models/Message.js";
import "./models/Call.js";
import "./models/Notification.js";
import "./models/TokenBlacklist.js";
import "./models/Report.js";

const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cors({
  origin: function(origin, callback) {
    const allowedOrigins = process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',') : [];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(cookieParser());
app.set('trust proxy', 1);

app.get('/', (req, res) => {
  res.send('API is running');
});

app.get('/health', async (req, res) => {
  try {
    const dbState = mongoose.connection.readyState;
    if (dbState === 1) {
      return res.status(200).json({ status: 'ok', db: 'connected' });
    }
    return res.status(503).json({ status: 'error', db: 'disconnected' });
  } catch (err) {
    return res.status(503).json({ status: 'error' });
  }
});

app.use(rateLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/calls", callRoutes);
app.use("/api/config", configRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/admin", adminRoutes);


app.use(globalErrorHandler);

const startServer = async () => {
  const requiredEnvVars = [
    'MONGODB_URI',
    'JWT_SECRET',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
  ];
  for (const varName of requiredEnvVars) {
    if (!process.env[varName]) {
      console.error(`Missing required environment variable: ${varName}`);
      process.exit(1);
    }
  }

  await connectDB();
  await seedAdmin();

  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
};

const gracefulShutdown = (signal) => {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    mongoose.connection.close(false).then(() => {
      console.log('MongoDB connection closed.');
      process.exit(0);
    });
  });
};
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

startServer();
