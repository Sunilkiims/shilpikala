/** Placeholder shown while an account page loads. */
export function AccountSkeleton() {
  return (
    <div role="status" aria-label="Loading your account" className="mx-auto w-full max-w-6xl animate-pulse px-6 py-8 sm:px-8 md:py-12">
      <div className="h-9 w-2/3 max-w-sm bg-earth-brown/10" />
      <div className="mt-3 h-4 w-1/2 max-w-xs bg-earth-brown/10" />
      <div className="mt-8 divide-y divide-earth-brown/10 border border-earth-brown/10">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-4 p-5">
            <div className="h-10 w-10 rounded-full bg-earth-brown/10" />
            <div className="flex-1 space-y-2"><div className="h-4 w-1/3 bg-earth-brown/10" /><div className="h-3 w-1/2 bg-earth-brown/10" /></div>
          </div>
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
