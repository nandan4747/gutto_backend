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
  unfriendUser,
  getBlockedUsers,
  searchUserConnections,
  resetPassword,
  resetFullName,
  toggleAccountType,
} from "../services/userService.js";
import { handleFriendRequest } from "../services/userService.js";
import { Request, Response } from "express";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();
const isProduction = process.env.NODE_ENV === "production";
const cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? ("none" as const) : ("lax" as const),
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

router.get("/me", protect, async (req: any, res) => {
  //console.log("Fetching user info for user ID:", req.user.id);
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

router.get("/profile/:userId", protect, async (req: any, res) => {
  try {
    await getUserById(
      req.params.userId,
      (user) => {
        res.status(200).send({
          _id: user._id,
          username: user.username,
          fullname: user.fullname,
          accountType: user.accountType,
        });
      },
      () => {
        res.status(404).send({ error: "User not found" });
      },
    );
  } catch (err: any) {
    res.status(404).json({ error: "User not found" });
  }
});
router.put("/password", protect, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).send({ error: "missing details" });
    }
    const result = await resetPassword(userId, oldPassword, newPassword);
    res.send(result);
  } catch (error: any) {
    res.status(500).send({
      error: error.message || "Couldn't reset",
    });
  }
});

router.put("/fullname", protect, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { fullname } = req.body;

    if (!fullname) {
      return res.status(400).json({
        success: false,
        message: "Please provide a 'fullname' in the request body.",
      });
    }

    const result = await resetFullName(userId, fullname);

    res.status(200).json(result);
  } catch (error: any) {
    console.error("Error updating fullname:", error.message);
    res.status(400).json({
      success: false,
      message: error.message || "Something broke while changing your name.",
    });
  }
});

router.put("/account-type/toggle", protect, async (req: any, res: any) => {
  try {
    const userId = req.user.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. Who are you again?",
      });
    }

    const result = await toggleAccountType(userId);

    res.status(200).json(result);
  } catch (error: any) {
    console.error("Error toggling account type:", error.message);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to flip the switch.",
    });
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

    // Extract query params (defaulting limit to 10 if some clown forgets to pass it)
    const cursor = req.query.cursor as string | undefined;
    const limit = parseInt(req.query.limit as string) || 10;

    const result = await getUserConnections(userId, cursor, limit);

    res.status(200).json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// routes (add next to the existing /connections route)
router.get("/connections/search", protect, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const username = (req.query.username as string)?.trim();

    if (!username) {
      return res
        .status(400)
        .json({ error: "username query param is required" });
    }

    const results = await searchUserConnections(userId, username);
    res.status(200).json({ data: results });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get("/blocked", protect, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const blockedUsers = await getBlockedUsers(userId);
    res.status(200).json(blockedUsers);
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

router.post("/unfriend", protect, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { targetId } = (req as any).query;

    if (!targetId) {
      throw new Error("Target ID is required to unfriend.");
    }

    const result = await unfriendUser(userId, targetId);
    res.status(200).send(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});
router.post("/logout", (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? ("none" as const) : ("lax" as const),
  });

  res.status(200).json({ message: "Successfully logged out. Goodbye." });
});

export default router;
