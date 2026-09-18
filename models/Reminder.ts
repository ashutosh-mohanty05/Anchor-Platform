import mongoose, { type Types, type Model } from "mongoose";
import { REMINDER_OFFSETS } from "@/lib/constants";
const { Schema, models, model } = mongoose;

export { REMINDER_OFFSETS };

export type ReminderOffset = (typeof REMINDER_OFFSETS)[number];

export interface IReminder {
  _id: string;
  userId: Types.ObjectId;
  eventId: Types.ObjectId;
  offset: ReminderOffset;
  customMinutesBefore?: number;
  remindAt: Date;
  note?: string;
  acknowledged: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ReminderSchema = new Schema<IReminder>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true, index: true },
    offset: { type: String, enum: REMINDER_OFFSETS, required: true },
    customMinutesBefore: { type: Number },
    remindAt: { type: Date, required: true, index: true },
    note: { type: String, default: "" },
    acknowledged: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default (models.Reminder as Model<IReminder> | undefined) ||
  model<IReminder>("Reminder", ReminderSchema);
