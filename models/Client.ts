import mongoose, { type Types, type Model } from "mongoose";
const { Schema, models, model } = mongoose;

export interface IClient {
  _id: string;
  userId: Types.ObjectId;
  name: string;
  phone: string;
  email?: string;
  notes?: string;
  totalEvents: number;
  createdAt: Date;
  updatedAt: Date;
}

const ClientSchema = new Schema<IClient>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true },
    email: { type: String, default: "" },
    notes: { type: String, default: "" },
    totalEvents: { type: Number, default: 0 },
  },
  { timestamps: true }
);

ClientSchema.index({ userId: 1, phone: 1 });

export default (models.Client as Model<IClient> | undefined) ||
  model<IClient>("Client", ClientSchema);
