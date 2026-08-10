"use client";

import { useState, useEffect } from "react";

export function ApiKeyManager() {
  // Set only right after generation — the raw key is never retrievable again.
  const [newKey, setNewKey] = useState<string | null>(null);
  const [keyPrefix, setKeyPrefix] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/auth/api-key")
      .then((res) => res.json())
      .then((data) => {
        setKeyPrefix(data.keyPrefix);
        setIsDemo(data.demo === true);
      })
      .catch(() => setError("Could not load API key status."))
      .finally(() => setLoading(false));
  }, []);

  const generateKey = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/api-key", { method: "POST" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setNewKey(data.key);
      setKeyPrefix(data.keyPrefix);
    } catch {
      setError("Could not generate a key. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = () => {
    if (!newKey) return;
    navigator.clipboard.writeText(newKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return <div className="text-sm text-gray-500">Loading...</div>;
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <h3 className="mb-2 text-sm font-semibold">Browser Extension API Key</h3>
      <p className="mb-3 text-xs text-gray-600 dark:text-gray-400">
        {isDemo
          ? "The shared demo is read-only, so browser extension access is disabled."
          : "Use this key to authenticate the browser extension. It is shown once — store it somewhere safe."}
      </p>

      {error && (
        <p className="mb-3 text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      {newKey ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={newKey}
              readOnly
              aria-label="New API key"
              className="flex-1 rounded-md border border-gray-300 bg-gray-50 px-3 py-2 font-mono text-xs dark:border-gray-700 dark:bg-gray-800"
            />
            <button
              onClick={copyToClipboard}
              className="cursor-pointer rounded-md bg-gray-900 px-3 py-2 text-xs text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-500">
            Copy it now. Once you leave this page it cannot be shown again.
          </p>
        </div>
      ) : (
        !isDemo && (
          <div className="flex items-center gap-3">
            <button
              onClick={generateKey}
              disabled={generating}
              className="cursor-pointer rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {generating
                ? "Generating..."
                : keyPrefix
                  ? "Regenerate key"
                  : "Generate API Key"}
            </button>
            {keyPrefix && (
              <span className="font-mono text-xs text-gray-500">
                {keyPrefix}… · regenerating invalidates the current key
              </span>
            )}
          </div>
        )
      )}
    </div>
  );
}
