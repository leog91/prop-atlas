"use client";

import { useState, useEffect } from "react";

export function ApiKeyManager() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/auth/api-key")
      .then((res) => res.json())
      .then((data) => {
        setApiKey(data.key);
        setIsDemo(data.demo === true);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const generateKey = async () => {
    const res = await fetch("/api/auth/api-key", { method: "POST" });
    const data = await res.json();
    setApiKey(data.key);
  };

  const copyToClipboard = () => {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
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
          : "Use this key to authenticate the browser extension. Keep it secret."}
      </p>
      
      {apiKey ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={apiKey}
            readOnly
            className="flex-1 rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-xs font-mono dark:border-gray-700 dark:bg-gray-800"
          />
          <button
            onClick={copyToClipboard}
            className="rounded-md bg-gray-900 px-3 py-2 text-xs text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      ) : !isDemo ? (
        <button
          onClick={generateKey}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          Generate API Key
        </button>
      ) : null}
    </div>
  );
}
