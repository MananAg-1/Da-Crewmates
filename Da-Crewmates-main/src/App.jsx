import React, { useCallback, useEffect, useState } from "react";
import LandingScreen from "./components/LandingScreen";
import SplashScreen from "./components/SplashScreen";
import { login, signup } from "./lib/api";
import TutorialModal from "./components/TutorialModal";

function getGameApiBase() {
  if (import.meta.env.VITE_API_BASE_URL) {
    return normalizeApiBase(import.meta.env.VITE_API_BASE_URL);
  }

  if (typeof window === "undefined") return "http://localhost:4000";

  const { hostname, protocol } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "http://localhost:4000";
  }
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) {
    return `${protocol}//${hostname}:4000`;
  }
  return "";
}

function normalizeApiBase(value) {
  return String(value || "")
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/api$/i, "");
}

export default function App() {
  const [user, setUser] = useState(null);
  const [showSplash, setShowSplash] = useState(true);

  // New: show tutorial modal state
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  const handleEnter = useCallback(async (payload) => {
    const auth = payload.mode === "signup" ? await signup(payload) : await login(payload);
    setUser(auth.user);
  }, []);

  // When a user logs in, check localStorage to decide whether to show the tutorial
  useEffect(() => {
    if (!user) {
      setShowTutorial(false);
      return;
    }

    const storageKey = `dc_tutorial_shown_${user.id}`;
    try {
      const shown = localStorage.getItem(storageKey) === "true";
      if (!shown) {
        setShowTutorial(true);
      }
    } catch (e) {
      // localStorage unavailable — silently skip and show tutorial by default
      setShowTutorial(true);
    }
  }, [user]);

  useEffect(() => {
    function onMessage(event) {
      if (event?.data?.type === "dc_logout") {
        setUser(null);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  if (showSplash) {
    return <SplashScreen />;
  }

  if (!user) {
    return <LandingScreen onEnter={handleEnter} />;
  }

  return (
    <main className="appShell">
      {/* Render tutorial modal on first login (per-user) */}
      {showTutorial && <TutorialModal user={user} onClose={() => setShowTutorial(false)} />}

      <iframe
        title="Da Crewmates Game"
        src={`/game/index.html?authed=1&crew=${encodeURIComponent(
          user.displayName || user.email || "Crewmate"
        )}&user=${encodeURIComponent(user.id)}&api=${encodeURIComponent(getGameApiBase())}`}
        className="gameEmbedFrame"
      />
    </main>
  );
}
