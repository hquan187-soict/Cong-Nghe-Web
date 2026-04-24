import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import connectDB from './lib/db.js';
import authRoutes from './routes/auth.routes.js';
import { globalErrorHandler } from './middleware/globalErrorHandler.js';
import userRoutes from './routes/user.routes.js';
import cors from 'cors';
import conversationRoutes from "./routes/conversation.routes.js";

//test import
import "./models/User.js";
import "./models/Conversation.js";
import "./models/Message.js";
import "./models/Call.js";

dotenv.config();

const app = express();  
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors({
  origin: process.env.CLIENT_URL, 
  credentials: true, 
}));
app.use(cookieParser());

app.get('/', (req, res) => {
  res.send('API is running');
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use("/api/conversations", conversationRoutes);

app.use(globalErrorHandler);

const startServer = async () => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
};

startServer();
