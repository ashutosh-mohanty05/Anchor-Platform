import mongoose, { type Model } from "mongoose";
const { Schema, models, model } = mongoose;

export interface IUser {
  _id: string;
  name: string;
  email: string;
  image?: string;
  isOwner: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    image: { type: String },
    isOwner: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default (models.User as Model<IUser> | undefined) ||
  model<IUser>("User", UserSchema);
