export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6">
      <div className="mb-6 h-20 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-900" />
      <div className="mb-6 h-8 w-48 animate-pulse rounded-md bg-gray-100 dark:bg-gray-900" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-72 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-900"
          />
        ))}
      </div>
      <span className="sr-only">Loading properties…</span>
    </div>
  );
}
