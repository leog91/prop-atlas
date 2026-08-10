"use client"; // Error boundaries must be Client Components

import "./globals.css";

// Replaces the root layout when it is the thing that failed, so it must render
// its own html and body.
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center antialiased">
        <title>Something went wrong · Prop Atlas</title>
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="max-w-md text-sm text-gray-600">
          Prop Atlas could not start rendering this page.
        </p>
        {error.digest && (
          <p className="font-mono text-xs text-gray-500">Reference: {error.digest}</p>
        )}
        <button
          onClick={() => unstable_retry()}
          className="cursor-pointer rounded-md bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
