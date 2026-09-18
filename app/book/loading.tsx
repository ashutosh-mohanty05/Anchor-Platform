export default function BookLoading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6" data-theme="rose" aria-hidden="true">
      <div className="h-40 w-40 animate-pulse rounded-full bg-secondary" />
      <div className="h-6 w-56 animate-pulse rounded-full bg-secondary" />
      <div className="h-4 w-72 animate-pulse rounded-full bg-secondary" />
    </div>
  );
}
