import jwt from "jsonwebtoken";
import { Socket } from "socket.io";
import cookie from "cookie";

export const socketProtect = (socket: Socket, next: (err?: Error) => void) => {
  // 1. Read raw cookie header from the handshake
  const rawCookies = socket.handshake.headers.cookie;


  if (!rawCookies) {
    return next(new Error("Authentication error: No cookies found"));
    
  }

  // 2. Parse cookies and extract your token
  const cookies = cookie.parse(rawCookies);
  const token = cookies["token"]; // 👈 match the name you used when setting the cookie

  if (!token) {
    return next(new Error("Authentication error: No token in cookies"));
  }

  try {
    // 3. Verify the token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "super_secret_gutto",
    ) as { id: string };

    socket.data.userId = decoded.id;
    next();
  } catch (err) {
    next(new Error("Authentication error: Invalid token"));
  }
};
