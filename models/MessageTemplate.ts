import mongoose, { type Types, type Model } from "mongoose";
import { TEMPLATE_CATEGORIES } from "@/lib/constants";
const { Schema, models, model } = mongoose;

export { TEMPLATE_CATEGORIES };

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

export interface IMessageTemplate {
  _id: string;
  userId: Types.ObjectId;
  category: TemplateCategory;
  title: string;
  body: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MessageTemplateSchema = new Schema<IMessageTemplate>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    category: { type: String, enum: TEMPLATE_CATEGORIES, required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default (models.MessageTemplate as Model<IMessageTemplate> | undefined) ||
  model<IMessageTemplate>("MessageTemplate", MessageTemplateSchema);
