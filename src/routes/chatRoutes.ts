import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  getUnreadSummary,
  getChatHistory,
  getConversationList,
  markConversationAsRead,
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
    const messages = await getChatHistory(userId, senderId);
    res.send(messages);
  } catch (error: any) {
    console.log("error whil fetching user messages : ", error.message);
  }
});

export default router;
