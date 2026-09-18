import mongoose, { type Types, type Model } from "mongoose";
const { Schema, models, model } = mongoose;

/**
 * Stores the OAuth tokens for the one Google account Vaishnavi connects so
 * confirmed events can be pushed straight into her Google Calendar (and
 * therefore onto every device she's signed into, with native reminders).
 *
 * Never expose accessToken/refreshToken to the client -- these fields are
 * only ever read/written from server-side route handlers.
 */
export interface IGoogleAccount {
  _id: string;
  userId: Types.ObjectId;
  googleEmail?: string;
  accessToken: string;
  refreshToken: string;
  /** ms epoch when accessToken expires. */
  expiryDate: number;
  /** Which of the user's Google calendars to write events into. */
  calendarId: string;
  createdAt: Date;
  updatedAt: Date;
}

const GoogleAccountSchema = new Schema<IGoogleAccount>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    googleEmail: { type: String, default: "" },
    accessToken: { type: String, required: true },
    refreshToken: { type: String, required: true },
    expiryDate: { type: Number, required: true },
    calendarId: { type: String, default: "primary" },
  },
  { timestamps: true }
);

export default (models.GoogleAccount as Model<IGoogleAccount> | undefined) ||
  model<IGoogleAccount>("GoogleAccount", GoogleAccountSchema);
