import express from "express";
import {
  registerUser,
  loginUser,
  sendFriendRequest,
  getPendingRequests,
  blockUser,
  unblockUser,
  forceReset,
  getUserById,
  searchUsers,
  getUserConnections,
} from "../services/userService.js";
import { handleFriendRequest } from "../services/userService.js";
import { Request, Response } from "express";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

const cookieOptions = {
  httpOnly: true, // Prevents JS access! No 'document.cookie' for hackers.
  secure: process.env.NODE_ENV === "production", // Only sends over HTTPS in production
  sameSite: "strict" as const, // Prevents CSRF attacks
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
};

router.get("/me", protect, async (req: any, res) => {
  console.log("Fetching user info for user ID:", req.user.id);
  try {
    await getUserById(
      req.user.id,
      (user) => {
        res.status(200).send({
          _id: user._id,
          username: user.username,
          fullname: user.fullname,
          accountType: user.accountType,
        });
      },
      () => {
        res.status(404).send();
      },
    );
  } catch (err: any) {
    res.status(404).json({ error: "User not found" });
  }
});
// Register Endpoint
router.post("/register", async (req, res) => {
  try {
    const { user, token } = await registerUser(req.body);
    res.cookie("token", token, cookieOptions);
    res.status(201).json(user);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Login Endpoint
router.post("/login", async (req, res) => {
  try {
    const { user, token } = await loginUser(req.body);
    res.cookie("token", token, cookieOptions);
    res.status(200).json(user);
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
});

router.post("/temp/reset/force", async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate that we actually got data
    if (!username || !password) {
      return res.status(400).send({ error: "Missing username or password" });
    }

    await forceReset({ username, password });

    res.send({
      message: "Password updated successfully. Try not to lose it this time.",
    });
  } catch (error: any) {
    console.error("Reset Error:", error.message); // Log the actual error for debugging
    res.status(500).send({
      error: error.message || "Couldn't reset",
    });
  }
});

router.get("/connections", protect, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const connections = await getUserConnections(userId);
    res.status(200).json(connections);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Query param is `q` to avoid colliding with anything else, e.g.
// GET /api/user/search?q=nandu
router.get("/search", protect, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const query = (req.query.q as string) || "";
    const results = await searchUsers(query, userId);
    res.status(200).json(results);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
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
