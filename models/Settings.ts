import mongoose, { type Types, type Model } from "mongoose";
import { THEMES } from "@/lib/constants";
const { Schema, models, model } = mongoose;

export { THEMES };
export type ThemeName = (typeof THEMES)[number];

export interface ISettings {
  _id: string;
  userId: Types.ObjectId;
  displayName: string;
  bio: string;
  profileImage?: string;
  instagramUrl?: string;
  whatsappNumber?: string;
  theme: ThemeName;
  publicBookingEnabled: boolean;
  maxEventsPerDay: number;
  defaultPreparationMinutes: number;
  defaultTravelMinutes: number;
  defaultSafetyBufferMinutes: number;
  createdAt: Date;
  updatedAt: Date;
}

const SettingsSchema = new Schema<ISettings>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    displayName: { type: String, default: "Vaishnavi" },
    bio: { type: String, default: "Event Anchor | Host | Emcee" },
    profileImage: { type: String, default: "" },
    instagramUrl: { type: String, default: "" },
    whatsappNumber: { type: String, default: "" },
    theme: { type: String, enum: THEMES, default: "rose" },
    publicBookingEnabled: { type: Boolean, default: true },
    maxEventsPerDay: { type: Number, default: 2 },
    defaultPreparationMinutes: { type: Number, default: 120 },
    defaultTravelMinutes: { type: Number, default: 30 },
    defaultSafetyBufferMinutes: { type: Number, default: 30 },
  },
  { timestamps: true }
);

export default (models.Settings as Model<ISettings> | undefined) ||
  model<ISettings>("Settings", SettingsSchema);
