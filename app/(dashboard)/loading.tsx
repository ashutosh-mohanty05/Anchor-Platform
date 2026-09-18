/**
 * Shown by Next.js automatically while a dashboard page's server component
 * is fetching data (e.g. the home page's Settings/Events queries). Without
 * this file, that wait renders nothing at all -- a blank flash before the
 * page pops in. A lightweight skeleton makes navigation feel instant even
 * when the underlying MongoDB round-trip takes a couple hundred ms.
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-5 pb-6" aria-hidden="true">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-3 w-20 animate-pulse rounded-full bg-secondary" />
          <div className="h-6 w-36 animate-pulse rounded-full bg-secondary" />
        </div>
        <div className="h-12 w-12 animate-pulse rounded-full bg-secondary" />
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-[72px] animate-pulse rounded-2xl bg-secondary" />
        ))}
      </div>

      <div className="h-28 animate-pulse rounded-2xl bg-secondary" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="h-24 animate-pulse rounded-2xl bg-secondary" />
        <div className="h-24 animate-pulse rounded-2xl bg-secondary" />
      </div>
    </div>
  );
}
