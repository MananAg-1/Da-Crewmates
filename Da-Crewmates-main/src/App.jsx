import React, { useCallback, useEffect, useState } from "react";
import LandingScreen from "./components/LandingScreen";
import SplashScreen from "./components/SplashScreen";
import { login, signup } from "./lib/api";

export default function App() {
  const [user, setUser] = useState(null);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  const handleEnter = useCallback(async (payload) => {
    const auth = payload.mode === "signup" ? await signup(payload) : await login(payload);
    setUser(auth.user);
  }, []);

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
      <iframe
        title="Da Crewmates Game"
        src={`/game/index.html?authed=1&crew=${encodeURIComponent(user.displayName || user.email || "Crewmate")}`}
        className="gameEmbedFrame"
      />
    </main>
  );
}
