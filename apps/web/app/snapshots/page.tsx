import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq, desc } from "@prop-atlas/db";
import { pageSnapshots } from "@prop-atlas/db";
import { getDb } from "@/lib/db";
import { SnapshotsContent, type Snapshot } from "@/components/snapshots/SnapshotsContent";
import Link from "next/link";

export default async function SnapshotsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  const db = getDb();

  const snapshots = await db
    .select()
    .from(pageSnapshots)
    .where(eq(pageSnapshots.userId, session.user.id))
    .orderBy(desc(pageSnapshots.createdAt));

  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200 dark:border-gray-800">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-lg font-bold">
            Prop Atlas
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">{session.user.email}</span>
            <form
              action={async () => {
                "use server";
                await auth.api.signOut({
                  headers: await headers(),
                });
                redirect("/");
              }}
            >
              <button
                type="submit"
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Page Snapshots</h1>
          <Link
            href="/dashboard"
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700"
          >
            Back to Dashboard
          </Link>
        </div>

        <SnapshotsContent snapshots={snapshots.map((s) => ({ ...s, snapshot: s.snapshot as Snapshot }))} />
      </main>
    </div>
  );
}
