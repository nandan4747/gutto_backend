import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  username: string;
  fullname: string;
  password?: string;
  connections: mongoose.Types.ObjectId[];
  blockedUsers: mongoose.Types.ObjectId[];
  accountType: string;
}

const UserSchema: Schema = new Schema(
  {
    username: { type: String, required: true, unique: true, lowercase: true },
    fullname: { type: String, required: true },
    password: { type: String, required: true },
    connections: [{ type: Schema.Types.ObjectId, ref: "User" }],
    blockedUsers: [{ type: Schema.Types.ObjectId, ref: "User" }],
    accountType: { type: String, required: true, default: "private" },
  },
  { timestamps: true },
);

export const User = mongoose.model<IUser>("User", UserSchema);