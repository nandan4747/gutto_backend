import { User } from "../models/User.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { FriendRequest } from "../models/FriendRequest.js";
import { Group } from "../models/Group.js";

const JWT_SECRET = process.env.JWT_SECRET || "super_secret_gutto";

// 1. Generate Token Utility
export const generateToken = (mongoId: string) => {
  return jwt.sign({ id: mongoId }, JWT_SECRET, { expiresIn: "7d" });
};

export const getUserById = async (
  userId: string,
  userFound: (user: any) => void,
  userNotFound: () => void,
) => {
  try {
    const user = await User.findById(userId);
    if (user) {
      userFound(user);
    } else {
      userNotFound();
    }
  } catch (error: any) {
    throw new Error(`Failed to fetch user: ${error.message}`);
  }
};

// 2. Register Logic
export const registerUser = async (userData: any) => {
  const { username, fullname, password, accountType } = userData;

  // Check if user already exists
  const existingUser = await User.findOne({ username });
  if (existingUser) throw new Error("Username already taken!");

  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = await User.create({
    username,
    fullname,
    password: hashedPassword,
    accountType: !accountType ? "private" : accountType,
  });

  return {
    user: {
      _id: newUser._id,
      username: newUser.username,
      fullname: newUser.fullname,
    },
    token: generateToken(newUser._id.toString()),
  };
};

// 3. Login Logic
export const loginUser = async (credentials: any) => {
  const { username, password } = credentials;

  const user = await User.findOne({ username });
  if (!user) throw new Error("User not found!");
  //console.log(user.password);

  const isMatch = await bcrypt.compare(password, user.password as string);
  if (!isMatch) throw new Error("Invalid credentials!");

  return {
    user: { _id: user._id, username: user.username, fullname: user.fullname },
    token: generateToken(user._id.toString()),
  };
};

export const forceReset = async (credentials: any) => {
  const { username, password } = credentials;

  // 1. Await the hash FIRST
  const hashedPassword = await bcrypt.hash(password, 10);

  // 2. Use $set because password is a String, not an Array
  const result = await User.updateOne(
    { username },
    { $set: { password: hashedPassword } },
  );

  if (result.matchedCount === 0) {
    throw new Error("User not found");
  }

  return result;
};
export const sendFriendRequest = async (req: any) => {
  const senderId = req.user.id;
  const { receiverId } = req.body;

  try {
    // 1. Fetch the target user
    const destinationUser = await User.findById(receiverId).select(
      "connections accountType blockedUsers",
    );

    if (!destinationUser) throw new Error("User not found");
    const isBlocked = destinationUser.blockedUsers.some((uid) =>
      uid.equals(senderId),
    );
    const isAlreadyConnected = destinationUser.connections.some((uid) =>
      uid.equals(senderId),
    );

    if (isBlocked || isAlreadyConnected) {
      throw new Error("Unable to send connection request");
    }

    if (destinationUser.accountType === "private") {
      const existingRequest = await FriendRequest.findOne({
        senderId,
        receiverId,
      });

      if (existingRequest) throw new Error("Request already pending");

      const newRequest = await FriendRequest.create({
        senderId,
        receiverId,
      });

      return {
        message: "Friend request sent",
        requestStatus: "success",
        friendRequestStatus: "pending",
      };
    }

    await Promise.all([
      User.updateOne(
        { _id: receiverId },
        { $addToSet: { connections: senderId } },
      ),
      User.updateOne(
        { _id: senderId },
        { $addToSet: { connections: receiverId } },
      ),
    ]);

    return {
      message: "Connection established automatically",
      requestStatus: "success",
      friendRequestStatus: "accepted",
    };
  } catch (error: any) {
    console.error(`Friend Request Error: ${error.message}`);
    // Don't just throw a generic error; tell the user why it actually failed
    throw new Error(error.message || "Failed to process connection");
  }
};

export const handleFriendRequest = async (
  requestId: string,
  userId: string,
  action: "accept" | "reject",
) => {
  try {
    // 1. Find the request and ensure the current user is the actual receiver
    const request = await FriendRequest.findById(requestId);

    if (!request) throw new Error("Friend request not found.");

    if (!request.receiverId.equals(userId)) {
      throw new Error("Nice try, but this request isn't for you.");
    }

    if (request.status !== "pending") {
      throw new Error(`This request has already been ${request.status}.`);
    }

    if (action === "reject") {
      await FriendRequest.findByIdAndUpdate(requestId, { status: "rejected" });
      return { message: "Request rejected. Ouch.", status: "rejected" };
    }

    await Promise.all([
      FriendRequest.findByIdAndUpdate(requestId, { status: "accepted" }),
      User.updateOne(
        { _id: request.senderId },
        { $addToSet: { connections: request.receiverId } },
      ),
      User.updateOne(
        { _id: request.receiverId },
        { $addToSet: { connections: request.senderId } },
      ),
    ]);

    return {
      message: "You are now connected! Go forth and chat.",
      status: "accepted",
    };
  } catch (error: any) {
    console.error(`Handle Request Error: ${error.message}`);
    throw new Error(error.message || "Failed to process request.");
  }
};

export const getPendingRequests = async (userId: string) => {
  try {
    // Find requests where the current user is the RECEIVER and status is PENDING
    const requests = await FriendRequest.find({
      receiverId: userId,
      status: "pending",
    })
      .populate("senderId", "username fullname") // Fetch sender details, but keep their password hidden!
      .sort({ createdAt: -1 }); // Newest requests first

    return {
      count: requests.length,
      requests,
    };
  } catch (error: any) {
    console.error(`Fetch Requests Error: ${error.message}`);
    throw new Error("Failed to fetch pending requests. Maybe they're hiding?");
  }
};

export const blockUser = async (userId: string, targetId: string) => {
  if (userId === targetId) {
    throw new Error(
      "You can't block yourself. If you need a break, just close the app.",
    );
  }

  try {
    await User.updateOne(
      { _id: userId },
      { $addToSet: { blockedUsers: targetId } },
    );

    return { message: "User blocked successfully." };
  } catch (error: any) {
    throw new Error(`Blocking failed: ${error.message}`);
  }
};

export const unblockUser = async (userId: string, targetId: string) => {
  try {
    const result = await User.updateOne(
      { _id: userId },
      { $pull: { blockedUsers: targetId } },
    );

    if (result.modifiedCount === 0) {
      throw new Error("This user wasn't even blocked. You're fighting ghosts.");
    }

    return { message: "User unblocked. Maybe give them a second chance?" };
  } catch (error: any) {
    throw new Error(`Unblocking failed: ${error.message}`);
  }
};

export const canUsersCommunicate = async (
  senderId: string,
  receiverId: string,
  isGroup: boolean
) => {
  try {

    if (isGroup) {
      const group = await Group.findById(receiverId).select("members");
      if (!group) return false;
      const isMember = group.members.some((id) => id.equals(senderId));
      return isMember;
    }
    // We check both users at once for efficiency
    const users = await User.find({
      _id: { $in: [senderId, receiverId] },
    }).select("blockedUsers");

    const sender = users.find((u) => u._id.equals(senderId));
    const receiver = users.find((u) => u._id.equals(receiverId));

    if (!sender || !receiver) return false;

    // 1. Did the receiver block the sender?
    const isSenderBlocked = receiver.blockedUsers.some((id) =>
      id.equals(senderId),
    );

    // 2. Did the sender block the receiver? (Preventing self-sabotage)
    const isReceiverBlocked = sender.blockedUsers.some((id) =>
      id.equals(receiverId),
    );

    return !isSenderBlocked && !isReceiverBlocked;
  } catch (error) {
    console.error("Block check failed:", error);
    return false; // Safely fail-closed (no message if DB is acting up)
  }
};

export const validateMessagePermission = async (
  senderId: string,
  receiverId: string,
) => {
  try {
    const receiver = await User.findById(receiverId).select(
      "accountType connections",
    );
    if (!receiver) {
      return false;
    }

    const isFriend = receiver.connections.some((id) => id.equals(senderId));
    return isFriend;
  } catch (error) {
    console.error("Gatekeeper error:", error);
    return { allowed: false, reason: "Internal error" };
  }
};

// Add these two functions to src/services/userService.ts

export const getUserConnections = async (userId: string) => {
  try {
    const user = await User.findById(userId).populate(
      "connections",
      "username fullname accountType",
    );
    if (!user) throw new Error("User not found");
    return user.connections;
  } catch (error: any) {
    throw new Error(`Failed to fetch connections: ${error.message}`);
  }
};

export const searchUsers = async (query: string, excludeUserId: string) => {
  try {
    const term = query.trim();
    if (!term) return [];

    const regex = new RegExp(term, "i");
    const users = await User.find({
      _id: { $ne: excludeUserId },
      $or: [{ username: regex }, { fullname: regex }],
    })
      .select("username fullname accountType")
      .limit(20);

    return users;
  } catch (error: any) {
    throw new Error(`Search failed: ${error.message}`);
  }
};

export const getBlockedUsers = async (userId: string) => {
  try {
    const user = await User.findById(userId).populate(
      "blockedUsers",
      "username fullname accountType"
    );
    if (!user) throw new Error("User not found");
    return user.blockedUsers;
  } catch (error: any) {
    throw new Error(`Failed to fetch blocked users: ${error.message}`);
  }
};

export const unfriendUser = async (userId: string, targetId: string) => {
  if (userId === targetId) {
    throw new Error("You can't unfriend yourself.");
  }

  try {
    await Promise.all([
      User.updateOne({ _id: userId }, { $pull: { connections: targetId } }),
      User.updateOne({ _id: targetId }, { $pull: { connections: userId } }),
    ]);

    return { message: "User unfriended and removed from connections." };
  } catch (error: any) {
    throw new Error(`Unfriending failed: ${error.message}`);
  }
};
