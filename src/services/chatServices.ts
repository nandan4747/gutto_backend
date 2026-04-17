import { Message } from "../models/Message.js";
import mongoose from "mongoose";

// Get the actual message objects
export const getUnreadMessages = async (userId: string) => {
  try {
    const unreadMessages = await Message.find({
      reciverUserId: userId, // Using your schema's typo
      isReaded: false, // Using your schema's typo
    })
      .populate("senderUserId", "username fullname") // So you know who to be mad at
      .sort({ createdAt: -1 });

    return unreadMessages;
  } catch (error: any) {
    console.error(`Error fetching unread messages: ${error.message}`);
    throw new Error("Could not retrieve your unread messages.");
  }
};

// Get just the count (for the notification badge)
export const getUnreadCount = async (userId: string) => {
  try {
    const count = await Message.countDocuments({
      reciverUserId: userId,
      isReaded: false,
    });
    return { unreadCount: count };
  } catch (error: any) {
    throw new Error("Failed to count your lonely unread messages.");
  }
};

export const getUnreadSummary = async (userId: string) => {
  try {
    const summary = await Message.aggregate([
      // 1. Find all unread messages for this user
      {
        $match: {
          reciverUserId: new mongoose.Types.ObjectId(userId),
          isReaded: false,
        },
      },
      // 2. Group them by the sender
      {
        $group: {
          _id: "$senderUserId",
          unreadCount: { $sum: 1 },
          lastMessage: { $last: "$text" }, // Optional: show a snippet of the last message
          lastTimestamp: { $last: "$createdAt" },
        },
      },
      // 3. Join with User collection to get names
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "senderDetails",
        },
      },
      // 4. Clean up the output
      { $unwind: "$senderDetails" },
      {
        $project: {
          _id: 1,
          unreadCount: 1,
          lastMessage: 1,
          lastTimestamp: 1,
          username: "$senderDetails.username",
          fullname: "$senderDetails.fullname",
        },
      },
      { $sort: { lastTimestamp: -1 } },
    ]);

    return summary;
  } catch (error: any) {
    throw new Error(`Aggregation failed: ${error.message}`);
  }
};
export const getChatHistory = async (userId: string, otherUserId: string, limit = 50) => {
  try {
    const messages = await Message.find({
      $or: [
        { senderUserId: userId, reciverUserId: otherUserId },
        { senderUserId: otherUserId, reciverUserId: userId }
      ]
    })
    .sort({ createdAt: 1 }) // Order by time so the chat flows correctly
    .limit(limit);

    return messages;
  } catch (error: any) {
    throw new Error("Failed to fetch the tea. Check your connection.");
  }
};