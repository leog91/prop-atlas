import { useState, useEffect } from "react";
import { logger } from "@prop-atlas/providers";

type Status = "idle" | "detecting" | "saving" | "saved" | "analyzing" | "analyzed" | "error";

function IndexPopup() {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    chrome.storage.local.get(["apiKey"], (result) => {
      if (result.apiKey) {
        setApiKey(result.apiKey);
      } else {
        setShowSettings(true);
      }
    });
  }, []);

  const handleSaveApiKey = () => {
    chrome.storage.local.set({ apiKey }, () => {
      setShowSettings(false);
      setStatus("idle");
      setErrorMsg("");
    });
  };

  const apiUrl = process.env.PLASMO_PUBLIC_API_URL || "http://localhost:3000";

  const handleSave = async () => {
    setErrorMsg("");
    setStatus("detecting");
    logger.log("[EXT POPUP] handleSave started");
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      logger.log("[EXT POPUP] active tab:", tab?.url);
      if (!tab?.id) throw new Error("No active tab");

      let results;
      try {
        logger.log("[EXT POPUP] sending PARSE_LISTING to tab", tab.id);
        results = await chrome.tabs.sendMessage(tab.id, { type: "PARSE_LISTING" });
        logger.log("[EXT POPUP] results from content script:", JSON.stringify(results, null, 2));
      } catch (e) {
        logger.error("[EXT POPUP] sendMessage failed:", e);
        throw new Error("Content script not loaded. Refresh the page and try again.");
      }

      if (results?.error) {
        throw new Error(results.error);
      }

      if (!results?.property) {
        throw new Error("Could not detect a property listing on this page.");
      }

      setStatus("saving");

      let response;
      try {
        response = await fetch(`${apiUrl}/api/properties/save`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify(results.property),
        });
      } catch (fetchErr) {
        throw new Error(`Cannot connect to ${apiUrl}. Make sure the app is running.`);
      }

      if (response.status === 401) {
        throw new Error("Invalid API key. Check your settings.");
      }

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        logger.log("[EXT POPUP] server error response:", JSON.stringify(data, null, 2));
        if (data?.details?.fieldErrors) {
          const errors = Object.entries(data.details.fieldErrors)
            .map(([field, msgs]) => `${field}: ${(msgs as string[]).join(", ")}`)
            .join("\n");
          throw new Error(`Validation failed:\n${errors}`);
        }
        throw new Error(data?.error || `Server error (${response.status})`);
      }

      setStatus("saved");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
      setStatus("error");
    }
  };

  const handleAnalyze = async () => {
    setErrorMsg("");
    setStatus("analyzing");
    logger.log("[EXT POPUP] handleAnalyze started");
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      logger.log("[EXT POPUP] active tab:", tab?.url);
      if (!tab?.id) throw new Error("No active tab");

      let results;
      try {
        logger.log("[EXT POPUP] sending ANALYZE_STRUCTURE to tab", tab.id);
        results = await chrome.tabs.sendMessage(tab.id, { type: "ANALYZE_STRUCTURE" });
        logger.log("[EXT POPUP] results from content script:", JSON.stringify(results, null, 2));
      } catch (e) {
        logger.error("[EXT POPUP] sendMessage failed:", e);
        throw new Error("Content script not loaded. Refresh the page and try again.");
      }

      if (results?.error) {
        throw new Error(results.error);
      }

      if (!results?.snapshot) {
        throw new Error("Could not analyze page structure.");
      }

      const snapshot = results.snapshot;
      const provider = results.provider || "unknown";

      let response;
      try {
        response = await fetch(`${apiUrl}/api/snapshots/save`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            provider,
            url: snapshot.url,
            snapshot,
          }),
        });
      } catch (fetchErr) {
        throw new Error(`Cannot connect to ${apiUrl}. Make sure the app is running.`);
      }

      if (response.status === 401) {
        throw new Error("Invalid API key. Check your settings.");
      }

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        logger.log("[EXT POPUP] server error response:", JSON.stringify(data, null, 2));
        throw new Error(data?.error || `Server error (${response.status})`);
      }

      const data = await response.json();
      logger.log("[EXT POPUP] snapshot saved:", data.id);
      setStatus("analyzed");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
      setStatus("error");
    }
  };

  if (showSettings) {
    return (
      <div style={{ padding: 16, width: 300, fontFamily: "system-ui, sans-serif" }}>
        <h2 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 600 }}>Prop Atlas Settings</h2>
        <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>
          Get your API key from the dashboard:
        </p>
        <a
          href={`${apiUrl}/`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "block",
            marginBottom: 12,
            color: "#2563eb",
            fontSize: 13,
          }}
        >
          Open Dashboard
        </a>
        <input
          type="text"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Paste your API key here"
          style={{
            width: "100%",
            padding: "8px 12px",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            fontSize: 13,
            marginBottom: 12,
            boxSizing: "border-box",
          }}
        />
        <button
          onClick={handleSaveApiKey}
          disabled={!apiKey}
          style={{
            width: "100%",
            padding: "10px 16px",
            background: apiKey ? "#2563eb" : "#9ca3af",
            color: "white",
            border: "none",
            borderRadius: 6,
            cursor: apiKey ? "pointer" : "not-allowed",
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          Save API Key
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, width: 300, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Prop Atlas</h2>
        <button
          onClick={() => setShowSettings(true)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 18,
            padding: 0,
          }}
        >
          ⚙️
        </button>
      </div>

      {status === "idle" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            onClick={handleSave}
            style={{
              width: "100%",
              padding: "10px 16px",
              background: "#2563eb",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            Save Property
          </button>
          {process.env.NODE_ENV === "development" && (
            <button
              onClick={handleAnalyze}
              style={{
                width: "100%",
                padding: "10px 16px",
                background: "#f3f4f6",
                color: "#374151",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              Analyze Structure
            </button>
          )}
        </div>
      )}

      {status === "detecting" && <p style={{ color: "#6b7280" }}>Detecting listing...</p>}
      {status === "saving" && <p style={{ color: "#6b7280" }}>Saving...</p>}
      {status === "saved" && <p style={{ color: "#16a34a", fontWeight: 500 }}>Property saved!</p>}
      {status === "analyzing" && <p style={{ color: "#6b7280" }}>Analyzing structure...</p>}
      {status === "analyzed" && <p style={{ color: "#16a34a", fontWeight: 500 }}>Structure captured!</p>}

      {status === "error" && (
        <>
          <p style={{ color: "#dc2626", fontSize: 13, lineHeight: 1.4 }}>{errorMsg}</p>
          {errorMsg.includes("API key") && (
            <button
              onClick={() => setShowSettings(true)}
              style={{
                display: "block",
                marginTop: 8,
                color: "#2563eb",
                fontSize: 13,
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
              }}
            >
              Update API key
            </button>
          )}
          <button
            onClick={() => { setStatus("idle"); setErrorMsg(""); }}
            style={{
              marginTop: 12,
              padding: "8px 16px",
              background: "#f3f4f6",
              border: "1px solid #d1d5db",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            Try Again
          </button>
        </>
      )}
    </div>
  );
}

export default IndexPopup;
