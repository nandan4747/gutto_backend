import { User } from "../models/User.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { FriendRequest } from "../models/FriendRequest.js";
import { Group } from "../models/Group.js";
import { escapeRegex } from "../utils/escapeRegex.js";

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
    user: {
      _id: user._id,
      username: user.username,
      fullname: user.fullname,
      accountType: user.accountType,
    },
    token: generateToken(user._id.toString()),
  };
};

export const resetPassword = async (
  _id: string,
  oldPassword: string,
  newPassword: string,
) => {
  try {
    const user = await User.findById(_id);
    if (!user) throw new Error("User not found.");

    if (!user.password)
      throw new Error("This user doesn't even have a password.");

    const isMatch = await bcrypt.compare(oldPassword, user.password);

    if (!isMatch) {
      throw new Error("Old password is incorrect. Nice try, though.");
    }

    const saltRounds = 10;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // 4. Update and save
    user.password = hashedNewPassword;
    await user.save();

    return {
      success: true,
      message: "Password successfully updated",
    };
  } catch (error: any) {
    console.error("Failed to reset password:", error.message);
    throw new Error(error.message || "Something went terribly wrong.");
  }
};

export const resetFullName = async (userId: string, newFullName: string) => {
  try {
    // Basic validation so people don't name themselves an empty string
    if (!newFullName || newFullName.trim().length === 0) {
      throw new Error(
        "You must have a name. Even 'McLovin' is better than an empty string.",
      );
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { fullname: newFullName.trim() },
      {
        new: true, // Returns the updated document instead of the old one
        runValidators: true, // Ensures it still respects your Schema rules
      },
    );

    if (!updatedUser) {
      throw new Error("User not found. Hard to rename a ghost.");
    }

    return {
      success: true,
      message: "Name successfully changed.",
      fullname: updatedUser.fullname,
    };
  } catch (error: any) {
    throw new Error(error.message || "Failed to update full name.");
  }
};

export const toggleAccountType = async (userId: string) => {
  try {
    // We need to fetch the user first to see what their current state is
    const user = await User.findById(userId);

    if (!user) {
      throw new Error("User not found. Are you sure you even exist?");
    }

    // The old switcheroo
    const newType = user.accountType === "private" ? "public" : "private";

    user.accountType = newType;
    await user.save();

    return {
      success: true,
      message: `Congratulations, your account is now ${newType}.`,
      accountType: newType,
    };
  } catch (error: any) {
    throw new Error(error.message || "Failed to toggle account type.");
  }
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
  isGroup: boolean,
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

export const getUserConnections = async (
  userId: string,
  cursor?: string,
  limit: number = 10,
) => {
  try {
    // If we have a cursor, fetch connections older (less than) the cursor's _id
    const matchQuery = cursor ? { _id: { $lt: cursor } } : {};

    const user = await User.findById(userId).populate({
      path: "connections",
      match: matchQuery,
      select: "username fullname accountType",
      options: {
        sort: { _id: -1 }, // Sort descending (newest first)
        limit: limit + 1, // Fetch one extra to see if there's more data
      },
    });

    if (!user) throw new Error("User not found");

    // Mongoose types can be annoying with populated arrays, hence the cast
    const connections = user.connections as any[];

    // Did we get more than our limit? That means there's a next page.
    const hasNextPage = connections.length > limit;
    if (hasNextPage) {
      connections.pop(); // Remove the sacrificial extra item we fetched
    }

    // Grab the _id of the last item to act as the cursor for the next request
    const nextCursor = hasNextPage
      ? connections[connections.length - 1]._id
      : null;

    return {
      data: connections,
      nextCursor,
    };
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
      .select("_id username fullname accountType")
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
      "username fullname accountType",
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

export const searchUserConnections = async (
  userId: string,
  username: string,
) => {
  try {
    const safeUsername = escapeRegex(username.trim());

    const user = await User.findById(userId).populate({
      path: "connections",
      match: { username: { $regex: safeUsername, $options: "i" } },
      select: "username fullname accountType",
      options: { limit: 10 }, // don't let one search dump the whole friend list
    });

    if (!user) throw new Error("User not found");

    return user.connections as any[];
  } catch (error: any) {
    throw new Error(`Failed to search connections: ${error.message}`);
  }
};
