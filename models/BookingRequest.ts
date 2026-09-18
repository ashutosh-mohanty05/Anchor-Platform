import mongoose, { type Types, type Model } from "mongoose";
import { BOOKING_STATUSES } from "@/lib/constants";
const { Schema, models, model } = mongoose;

export { BOOKING_STATUSES };

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export interface IBookingRequest {
  _id: string;
  userId: Types.ObjectId;
  referenceId: string;
  clientName: string;
  phone: string;
  email?: string;
  eventType: string;
  preferredDate: string; // YYYY-MM-DD
  preferredSlot: "Morning" | "Evening" | "Flexible";
  preferredStartTime?: string;
  preferredEndTime?: string;
  location: string;
  audienceSize?: number;
  message?: string;
  consent: boolean;
  status: BookingStatus;
  suggestedDate?: string; // set when status is "Rescheduled" -- a new date Vaishnavi is proposing
  suggestedNote?: string;
  privateNotes?: string;
  honeypot?: string;
  convertedEventId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const BookingRequestSchema = new Schema<IBookingRequest>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    referenceId: { type: String, required: true, unique: true },
    clientName: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, default: "" },
    eventType: { type: String, required: true },
    preferredDate: { type: String, required: true },
    preferredSlot: { type: String, enum: ["Morning", "Evening", "Flexible"], required: true },
    preferredStartTime: { type: String },
    preferredEndTime: { type: String },
    location: { type: String, default: "" },
    audienceSize: { type: Number },
    message: { type: String, default: "" },
    consent: { type: Boolean, required: true },
    status: { type: String, enum: BOOKING_STATUSES, default: "New" },
    suggestedDate: { type: String, default: "" },
    suggestedNote: { type: String, default: "" },
    privateNotes: { type: String, default: "" },
    convertedEventId: { type: Schema.Types.ObjectId, ref: "Event" },
  },
  { timestamps: true }
);

BookingRequestSchema.index({ userId: 1, status: 1 });
BookingRequestSchema.index({ userId: 1, preferredDate: 1 });

export default (models.BookingRequest as Model<IBookingRequest> | undefined) ||
  model<IBookingRequest>("BookingRequest", BookingRequestSchema);
