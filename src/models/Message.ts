// src/models/Message.ts
import mongoose, { Schema, Document } from "mongoose";

export interface IMessage extends Document {
  senderUserId: mongoose.Types.ObjectId;
  reciverUserId: mongoose.Types.ObjectId;
  text: string;
  type: "text" | "image" | "file";
  isReaded: boolean;
  url?: string;
  createdAt: Date;
}

const MessageSchema: Schema = new Schema(
  {
    senderUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    reciverUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    text: {
      type: String,
      required: function () {
        return this.type === "text";
      },
    },
    type: { type: String, enum: ["text", "image", "file"], default: "text" },
    isReaded: { type: Boolean, default: false },
    url: { type: String },
  },
  { timestamps: true },
);

MessageSchema.index({ senderUserId: 1, reciverUserId: 1, createdAt: -1 });

export const Message = mongoose.model<IMessage>("Message", MessageSchema);
