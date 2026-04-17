import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export const protect = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ error: "Not authorized, no token found." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    (req as any).user = { id: decoded.id };
    next();
  } catch (err) {
    res.status(401).json({ error: "Token is invalid or expired." });
  }
};
