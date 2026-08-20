import express from "express";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";
import connectDB from "./src/config/db.js";
import userRouter from "./src/routes/userRoutes.js";
import { socketProtect } from "./src/middleware/socketAuth.js";
import { messageHandler } from "./src/socket/socketHandler.js";
import groupChatRouter from "./src/routes/groupChatRoutes.js";
import chatRouter from "./src/routes/chatRoutes.js";
import cookieParser from "cookie-parser";
import cors from "cors";

dotenv.config();

const app = express();
const server = http.createServer(app);
app.set("trust proxy", 1);
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "https://en-samachara.vercel.app",
      "https://ensamachara.vercel.app",
    ],
    methods: ["GET", "POST", "DELETE", "PATCH", "PUT"],
    credentials: true,
  },
});
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://en-samachara.vercel.app",
      "https://ensamachara.vercel.app",
    ],
    credentials: true,
    methods: ["GET", "POST", "DELETE", "PATCH", "PUT"],
  }),
);

app.set("io", io);
app.use(express.json());
app.use(cookieParser());
io.use(socketProtect);

io.on("connection", (socket) => {
  // console.log(`User connected: ${socket.data.userId}`);
  messageHandler(io, socket);
});

app.get("/", (req, res) => {
  res.send({
    message: "server is online",
  });
});

app.use("/api/user", userRouter);
app.use("/api/chat", chatRouter);
app.use("/api/groupchat", groupChatRouter);

const port = process.env.PORT || 10000;

server.listen(port, () => {
  console.log(`server is online `);
});

try {
  console.log("connecting to db");
  await connectDB();
  console.log("connected to Database");
} catch (err) {
  console.log("failed to connect to database , error : ", err);
}
