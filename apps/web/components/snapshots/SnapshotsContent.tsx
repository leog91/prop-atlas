"use client";

import { useState } from "react";

export interface SnapshotNode {
  selector: string;
  tag: string;
  text?: string;
  attributes?: Record<string, string>;
}

export interface Snapshot {
  title: string;
  url: string;
  meta: Record<string, string>;
  jsonLd: unknown[];
  scripts?: { id?: string; type?: string; text?: string }[];
  nodes: SnapshotNode[];
  pageText: string;
  images?: string[];
}

export interface PageSnapshot {
  id: string;
  provider: string;
  url: string;
  snapshot: Snapshot;
  createdAt: Date | string;
}

interface SnapshotsContentProps {
  snapshots: PageSnapshot[];
}

export function SnapshotsContent({ snapshots: initialSnapshots }: SnapshotsContentProps) {
  const [snapshots, setSnapshots] = useState(initialSnapshots);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterProvider, setFilterProvider] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = filterProvider
    ? snapshots.filter((s) => s.provider === filterProvider)
    : snapshots;

  const providers = Array.from(new Set(snapshots.map((s) => s.provider)));

  const handleCopyJson = (snapshot: Snapshot) => {
    const payload = {
      ...snapshot,
      pageText: snapshot.pageText.slice(0, 3000),
      nodes: snapshot.nodes.slice(0, 100),
      scripts: snapshot.scripts?.map((s) => ({
        id: s.id,
        type: s.type,
        text: s.text?.slice(0, 3000),
      })),
    };
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this snapshot?")) return;

    setDeletingId(id);
    try {
      const response = await fetch(`/api/snapshots/${id}/delete`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Failed to delete");
      }

      setSnapshots((prev) => prev.filter((s) => s.id !== id));
      if (expandedId === id) setExpandedId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete snapshot");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={filterProvider}
          onChange={(e) => setFilterProvider(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800"
        >
          <option value="">All providers</option>
          {providers.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <span className="text-sm text-gray-500">{filtered.length} snapshots</span>
      </div>

      {filtered.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-gray-500">
            No snapshots yet. Use the extension&apos;s &quot;Analyze Structure&quot; button to capture one.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((snapshot) => {
            const isExpanded = expandedId === snapshot.id;
            const isDeleting = deletingId === snapshot.id;
            return (
              <div
                key={snapshot.id}
                className={`rounded-lg border border-gray-200 dark:border-gray-800 ${isDeleting ? "opacity-50" : ""}`}
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : snapshot.id)}
                  className="flex w-full items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-900"
                >
                  <div>
                    <span className="inline-block rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                      {snapshot.provider}
                    </span>
                    <span className="ml-2 text-sm text-gray-500">
                      {new Date(snapshot.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-400">
                      {isExpanded ? "Collapse" : "Expand"}
                    </span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-200 p-4 dark:border-gray-800">
                    <div className="mb-3 flex items-center gap-2">
                      <a
                        href={snapshot.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline"
                      >
                        {snapshot.snapshot.title || snapshot.url}
                      </a>
                      <button
                        onClick={() => handleCopyJson(snapshot.snapshot)}
                        className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
                      >
                        Copy JSON
                      </button>
                      <button
                        onClick={() => handleDelete(snapshot.id)}
                        disabled={isDeleting}
                        className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20 disabled:opacity-50"
                      >
                        {isDeleting ? "Deleting..." : "Delete"}
                      </button>
                    </div>

                    <div className="mb-3">
                      <h4 className="mb-1 text-xs font-semibold uppercase text-gray-500">Meta Tags</h4>
                      <pre className="max-h-40 overflow-auto rounded bg-gray-50 p-2 text-xs dark:bg-gray-900">
                        {JSON.stringify(snapshot.snapshot.meta, null, 2)}
                      </pre>
                    </div>

                    {snapshot.snapshot.jsonLd.length > 0 && (
                      <div className="mb-3">
                        <h4 className="mb-1 text-xs font-semibold uppercase text-gray-500">JSON-LD</h4>
                        <pre className="max-h-40 overflow-auto rounded bg-gray-50 p-2 text-xs dark:bg-gray-900">
                          {JSON.stringify(snapshot.snapshot.jsonLd, null, 2)}
                        </pre>
                      </div>
                    )}

                    {snapshot.snapshot.scripts && snapshot.snapshot.scripts.length > 0 && (
                      <div className="mb-3">
                        <h4 className="mb-1 text-xs font-semibold uppercase text-gray-500">
                          Scripts ({snapshot.snapshot.scripts.length})
                        </h4>
                        {snapshot.snapshot.scripts.map((script, i) => (
                          <details key={i} className="mb-1">
                            <summary className="cursor-pointer text-xs font-mono text-gray-600">
                              {script.id || "script"} {script.type ? `(${script.type})` : ""}
                            </summary>
                            <pre className="mt-1 max-h-40 overflow-auto rounded bg-gray-50 p-2 text-xs dark:bg-gray-900">
                              {script.text?.slice(0, 2000)}
                            </pre>
                          </details>
                        ))}
                      </div>
                    )}

                    {snapshot.snapshot.images && snapshot.snapshot.images.length > 0 && (
                      <div className="mb-3">
                        <h4 className="mb-1 text-xs font-semibold uppercase text-gray-500">
                          Images ({snapshot.snapshot.images.length})
                        </h4>
                        <div className="max-h-64 overflow-auto rounded bg-gray-50 p-2 dark:bg-gray-900">
                          <div className="grid grid-cols-4 gap-2">
                            {snapshot.snapshot.images.map((url, i) => (
                              <a
                                key={i}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group relative aspect-square overflow-hidden rounded border border-gray-200 dark:border-gray-700"
                                title={url}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={url}
                                  alt=""
                                  referrerPolicy="no-referrer"
                                  className="h-full w-full object-cover transition-transform group-hover:scale-110"
                                  loading="lazy"
                                />
                              </a>
                            ))}
                          </div>
                          <div className="mt-2 space-y-1">
                            {snapshot.snapshot.images.map((url, i) => (
                              <div key={`url-${i}`} className="break-all font-mono text-[10px] text-gray-500">
                                {url}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mb-3">
                      <h4 className="mb-1 text-xs font-semibold uppercase text-gray-500">
                        DOM Nodes ({snapshot.snapshot.nodes.length})
                      </h4>
                      <div className="max-h-64 overflow-auto rounded bg-gray-50 p-2 dark:bg-gray-900">
                        <table className="w-full text-left text-xs">
                          <thead className="sticky top-0 bg-gray-100 dark:bg-gray-800">
                            <tr>
                              <th className="px-2 py-1">Tag</th>
                              <th className="px-2 py-1">Text</th>
                              <th className="px-2 py-1">Attributes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {snapshot.snapshot.nodes.map((node, i) => (
                              <tr
                                key={i}
                                className="border-t border-gray-200 dark:border-gray-800"
                              >
                                <td className="px-2 py-1 font-mono text-gray-500">{node.tag}</td>
                                <td className="px-2 py-1">{node.text || "—"}</td>
                                <td className="px-2 py-1 font-mono text-gray-500">
                                  {node.attributes
                                    ? JSON.stringify(node.attributes).slice(0, 120)
                                    : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div>
                      <h4 className="mb-1 text-xs font-semibold uppercase text-gray-500">Page Text</h4>
                      <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-2 text-xs dark:bg-gray-900">
                        {snapshot.snapshot.pageText}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
