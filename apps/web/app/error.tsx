"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="max-w-md text-sm text-gray-600 dark:text-gray-400">
        The page could not be loaded. This is usually temporary — trying again
        often works.
      </p>
      {error.digest && (
        <p className="font-mono text-xs text-gray-500">Reference: {error.digest}</p>
      )}
      <button
        onClick={() => unstable_retry()}
        className="cursor-pointer rounded-md bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
      >
        Try again
      </button>
    </div>
  );
}
