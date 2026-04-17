import express from "express";
import {
  registerUser,
  loginUser,
  sendFriendRequest,
  getPendingRequests,
  blockUser,
  unblockUser,
} from "../services/userService.js";
import { handleFriendRequest } from "../services/userService.js";
import { Request, Response } from "express";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Register Endpoint
router.post("/register", async (req, res) => {
  try {
    const data = await registerUser(req.body);
    res.status(201).json(data);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Login Endpoint
router.post("/login", async (req, res) => {
  try {
    const data = await loginUser(req.body);
    res.status(200).json(data);
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
});

router.post("/send/freindrequest", protect, async (req, res) => {
  try {
    const response = await sendFriendRequest(req);
    return res.send(response);
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
});

router.post(
  "/friendrequest/approve/:requestId",
  protect,
  async (req: Request, res: Response) => {
    try {
      const requestId = req.params.requestId as string;
      const userId = (req as any).user.id;

      const result = await handleFriendRequest(requestId, userId, "accept");
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },
);

router.post(
  "/friendrequest/reject/:requestId",
  protect,
  async (req: Request, res: Response) => {
    try {
      const requestId = req.params.requestId as string;
      const userId = (req as any).user.id;

      const result = await handleFriendRequest(requestId, userId, "reject");
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },
);

router.get(
  "/friendrequest/pending",
  protect,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const result = await getPendingRequests(userId);

      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },
);

router.post("/block", protect, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { targetId } = (req as any).query;
    const result = await blockUser(userId, targetId);
    res.send(result);
  } catch (error: any) {
    console.log(error.message);
  }
});

router.post("/unblock", protect, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { targetId } = (req as any).query;
    const result = await unblockUser(userId, targetId);
    res.send(result);
  } catch (error: any) {
    console.log(error.message);
  }
});
export default router;
