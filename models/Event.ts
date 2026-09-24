import mongoose, { type Types, type Model } from "mongoose";
import { EVENT_TYPES, EVENT_STATUSES, PAYMENT_STATUSES, SLOTS } from "@/lib/constants";
const { Schema, models, model } = mongoose;

export { EVENT_TYPES, EVENT_STATUSES, PAYMENT_STATUSES, SLOTS };

export type EventType = (typeof EVENT_TYPES)[number];
export type EventStatus = (typeof EVENT_STATUSES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type Slot = (typeof SLOTS)[number];

export interface IEvent {
  _id: string;
  userId: Types.ObjectId;
  title: string;
  eventType: EventType;
  date: string; // YYYY-MM-DD (Asia/Kolkata calendar date)
  startTime: string; // HH:mm, 24h
  endTime: string; // HH:mm, 24h
  slot: Slot;
  venueName: string;
  location: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  fee?: number;
  advancePaid?: number;
  paymentStatus: PaymentStatus;
  status: EventStatus;
  travelMinutes: number;
  preparationMinutes: number;
  safetyBufferMinutes: number;
  notes?: string;
  privateNotes?: string;
  bookingRequestId?: Types.ObjectId;
  /** Set once this event has been pushed to Google Calendar (only happens for Confirmed events). */
  googleEventId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const EventSchema = new Schema<IEvent>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true },
    eventType: { type: String, enum: EVENT_TYPES, required: true },
    date: { type: String, required: true, index: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    slot: { type: String, enum: SLOTS, default: "Custom" },
    venueName: { type: String, default: "" },
    location: { type: String, default: "" },
    clientName: { type: String, default: "" },
    clientPhone: { type: String, default: "" },
    clientEmail: { type: String, default: "" },
    fee: { type: Number, default: 0 },
    advancePaid: { type: Number, default: 0 },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: "Not discussed" },
    status: { type: String, enum: EVENT_STATUSES, default: "Enquiry" },
    travelMinutes: { type: Number, default: 30 },
    preparationMinutes: { type: Number, default: 120 },
    safetyBufferMinutes: { type: Number, default: 30 },
    notes: { type: String, default: "" },
    privateNotes: { type: String, default: "" },
    bookingRequestId: { type: Schema.Types.ObjectId, ref: "BookingRequest" },
    googleEventId: { type: String, default: "" },
  },
  { timestamps: true }
);

EventSchema.index({ userId: 1, date: 1 });

export default (models.Event as Model<IEvent> | undefined) ||
  model<IEvent>("Event", EventSchema);
