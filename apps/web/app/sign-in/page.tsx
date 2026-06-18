"use client";

import { useState } from "react";
import { signIn } from "@/lib/auth-client";
import Link from "next/link";
import { useRouter } from "next/navigation";

const DEMO_EMAIL = "demo@propatlas.com";
const DEMO_PASSWORD = "demo1234";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signIn.email({ email, password });

    if (result.error) {
      setError(result.error.message || "Invalid credentials");
      setLoading(false);
      return;
    }

    router.push("/");
  };

  const fillDemoCredentials = () => {
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    setError(null);
  };

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Left side: app pitch */}
      <div className="flex flex-1 items-center justify-center bg-gray-50 px-6 py-12 dark:bg-gray-900/50 lg:px-12">
        <div className="max-w-md space-y-8">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Prop Atlas
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-300">
              Track rental and buy listings from multiple providers in one place.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Supported providers
            </h2>
            <div className="flex flex-wrap gap-2">
              {["Daft.ie", "Idealista", "Kamernet", "Zonaprop"].map((provider) => (
                <span
                  key={provider}
                  className="rounded-full border border-gray-200 bg-white px-3 py-1 text-sm font-medium dark:border-gray-700 dark:bg-gray-800"
                >
                  {provider}
                </span>
              ))}
            </div>
          </div>

          <ul className="space-y-3 text-gray-600 dark:text-gray-300">
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </span>
              <span>Save listings with one click using the browser extension.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </span>
              <span>Organize favorites, add notes, and track price history.</span>
            </li>

          </ul>

          <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <h3 className="mb-2 text-sm font-semibold">Browser extension</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              The Prop Atlas extension adds a save button to supported listing sites,
              sending properties straight to your dashboard along with their images and metadata.
            </p>
          </div>
        </div>
      </div>

      {/* Right side: sign-in form */}
      <div className="flex flex-1 items-center justify-center px-6 py-12 lg:px-12">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold">Sign in</h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Welcome back to your property tracker
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full cursor-pointer rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/30 dark:bg-blue-900/20">
            <h3 className="mb-1 text-sm font-semibold text-blue-800 dark:text-blue-300">
              Try the demo account
            </h3>
            <p className="mb-3 text-sm text-blue-700 dark:text-blue-200">
              Email: <code className="font-mono">{DEMO_EMAIL}</code>
              <br />
              Password: <code className="font-mono">{DEMO_PASSWORD}</code>
            </p>
            <button
              type="button"
              onClick={fillDemoCredentials}
              className="w-full cursor-pointer rounded-md border border-blue-300 bg-white px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-gray-900 dark:text-blue-300 dark:hover:bg-gray-800"
            >
              Use demo credentials
            </button>
            <p className="mt-3 text-xs text-blue-600 dark:text-blue-200">
              Demo data is sourced from public listings and may be outdated.
            </p>
          </div>

          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            Don&apos;t have an account?{" "}
            <Link href="/sign-up" className="text-blue-600 hover:underline dark:text-blue-400">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
