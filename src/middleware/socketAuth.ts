import jwt from "jsonwebtoken";
import { Socket } from "socket.io";

export const socketProtect = (socket: Socket, next: (err?: Error) => void) => {
  // 1. Get token from the 'auth' object (sent from frontend)
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;

  if (!token) {
    return next(new Error("Authentication error: No token provided"));
  }

  try {
    // 2. Verify the token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "super_secret_gutto",
    ) as { id: string };

    // 3. Attach the ID to the socket so all handlers can see it
    socket.data.userId = decoded.id;

    next(); // All good, proceed to connection
  } catch (err) {
    next(new Error("Authentication error: Invalid token"));
  }
};
