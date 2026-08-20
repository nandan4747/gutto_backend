import { Socket } from "socket.io";
import jwt from "jsonwebtoken";

export const socketProtect = (socket: Socket, next: (err?: Error) => void) => {
  const token = socket.handshake.auth?.token;

  if (!token) {
    return next(new Error("Authentication error: no token provided"));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    socket.data.userId = decoded.id;
    next();
  } catch (err) {
    next(new Error("Authentication error: invalid token"));
  }
};
