import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  getUnreadSummary,
  getChatHistory,
  getConversationList,
  markConversationAsRead,
  deleteMessage,
  deleteFileMessage,
} from "../services/chatServices.js";
import {
  canUsersCommunicate,
  validateMessagePermission,
} from "../services/userService.js";
import multer from "multer";
import { uploadFileToSupabase } from "../services/fileUploadService.js";
import { Message } from "../models/Message.js";
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});
import { Response } from "express";

const router = express.Router();

router.get("/unreaded", protect, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const messages = await getUnreadSummary(userId);
    res.send(messages);
  } catch (error: any) {
    console.log("error while getting unreaded messages : ", error.message);
    res.status(401).send({
      error: "unable to fetch unreaded messages",
    });
  }
});

router.get("/conversations", protect, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const conversation = await getConversationList(userId);
    res.send(conversation);
  } catch (error) {
    console.log("error : enable to fetch user converstaion list  : ", error);
    res.status(401).send({ error: "unable to get converstaion list" });
  }
});

router.get("/markasread", protect, async (req: any, res: any) => {
  const reciverId = req.user.id;
  const senderId = req.query.senderId;

  // We await this because we want to be sure it worked before saying "Done!"
  try {
    await markConversationAsRead(reciverId, senderId);
    res.sendStatus(201);
  } catch (error: any) {
    console.log("Error while marking as read:", error.message);
    res.status(500).json({ message: "Failed to update read status" });
  }
});

router.get("/:senderId", protect, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { senderId } = req.params;
    const { cursor, limit } = req.query;

    const result = await getChatHistory(
      userId,
      senderId,
      limit ? parseInt(limit as string, 10) : 50,
      typeof cursor === "string" ? cursor : undefined,
    );

    res.status(200).send(result); // { messages, nextCursor }
  } catch (error: any) {
    console.log("error whil fetching user messages : ", error.message);
    res.status(500).send({ error: "unable to fetch chat history" });
  }
});

router.delete("/:messageId", protect, async (req: any, res: any) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    const deletedMessage = await deleteMessage(messageId, userId);

    const io = req.app.get("io");
    const { senderUserId, reciverUserId, isGroup, text } = deletedMessage;

    // Recipients key their conversation state by groupId for group chats,
    // but by the sender's id for DMs — pick whichever matches what the
    // OTHER side's client actually has stored.
    io.to(reciverUserId).emit("message_deleted", {
      messageId: deletedMessage.messageId,
      conversationId: isGroup ? reciverUserId : senderUserId,
      text,
    });

    // Broadcast to sender's other devices/tabs — from the sender's own
    // point of view the conversation is always keyed by reciverUserId
    // (the partner id, or the groupId).
    io.to(senderUserId).emit("message_deleted", {
      messageId: deletedMessage.messageId,
      conversationId: reciverUserId,
      text,
    });

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("Error deleting message:", error.message);
    const status = error.statusCode || 500;
    return res
      .status(status)
      .json({ error: error.message || "Failed to delete message" });
  }
});

router.post(
  "/message/file",
  protect,
  (req: any, res: any, next: any) => {
    upload.single("file")(req, res, (err: any) => {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(413).json({ error: "File too large (max 25MB)" });
        }
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  },
  async (req: any, res: Response) => {
    try {
      const senderId = req.user.id;
      const { receiverId, isGroup, text } = req.body;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: "No file provided" });
      }
      if (!receiverId) {
        return res.status(400).json({ error: "receiverId is required" });
      }

      const isGroupBool = isGroup === "true" || isGroup === true;

      const canProceed = await canUsersCommunicate(
        senderId,
        receiverId,
        isGroupBool,
      );
      if (!canProceed) {
        return res.status(403).json({ error: "Message not sent" });
      }

      if (!isGroupBool) {
        const canSend = await validateMessagePermission(senderId, receiverId);
        if (!canSend) {
          return res.status(403).json({ error: "account is private" });
        }
      }

      const messageType = file.mimetype.startsWith("image/") ? "image" : "file";

      const { url, storagePath } = await uploadFileToSupabase(
        file.buffer,
        file.originalname,
        file.mimetype,
      );

      const savedMessage = await Message.create({
        senderUserId: senderId,
        reciverUserId: receiverId,
        text: text || "",
        type: messageType,
        url,
        storagePath,
        fileName: file.originalname,
        isReaded: false,
      });

      const messagePayload = {
        _id: savedMessage._id,
        text: savedMessage.text,
        from: senderId,
        type: savedMessage.type,
        url: savedMessage.url,
        fileName: savedMessage.fileName,
        createdAt: savedMessage.createdAt,
      };

      // Same event names + room-targeting convention as the socket text
      // path in socketHandler.ts, so the frontend needs zero new event
      // handlers to receive file messages.
      const io = req.app.get("io");
      if (isGroupBool) {
        io.to(receiverId).emit("newGroupMessage", {
          ...messagePayload,
          groupId: receiverId,
        });
      } else {
        io.to(receiverId).emit("newMessage", messagePayload);
      }

      res.status(201).json(savedMessage);
    } catch (error: any) {
      console.error("Error uploading file message:", error.message);
      res.status(500).json({ error: "Failed to upload file" });
    }
  },
);

// Replace the DELETE "/message/file/:messageId" route in chatRoutes.ts

router.delete(
  "/message/file/:messageId",
  protect,
  async (req: any, res: Response) => {
    try {
      const userId = req.user.id;
      const { messageId } = req.params;

      const deletedMessage = await deleteFileMessage(userId, messageId);
      const { senderUserId, reciverUserId, isGroup } = deletedMessage;

      if (reciverUserId) {
        const io = req.app.get("io");

        // Same conversationId convention as the text-delete route above.
        io.to(reciverUserId).emit("message_deleted", {
          messageId: deletedMessage.messageId,
          conversationId: isGroup ? reciverUserId : senderUserId,
        });

        io.to(senderUserId).emit("message_deleted", {
          messageId: deletedMessage.messageId,
          conversationId: reciverUserId,
        });
      }

      res.status(200).json({
        message: "Message deleted",
        messageId: deletedMessage.messageId,
      });
    } catch (error: any) {
      console.error("Error deleting message:", error.message);
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json({ error: error.message });
    }
  },
);

export default router;
