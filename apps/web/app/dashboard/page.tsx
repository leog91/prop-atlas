import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq, and, desc, inArray, like, sql, isNull, isNotNull } from "@prop-atlas/db";
import { properties, propertyImages, savedProperties } from "@prop-atlas/db";
import { getDb } from "@/lib/db";
import { DashboardContent } from "@/components/property/DashboardContent";
import { ApiKeyManager } from "@/components/ApiKeyManager";
import Link from "next/link";

interface DashboardPageProps {
  searchParams: Promise<{
    page?: string;
    favorites?: string;
    search?: string;
    listingType?: string;
    provider?: string;
    deleted?: string;
  }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1"));
  const limit = 12;
  const offset = (page - 1) * limit;
  const favoritesOnly = params.favorites === "true";
  const search = params.search || "";
  const listingType = params.listingType || "";
  const provider = params.provider || "";
  const showDeleted = params.deleted === "true";

  const db = getDb();

  const conditions = [eq(savedProperties.userId, session.user.id)];
  if (showDeleted) {
    conditions.push(isNotNull(savedProperties.deletedAt));
  } else {
    conditions.push(isNull(savedProperties.deletedAt));
  }
  if (favoritesOnly) {
    conditions.push(eq(savedProperties.isFavorite, true));
  }

  const propertyConditions = [];
  if (search) {
    propertyConditions.push(like(properties.title, `%${search}%`));
  }
  if (listingType) {
    propertyConditions.push(eq(properties.listingType, listingType));
  }
  if (provider) {
    propertyConditions.push(eq(properties.provider, provider));
  }

  const query = db
    .select({
      property: properties,
      saved: savedProperties,
    })
    .from(savedProperties)
    .innerJoin(properties, eq(properties.id, savedProperties.propertyId))
    .where(and(...conditions, ...propertyConditions))
    .orderBy(desc(savedProperties.savedAt))
    .limit(limit)
    .offset(offset);

  const results = await query;

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(savedProperties)
    .innerJoin(properties, eq(properties.id, savedProperties.propertyId))
    .where(and(...conditions, ...propertyConditions));

  const total = countResult[0]?.count || 0;
  const totalPages = Math.ceil(total / limit);

  const propertyIds = results.map((r) => r.property.id);
  const images = propertyIds.length
    ? await db
        .select()
        .from(propertyImages)
        .where(inArray(propertyImages.propertyId, propertyIds))
    : [];

  const imagesByProperty = new Map<string, typeof images>();
  for (const img of images) {
    const list = imagesByProperty.get(img.propertyId) || [];
    list.push(img);
    imagesByProperty.set(img.propertyId, list);
  }

  const data = results.map(({ property, saved }) => ({
    ...property,
    images: (imagesByProperty.get(property.id) || [])
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((i) => i.url),
    savedAt: saved.savedAt,
    savedUpdatedAt: saved.updatedAt,
    isFavorite: saved.isFavorite,
    notes: saved.notes,
  }));

  const buildUrl = (overrides: Record<string, string>) => {
    const p = new URLSearchParams();
    const merged = {
      page: String(page),
      ...(favoritesOnly ? { favorites: "true" } : {}),
      ...(search ? { search } : {}),
      ...(listingType ? { listingType } : {}),
      ...(provider ? { provider } : {}),
      ...(showDeleted ? { deleted: "true" } : {}),
      ...overrides,
    };
    for (const [k, v] of Object.entries(merged)) {
      if (v) p.set(k, v);
    }
    return `/dashboard?${p.toString()}`;
  };

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
        <div className="mb-6">
          <ApiKeyManager />
        </div>

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold">
            {showDeleted ? "Trash" : "Saved Properties"}
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({total})
            </span>
          </h1>
          <Link
            href="/snapshots"
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700"
          >
            Page Snapshots
          </Link>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <form action="/dashboard" method="GET" className="flex gap-2">
            {favoritesOnly && <input type="hidden" name="favorites" value="true" />}
            {showDeleted && <input type="hidden" name="deleted" value="true" />}
            {listingType && <input type="hidden" name="listingType" value={listingType} />}
            {provider && <input type="hidden" name="provider" value={provider} />}
            <input
              type="text"
              name="search"
              defaultValue={search}
              placeholder="Search properties..."
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800"
            />
            <button
              type="submit"
              className="rounded-md bg-gray-900 px-3 py-1.5 text-sm text-white dark:bg-gray-100 dark:text-gray-900"
            >
              Search
            </button>
          </form>

          <div className="flex gap-2">
            <Link
              href={buildUrl({ favorites: favoritesOnly ? "" : "true", page: "1" })}
              className={`rounded-md px-3 py-1.5 text-sm ${
                favoritesOnly
                  ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                  : "border border-gray-300 dark:border-gray-700"
              }`}
            >
              Favorites
            </Link>
            <Link
              href={buildUrl({ deleted: showDeleted ? "" : "true", page: "1", favorites: "", listingType: "", provider: "" })}
              className={`rounded-md px-3 py-1.5 text-sm ${
                showDeleted
                  ? "bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900"
                  : "border border-gray-300 dark:border-gray-700"
              }`}
            >
              Trash
            </Link>
            {["", "rent", "buy"].map((type) => (
              <Link
                key={type}
                href={buildUrl({ listingType: type, page: "1" })}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  listingType === type
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                    : "border border-gray-300 dark:border-gray-700"
                }`}
              >
                {type ? type.charAt(0).toUpperCase() + type.slice(1) : "All"}
              </Link>
            ))}
            {["", "daft", "idealista", "kamernet", "zonaprop"].map((p) => (
              <Link
                key={p}
                href={buildUrl({ provider: p, page: "1" })}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  provider === p
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                    : "border border-gray-300 dark:border-gray-700"
                }`}
              >
                {p ? p.charAt(0).toUpperCase() + p.slice(1) : "All providers"}
              </Link>
            ))}
          </div>
        </div>

        {data.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-gray-500">
              {showDeleted
                ? "Trash is empty."
                : search || favoritesOnly || listingType || provider
                  ? "No properties match your filters."
                  : "No saved properties yet. Use the browser extension to save listings."}
            </p>
          </div>
        ) : (
          <>
            <DashboardContent
              key={data.map((d) => d.id).join(",")}
              properties={data}
              showDeleted={showDeleted}
            />

            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                {page > 1 && (
                  <Link
                    href={buildUrl({ page: String(page - 1) })}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700"
                  >
                    Previous
                  </Link>
                )}
                <span className="text-sm text-gray-500">
                  Page {page} of {totalPages}
                </span>
                {page < totalPages && (
                  <Link
                    href={buildUrl({ page: String(page + 1) })}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700"
                  >
                    Next
                  </Link>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
