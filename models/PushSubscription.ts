import mongoose, { type Types, type Model } from "mongoose";
const { Schema, models, model } = mongoose;

/**
 * A single browser/device's Web Push subscription. Vaishnavi may have
 * several (phone, laptop, etc.) -- we store one document per endpoint and
 * push to all of them so a notification reaches whichever device she has
 * open.
 */
export interface IPushSubscription {
  _id: string;
  userId: Types.ObjectId;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  createdAt: Date;
  updatedAt: Date;
}

const PushSubscriptionSchema = new Schema<IPushSubscription>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
  },
  { timestamps: true }
);

export default (models.PushSubscription as Model<IPushSubscription> | undefined) ||
  model<IPushSubscription>("PushSubscription", PushSubscriptionSchema);
