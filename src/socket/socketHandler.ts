import { Socket } from "socket.io";

import {
  canUsersCommunicate,
  validateMessagePermission,
} from "../services/userService.js";

import { Group } from "../models/Group.js";
import { IIncomingMessage } from "../../types.js";

import { Message } from "../models/Message.js";

const joinUserGroups = async (socket: Socket, userId: string) => {
  socket.join(userId); // join own room

  try {
    const userGroups = await Group.find({ members: userId }).select("_id");
    userGroups.forEach((group) => {
      socket.join(group._id.toString());
    });
    console.log(`User ${userId} joined ${userGroups.length} groups`);
  } catch (err) {
    console.error("Error joining groups:", err);
  }
};

export const messageHandler = (io: any, socket: Socket) => {
  const authenticatedUserId = socket.data.userId;
  if (!authenticatedUserId) return;

  socket.on("message", async (incomingData: IIncomingMessage) => {
    const data = Array.isArray(incomingData) ? incomingData[0] : incomingData;
    const { receiverId, text, isGroup, type, url } = data;
    console.log(`message : ${text}`);
    try {
      // checking if user blocked
      const canProceed = await canUsersCommunicate(
        authenticatedUserId,
        receiverId,
      );
      if (!canProceed) {
        socket.emit("alerts", "Message not sent");
        return;
      }
      let savedMessage: any;
      if (isGroup) {
        const savedMessage = await saveMessageToDB(
          authenticatedUserId,
          receiverId,
          text,
          type,
          url,
        );

        const messagePayload = {
          _id: savedMessage._id,
          text: savedMessage.text,
          from: authenticatedUserId,
          type: savedMessage.type,
          url: savedMessage.url,
          createdAt: savedMessage.createdAt,
        };
        io.to(receiverId).emit("newGroupMessage", {
          ...messagePayload,
          groupId: receiverId,
        });
      } else {
        const canSend = await validateMessagePermission(
          authenticatedUserId,
          receiverId,
        );
        if (!canSend) {
          console.log("not a freind");
          return socket.emit("alerts", "account is private");
        }
        savedMessage = await saveMessageToDB(
          authenticatedUserId,
          receiverId,
          text,
          type,
          url,
        );

        const messagePayload = {
          _id: savedMessage._id,
          text: savedMessage.text,
          from: authenticatedUserId,
          type: savedMessage.type,
          url: savedMessage.url,
          createdAt: savedMessage.createdAt,
        };
        io.to(receiverId).emit("newMessage", messagePayload);
      }

      // In messageHandler, after saving:
      socket.emit("messageSent", {
        _id: savedMessage._id,
        tempId: data.tempId,
        receiverId,
        text: savedMessage.text,
        type: savedMessage.type,
        createdAt: savedMessage.createdAt,
      });
    } catch (error) {
      console.error("DB Error:", error);
      socket.emit("error", { message: "Failed to save message" });
    }
  });

  console.log(`📨 Message listener registered for user ${authenticatedUserId}`);

  joinUserGroups(socket, authenticatedUserId);

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
};

const saveMessageToDB = async (
  authenticatedUserId: string,
  receiverId: string,
  text: string,
  type: string,
  url: string,
) => {
  const savedMessage = await Message.create({
    senderUserId: authenticatedUserId,
    reciverUserId: receiverId,
    text,
    type: type || "text",
    url: url || "",
    isReaded: false,
  });
  return savedMessage;
};
