import { Group } from "../models/Group.js";
import { Message } from "../models/Message.js";

export const createGroup = async (name: string, adminId: string, memberIds: string[] = []) => {
  try {
    // Ensure the admin is always part of the members list
    const allMembers = Array.from(new Set([...memberIds, adminId]));

    const newGroup = await Group.create({
      name,
      admin: adminId,
      members: allMembers,
    });

    return newGroup;
  } catch (error: any) {
    throw new Error(`Failed to create group: ${error.message}`);
  }
};

// 2. Delete a Group (Admin only!)
export const deleteGroup = async (groupId: string, userId: string) => {
  try {
    const group = await Group.findById(groupId);

    if (!group) throw new Error("Group not found.");

    // Check if the person trying to delete is actually the boss
    if (!group.admin.equals(userId)) {
      throw new Error("Only the admin can dismantle this empire.");
    }

    await Group.findByIdAndDelete(groupId);
    return { message: "Group deleted successfully. Memories erased." };
  } catch (error: any) {
    throw new Error(error.message);
  }
};

// 3. Add User to Group
export const addUserToGroup = async (groupId: string, adminId: string, newUserIds: string[]) => {
  try {
    const group = await Group.findById(groupId);
    if (!group) throw new Error("Group doesn't exist.");

    if (!group.admin.equals(adminId)) {
      throw new Error("You don't have the power to invite people here.");
    }

    // Use $addToSet to prevent duplicates—because nobody wants to be in the same group twice.
    const updatedGroup = await Group.findByIdAndUpdate(
      groupId,
      { $addToSet: { members: { $each: newUserIds } } },
      { new: true }
    ).populate("members", "username fullname");

    return updatedGroup;
  } catch (error: any) {
    throw new Error(error.message);
  }
};

// 4. Remove User from Group (Or Leave Group)
export const removeUserFromGroup = async (groupId: string, requesterId: string, targetUserId: string) => {
  try {
    const group = await Group.findById(groupId);
    if (!group) throw new Error("Group not found.");

    // Logic: You can remove someone if you are the admin, OR you can remove yourself (leaving).
    const isAdmin = group.admin.equals(requesterId);
    const isSelfLeaving = requesterId === targetUserId;

    if (!isAdmin && !isSelfLeaving) {
      throw new Error("You can't just kick people out of a group you don't run.");
    }

    // Don't let the admin leave if they are the only ones left (or handle admin transfer)
    if (group.admin.equals(targetUserId) && isSelfLeaving && group.members.length > 1) {
      throw new Error("You are the admin. You can't just abandon your post without promoted someone else first!");
    }

    const updatedGroup = await Group.findByIdAndUpdate(
      groupId,
      { $pull: { members: targetUserId } },
      { new: true }
    );

    return { message: "User removed.", updatedGroup };
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const getUserGroups = async (userId: string) => {
  try {
    const groups = await Group.find({
      members: userId // MongoDB automatically checks if the ID exists in the array
    })
      .populate("admin", "username fullname") // See who the "Great Leader" is
      .populate("members", "username fullname") // See the rest of the squad
      .sort({ updatedAt: -1 });

    return {
      count: groups.length,
      groups
    };
  } catch (error: any) {
    console.error(`Error fetching user groups: ${error.message}`);
    throw new Error("Failed to retrieve your groups. Did you get kicked out of all of them?");
  }
};

export const getGroupMessages = async (groupId: string, userId: string, limit = 50, cursor?: string) => {
  try {
    // console.log("getting messages ---------------------------------------------------");
    // 1. Security Check: Is the user actually IN this group?
    // Good job checking this, we don't want randos reading the group chat.
    const group = await Group.findOne({ _id: groupId, members: userId });

    if (!group) {
      throw new Error("You are not a member of this group or the group doesn't exist.");
    }

    // 2. Build the query object
    const query: any = { reciverUserId: groupId };

    // If a cursor is provided, we want messages OLDER than the cursor
    if (cursor) {
      query._id = { $lt: cursor };
    }

    // 3. Fetch messages
    const messages = await Message.find(query)
      .populate("senderUserId", "username fullname")
      .sort({ _id: -1 }) // Sort by _id (newest first). Safer than createdAt for cursors.
      .limit(limit);

    if (messages.length === 0) {
      return {
        messages: [],
        nextCursor: null
      }
    }
    // 4. Calculate the next cursor
    // The last item in our descending array is the oldest message of this batch.
    // If we fetched 'limit' amount of messages, there might be more history to load.
    const nextCursor = messages.length === limit ? messages[messages.length - 1]._id : null;

    // 5. Return them in chronological order (oldest to newest) for the UI
    // Because reading conversation backward is only fun if you're Christopher Nolan.
    return {
      messages: messages.reverse(),
      nextCursor
    };
  } catch (error: any) {
    console.error(`Error fetching group chat: ${error.message}`);
    throw new Error(error.message || "Failed to load group history.");
  }
};