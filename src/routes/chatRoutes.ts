import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  getUnreadSummary,
  getChatHistory,
  getConversationList,
  markConversationAsRead,
  deleteMessage,
} from "../services/chatServices.js";

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
    const { senderUserId, reciverUserId, text } = deletedMessage;

    // Broadcast to recipient
    io.to(reciverUserId).emit("message_deleted", {
      messageId: deletedMessage.messageId,
      conversationId: senderUserId,
      text,
    });

    // Broadcast to sender's other devices/tabs
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

export default router;
