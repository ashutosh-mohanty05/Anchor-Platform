import connectToDatabase from "@/lib/mongodb";
import User from "@/models/User";
import Settings from "@/models/Settings";
import BookLandingContent from "@/components/book-landing-content";

export const dynamic = "force-dynamic";

/**
 * Server component: the profile (name/photo/bio) is fetched directly from
 * MongoDB during the server render, the same request that produces the
 * HTML -- so a client opening this link from Instagram/WhatsApp sees the
 * finished page immediately instead of a blank shell that then pops in
 * once a client-side fetch resolves. This also skips the heavier
 * `/api/availability` computation entirely, since this page never needed
 * the availability data in the first place -- only `/book/request` does.
 */
export default async function BookLandingPage() {
  await connectToDatabase();
  const owner = await User.findOne({ isOwner: true }).lean();
  const settings = owner ? await Settings.findOne({ userId: owner._id }).lean() : null;

  if (!owner || (settings && settings.publicBookingEnabled === false)) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center" data-theme="rose">
        <p className="text-sm text-muted-foreground">
          Booking isn&apos;t available right now. Please check back soon.
        </p>
      </div>
    );
  }

  return (
    <BookLandingContent
      profile={{
        displayName: settings?.displayName ?? "Vaishnavi",
        bio: settings?.bio ?? "Event Anchor | Host | Emcee",
        profileImage: settings?.profileImage ?? "",
        instagramUrl: settings?.instagramUrl ?? "",
        whatsappNumber: settings?.whatsappNumber ?? "",
      }}
    />
  );
}
