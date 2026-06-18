import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { DashboardShell } from "@/components/property/DashboardShell";

interface HomePageProps {
  searchParams: Promise<{
    page?: string;
    favorites?: string;
    search?: string;
    listingType?: string;
    provider?: string;
    deleted?: string;
  }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  return <DashboardShell searchParams={await searchParams} />;
}
