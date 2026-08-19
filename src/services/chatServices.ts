import { text } from "stream/consumers";
import { Message } from "../models/Message.js";
import mongoose from "mongoose";
import { deleteFileFromSupabase } from "./fileUploadService.js";

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
interface ChatHistoryResult {
  messages: any[]; // oldest -> newest, ready to render as-is
  nextCursor: string | null; // pass this back as `cursor` to fetch older messages
}

export const getChatHistory = async (
  userId: string,
  otherUserId: string,
  limit = 50,
  cursor?: string,
): Promise<ChatHistoryResult> => {
  try {
    const query: any = {
      $or: [
        { senderUserId: userId, reciverUserId: otherUserId },
        { senderUserId: otherUserId, reciverUserId: userId },
      ],
    };

    if (cursor) {
      if (!mongoose.Types.ObjectId.isValid(cursor)) {
        throw new Error("Invalid cursor");
      }
      query._id = { $lt: new mongoose.Types.ObjectId(cursor) };
    }

    const rows = await Message.find(query)
      .sort({ _id: -1 })
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    const lastMessage = page[page.length - 1];
    const nextCursor =
      hasMore && lastMessage ? lastMessage._id.toString() : null;

    //const nextCursor = hasMore ? page[page.length - 1]._id.toString() : null;

    const messages = [...page].reverse();

    return { messages, nextCursor };
  } catch (error: any) {
    console.log(error);
    throw new Error("Failed to fetch the tea. Check your connection.");
  }
};

export const getConversationList = async (userId: string) => {
  const currentUserId = new mongoose.Types.ObjectId(userId);

  const conversations = await Message.aggregate([
    // 1. Find all messages involving the current user
    {
      $match: {
        $or: [
          { senderUserId: currentUserId },
          { reciverUserId: currentUserId },
        ],
      },
    },
    // 2. Sort by latest first so the $group grab the newest message
    { $sort: { createdAt: -1 } },
    // 3. Group by the "Other Person"
    {
      $group: {
        _id: {
          $cond: [
            { $eq: ["$senderUserId", currentUserId] },
            "$reciverUserId",
            "$senderUserId",
          ],
        },
        latestMessage: { $first: "$$ROOT" },
        unreadCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$reciverUserId", currentUserId] },
                  { $eq: ["$isReaded", false] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
    // 4. Join with User collection to get their name/username
    {
      $lookup: {
        from: "users", // must match your mongo collection name
        localField: "_id",
        foreignField: "_id",
        as: "userDetails",
      },
    },
    // 5. Clean up the output
    { $unwind: "$userDetails" },
    {
      $project: {
        _id: 0,
        partner: {
          _id: "$userDetails._id",
          username: "$userDetails.username",
          fullname: "$userDetails.fullname",
        },
        latestMessage: {
          text: "$latestMessage.text",
          type: "$latestMessage.type",
          createdAt: "$latestMessage.createdAt",
          senderId: "$latestMessage.senderUserId",
        },
        unreadCount: 1,
      },
    },
    // 6. Final sort to ensure the person with the newest chat is at the top
    { $sort: { "latestMessage.createdAt": -1 } },
  ]);

  return conversations;
};

export const markConversationAsRead = async (
  readerId: string,
  senderId: string,
) => {
  try {
    const result = await Message.updateMany(
      {
        senderUserId: senderId, // The person who sent the messages
        reciverUserId: readerId, // The person (You) reading them (holding onto the typo for dear life)
        isReaded: false, // No point in reading what's already been read
      },
      {
        $set: { isReaded: true },
      },
    );

    /* console.log(
    `✅ ${result.modifiedCount} messages now have the "I'm not ghosting you" status.`,
    );*/
    return result;
  } catch (error) {
    console.error("Failed to mark messages as read:", error);
    throw error;
  }
};
export const deleteMessage = async (messageId: string, userId: string) => {
  const message = await Message.findById(messageId);

  if (!message) {
    const error: any = new Error("Message not found");
    error.statusCode = 404;
    throw error;
  }

  if (message.senderUserId.toString() !== userId) {
    const error: any = new Error("Unauthorized to delete this message");
    error.statusCode = 403;
    throw error;
  }

  // 1. Snapshot the details needed for Socket events BEFORE deleting
  const deletedData = {
    messageId: message._id.toString(),
    senderUserId: message.senderUserId.toString(),
    reciverUserId: message.reciverUserId
      ? message.reciverUserId.toString()
      : null,
    text: "<this message is deleted by sender>.",
  };

  // 2. Permanently erase it from the DB
  await message.deleteOne(); // Or Message.findByIdAndDelete(messageId);

  // 3. Return the snapshot so your controller/socket can broadcast the removal
  return deletedData;
};

// Replace deleteFileMessage in src/services/chatServices.ts

export const deleteFileMessage = async (userId: string, messageId: string) => {
  const message = await Message.findById(messageId);

  if (!message) {
    const error: any = new Error("Message not found");
    error.statusCode = 404;
    throw error;
  }

  if (message.senderUserId.toString() !== userId) {
    const error: any = new Error("Unauthorized to delete this message");
    error.statusCode = 403;
    throw error;
  }
  if (
    (message.type === "image" || message.type === "file") &&
    message.storagePath
  ) {
    await deleteFileFromSupabase(message.storagePath);
  }

  // Snapshot what the socket broadcast needs BEFORE the row is gone —
  // same pattern as your text deleteMessage.
  const deletedData = {
    messageId: message._id.toString(),
    senderUserId: message.senderUserId.toString(),
    reciverUserId: message.reciverUserId
      ? message.reciverUserId.toString()
      : null,
  };

  await message.deleteOne();

  return deletedData;
};
