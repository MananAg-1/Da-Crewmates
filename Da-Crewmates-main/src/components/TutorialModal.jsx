import React, { useState } from "react";

// Simple tutorial modal that embeds a video and can persist "don't show again" per user.
export default function TutorialModal({ user, onClose }) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const storageKey = user ? `dc_tutorial_shown_${user.id}` : "dc_tutorial_shown_guest";

  function handleClose(savePreference = false) {
    try {
      if (savePreference) {
        localStorage.setItem(storageKey, "true");
      }
    } catch (e) {
      // ignore storage errors
      // console.warn("Unable to write tutorial preference", e);
    }
    onClose?.();
  }

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1200 }}>
      <div
        onClick={() => handleClose(false)}
        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)" }}
        aria-hidden
      />

      <div
        role="dialog"
        aria-label="Tutorial"
        style={{
          position: "relative",
          width: "min(960px, 92vw)",
          maxHeight: "88vh",
          background: "#fff",
          borderRadius: 12,
          padding: 18,
          boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
          zIndex: 1300,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: "1.15rem" }}>Welcome to Da Crewmates — Quick Tutorial</h2>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label style={{ fontSize: "0.9rem", display: "flex", gap: 8, alignItems: "center", whiteSpace: "nowrap" }}>
              <input type="checkbox" checked={dontShowAgain} onChange={(e) => setDontShowAgain(e.target.checked)} />
              Don't show again
            </label>
            <button
              onClick={() => handleClose(dontShowAgain)}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ccc", background: "#f5f5f5", flexShrink: 0 }}
            >
              Close
            </button>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div style={{ 
          flex: 1, 
          display: "flex", 
          flexDirection: "column", 
          gap: 12, 
          overflow: "auto",
          minHeight: 0 
        }}>
          {/* Video Container */}
          <div style={{ 
            position: "relative", 
            paddingTop: "56.25%", 
            background: "#000", 
            borderRadius: 8, 
            overflow: "hidden",
            flexShrink: 0
          }}>
            <iframe 
              width="951" 
              height="535" 
              src="https://www.youtube.com/embed/AMcnrNJnCXs" 
              title="Tutorial" 
              frameBorder="0" 
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
              allowFullScreen
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
              }}
            />
          </div>

          {/* Description Text */}
          <p style={{ margin: 0, color: "#333", fontSize: "0.95rem", lineHeight: 1.5, flexShrink: 0 }}>
            This short video walks through the basic station navigation and where to find posts, messages, and settings. If you'd prefer not to see this again, check "Don't show again" and close the window.
          </p>
        </div>
      </div>
    </div>
  );
}
