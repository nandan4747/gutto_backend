import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { getUnreadSummary, getChatHistory } from "../services/chatServices.js";

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

router.get("/:senderId", protect, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { senderId } = req.params;
    const messages = await getChatHistory(userId, senderId);
    res.send(messages)
  } catch (error: any) {
    console.log("error whil fetching user messages : ", error.message);
  }
});

export default router;
