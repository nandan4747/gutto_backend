import { Server, Socket } from "socket.io";
import { IIncomingMessage } from "../types.js";

export const registerChatHandlers = (io: Server, socket: Socket) => {
  const userId = socket.handshake.query.userId as string;

  if (userId) {
    socket.join(userId);
    socket.data.userId = userId;
  }

  const handleMessage = (UserMessage: IIncomingMessage) => {
    const { receiverId, text } = UserMessage;
    io.to(receiverId).emit("newMessage", {
      text,
      from: socket.data.userId,
    });
  };

  socket.on("message", handleMessage);
};
