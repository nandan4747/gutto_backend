import mongoose, { Schema, Document } from "mongoose";

export interface IFriendRequest extends Document {
  senderId: mongoose.Types.ObjectId;
  receiverId: mongoose.Types.ObjectId;
  status: "pending" | "accepted" | "rejected";
  createdAt: Date;
}

const FriendRequestSchema: Schema = new Schema(
  {
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    receiverId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
  },
  { timestamps: true },
);

// Create an index so searching for requests is lightning fast
FriendRequestSchema.index({ senderId: 1, receiverId: 1 }, { unique: true });

export const FriendRequest = mongoose.model<IFriendRequest>(
  "FriendRequest",
  FriendRequestSchema,
);
