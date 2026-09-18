import mongoose, { type Types, type Model } from "mongoose";
import { OFFICE_SHIFT_TYPES } from "@/lib/constants";
const { Schema, models, model } = mongoose;

export { OFFICE_SHIFT_TYPES };

export type OfficeShiftType = (typeof OFFICE_SHIFT_TYPES)[number];

export interface IOfficeShift {
  _id: string;
  userId: Types.ObjectId;
  date: string; // YYYY-MM-DD
  shiftType: OfficeShiftType;
  startTime: string; // HH:mm
  endTime: string; // HH:mm -- may be "earlier" than startTime when spansNextDay
  spansNextDay: boolean;
  note?: string;
  /** Only used when shiftType === "Custom": a hex color for this shift on the calendar. */
  color?: string;
  /** Only used when shiftType === "Custom": a short name shown instead of "Custom Shift". */
  customLabel?: string;
  createdAt: Date;
  updatedAt: Date;
}

const OfficeShiftSchema = new Schema<IOfficeShift>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    date: { type: String, required: true },
    shiftType: { type: String, enum: OFFICE_SHIFT_TYPES, required: true },
    startTime: { type: String, default: "" },
    endTime: { type: String, default: "" },
    spansNextDay: { type: Boolean, default: false },
    note: { type: String, default: "" },
    color: { type: String, default: "" },
    customLabel: { type: String, default: "" },
  },
  { timestamps: true }
);

OfficeShiftSchema.index({ userId: 1, date: 1 }, { unique: true });

export default (models.OfficeShift as Model<IOfficeShift> | undefined) ||
  model<IOfficeShift>("OfficeShift", OfficeShiftSchema);
