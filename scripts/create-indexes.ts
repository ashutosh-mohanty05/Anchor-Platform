/**
 * Creates every index declared on the app's Mongoose schemas, up front.
 *
 * Why this matters for production smoothness: by default Mongoose builds
 * missing indexes automatically ("autoIndex") the first time each model is
 * used against a fresh connection. On a brand new deployment (or right
 * after adding a new index to a schema), that means the *first* real
 * request to hit each collection pays for building the index, which on a
 * shared free-tier Atlas cluster can be a very noticeable one-time stall.
 * Running this once after deploying (or whenever you change a schema)
 * builds them all ahead of time instead.
 *
 * Usage: npm run create-indexes   (reads MONGODB_URI from .env.local)
 */
import "dotenv/config";
import connectToDatabase from "../lib/mongodb";
import User from "../models/User";
import Settings from "../models/Settings";
import Event from "../models/Event";
import Client from "../models/Client";
import MessageTemplate from "../models/MessageTemplate";
import BookingRequest from "../models/BookingRequest";
import Reminder from "../models/Reminder";
import OfficeShift from "../models/OfficeShift";
import PushSubscription from "../models/PushSubscription";
import GoogleAccount from "../models/GoogleAccount";

const MODELS = [
  User,
  Settings,
  Event,
  Client,
  MessageTemplate,
  BookingRequest,
  Reminder,
  OfficeShift,
  PushSubscription,
  GoogleAccount,
];

async function main() {
  console.log("Connecting to MongoDB...");
  await connectToDatabase();

  for (const model of MODELS) {
    process.stdout.write(`Syncing indexes for ${model.modelName}... `);
    const result = await model.syncIndexes();
    console.log(result.length ? `done (${result.join(", ")})` : "already up to date");
  }

  console.log("All indexes are in sync.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to create indexes:", err);
  process.exit(1);
});
