import Link from "next/link";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export default async function HomePage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4">
      <div className="w-full max-w-2xl space-y-8 text-center">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Prop Atlas
          </h1>
          <p className="mx-auto max-w-md text-lg text-gray-600 dark:text-gray-400">
            Track rental and buy listings from multiple providers in one place.
            Save properties from Daft, Idealista, Kamernet, and Zonaprop.
          </p>
        </div>

        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          {session ? (
            <Link
              href="/dashboard"
              className="rounded-md bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700"
            >
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="rounded-md bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700"
              >
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="rounded-md border border-gray-300 px-6 py-3 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
              >
                Create account
              </Link>
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 pt-8 sm:grid-cols-4">
          {["Daft.ie", "Idealista", "Kamernet", "Zonaprop"].map((provider) => (
            <div
              key={provider}
              className="rounded-lg border border-gray-200 p-4 dark:border-gray-800"
            >
              <p className="text-sm font-medium">{provider}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
