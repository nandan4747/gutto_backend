import mongoose, { Schema, Document } from "mongoose";

export interface IGroup extends Document {
  name: string;
  admin: mongoose.Types.ObjectId;
  members: mongoose.Types.ObjectId[];
  groupIcon?: string;
}

const GroupSchema: Schema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    admin: { type: Schema.Types.ObjectId, ref: "User", required: true },
    members: [{ type: Schema.Types.ObjectId, ref: "User" }],
    groupIcon: { type: String, default: "" },
  },
  { timestamps: true },
);

// Indexing the members array so we can quickly find groups for a specific user
GroupSchema.index({ members: 1 });

export const Group = mongoose.model<IGroup>("Group", GroupSchema);
