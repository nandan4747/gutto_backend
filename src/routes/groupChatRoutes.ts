import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { Request, Response } from "express";
import {
  createGroup,
  deleteGroup,
  addUserToGroup,
  removeUserFromGroup,
  getUserGroups,
  getGroupMessages,
} from "../services/groupChatService.js";

const router = express.Router();

router.get("/", protect, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const groupChatdetails = await getUserGroups(userId);
    res.send(groupChatdetails);
  } catch (error: any) {
    res.status(401).send({
      error: error.message,
    });
  }
});

router.get(
  "/:groupId/messages",
  protect,
  async (req: Request, res: Response) => {
    try {
      const groupId = req.params.groupId as string;
      const userId = (req as any).user.id;

      // We pass a limit from the query string if it exists, otherwise default to 50
      const limit = parseInt(req.query.limit as string) || 50;

      const messages = await getGroupMessages(groupId, userId, limit);
      res.status(200).json(messages);
    } catch (err: any) {
      res.status(403).json({ error: err.message });
    }
  },
);

router.post("/", protect, async (req: any, res) => {
  try {
    const adminId = req.user.id;
    const { newMembers, groupChatName } = req.body;
    console.log("executing request");
    console.log(
      `admin id : ${adminId} newMember : ${!newMembers ? [] : newMembers} chat name : ${groupChatName}`,
    );

    if (!adminId || !newMembers) {
      console.log("creating group ");
      const newgroup = await createGroup(
        groupChatName,
        adminId,
        !newMembers ? [] : newMembers,
      );
      res.send(newgroup);
    }
  } catch (err: any) {
    console.error("error while creating new Group chat : ", err.message);
    res.status(401).send({
      error: "unable to create new Group chat ",
    });
  }
});

router.delete("/", protect, async (req: any, res) => {
  try {
    const adminId = req.user.id;
    const { groupId } = req.body;
    const { message } = await deleteGroup(groupId, adminId);
    res.send(message);
  } catch (err: any) {
    console.log("error while deleting group chat : ", err.message);
    res.status(401).send({
      error: "unable to delete user at the moment",
    });
  }
});

router.post("/member", protect, async (req: any, res) => {
  try {
    const adminId = req.user.id;
    const { groupId, newMembers } = req.body;
    const dbResponse = await addUserToGroup(groupId, adminId, newMembers);
    res.send(dbResponse);
  } catch (err: any) {
    console.log("error while adding a new user to group chat : ", err.message);
    res.status(401).send({
      error: " unable to add new user to the group chat",
    });
  }
});

router.delete("/member", protect, async (req: any, res) => {
  try {
    const adminId = req.user.id;
    const { groupId, targetId } = req.body;
    const dbResponse = await removeUserFromGroup(groupId, adminId, targetId);
    res.send({ ...dbResponse, message: "user removed" });
  } catch (err: any) {
    console.log("error while adding a new user to group chat : ", err.message);
    res.status(401).send({
      error: " unable to remove user to the group chat",
    });
  }
});
export default router;
