import React, { useEffect, useRef, useState } from "react";
import { resetPassword } from "../lib/api";

const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  "987891616825-qg18hdde2v576cfpq44qmko4c9g1po4f.apps.googleusercontent.com";

function decodeJwtPayload(token) {
  const parts = String(token || "").split(".");
  if (parts.length < 2) return null;
  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function HyperspaceCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let animId;

    const STAR_COUNT = 400;
    const SPEED = 6;
    const MAX_Z = 1000;

    const stars = Array.from({ length: STAR_COUNT }, () => ({
      x: (Math.random() - 0.5) * 2,
      y: (Math.random() - 0.5) * 2,
      z: Math.random() * MAX_Z,
      pz: 0,
    }));

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    function project(x, y, z) {
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const scale = MAX_Z / z;
      return {
        sx: x * scale * canvas.width * 0.5 + cx,
        sy: y * scale * canvas.height * 0.5 + cy,
        r: Math.max(0.3, (1 - z / MAX_Z) * 2.2),
      };
    }

    function frame() {
      ctx.fillStyle = "rgba(3, 6, 13, 0.18)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (const s of stars) {
        const prevZ = s.pz || s.z;
        s.pz = s.z;
        s.z -= SPEED;

        if (s.z <= 1) {
          s.x = (Math.random() - 0.5) * 2;
          s.y = (Math.random() - 0.5) * 2;
          s.z = MAX_Z;
          s.pz = MAX_Z;
          continue;
        }

        const curr = project(s.x, s.y, s.z);
        const prev = project(s.x, s.y, prevZ);
        const progress = 1 - s.z / MAX_Z;
        const alpha = Math.min(1, progress * 3);
        const r = Math.round(180 + progress * 75);
        const g = Math.round(200 + progress * 55);

        ctx.beginPath();
        ctx.moveTo(prev.sx, prev.sy);
        ctx.lineTo(curr.sx, curr.sy);
        ctx.strokeStyle = `rgba(${r},${g},255,${alpha})`;
        ctx.lineWidth = curr.r;
        ctx.stroke();
      }

      animId = requestAnimationFrame(frame);
    }

    animId = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="hyperspaceCanvas" />;
}

function FadeInSection({ children }) {
  const [isVisible, setVisible] = useState(false);
  const domRef = useRef();

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) setVisible(true);
      });
    }, { threshold: 0.1 });
    
    if (domRef.current) observer.observe(domRef.current);
    return () => {
      if (domRef.current) observer.unobserve(domRef.current);
    };
  }, []);

  return (
    <div className={`fade-in-section ${isVisible ? 'is-visible' : ''}`} ref={domRef}>
      {children}
    </div>
  );
}

export default function LandingScreen({ onEnter }) {
  const [mode, setMode] = useState("login");
  const [identity, setIdentity] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showResetConfirmPassword, setShowResetConfirmPassword] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const [showDock, setShowDock] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authSuccess, setAuthSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const googleBtnRef = useRef(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setAuthError("");
    setAuthSuccess("");
    setIsSubmitting(true);

    try {
      if (isResetMode) {
        const resetIdentity = identity.trim() || email.trim();
        if (!resetIdentity) throw new Error("Enter your crew name or email.");
        if (resetPasswordValue.length < 6) throw new Error("New password must be at least 6 characters.");
        if (resetPasswordValue !== resetConfirmPassword) throw new Error("Passwords do not match.");

        await resetPassword({
          identity: resetIdentity,
          newPassword: resetPasswordValue,
        });
        setAuthSuccess("Password reset complete. You can log in now.");
        setIsResetMode(false);
        setPassword("");
        setResetPasswordValue("");
        setResetConfirmPassword("");
        return;
      }

      if (mode === "login") {
        await onEnter({
          mode: "login",
          identity: identity.trim(),
          password,
        });
      } else {
        await onEnter({
          mode: "signup",
          displayName: displayName.trim(),
          email: email.trim(),
          password,
          avatarColor: "cyan",
        });
      }
    } catch (error) {
      setAuthError(error.message || "Unable to authenticate right now.");
    } finally {
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    if (isResetMode) return;
    if (!showDock || !googleBtnRef.current) return;
    if (mode !== "login") return;

    let cancelled = false;

    function renderGoogleButton() {
      if (cancelled || !window.google?.accounts?.id || !googleBtnRef.current) return;
      googleBtnRef.current.innerHTML = "";

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response) => {
          const payload = decodeJwtPayload(response.credential);
          const email = payload?.email;
          if (!email) {
            setAuthError("Google sign-in did not return an email.");
            return;
          }

          setAuthError("");
          setIsSubmitting(true);
          try {
            await onEnter({
              mode: "login",
              identity: email,
              password: "",
              authProvider: "google",
            });
          } catch (error) {
            setAuthError(error.message || "Google sign-in failed.");
          } finally {
            setIsSubmitting(false);
          }
        },
      });

      window.google.accounts.id.renderButton(googleBtnRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        width: 320,
      });
    }

    if (window.google?.accounts?.id) {
      renderGoogleButton();
      return () => {
        cancelled = true;
      };
    }

    const existing = document.querySelector('script[data-google-identity="1"]');
    if (existing) {
      existing.addEventListener("load", renderGoogleButton, { once: true });
      return () => {
        cancelled = true;
      };
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentity = "1";
    script.onload = renderGoogleButton;
    document.head.appendChild(script);

    return () => {
      cancelled = true;
    };
  }, [isResetMode, mode, onEnter, showDock]);

  return (
    <main className="landingShell">
      <HyperspaceCanvas />
      <nav className="landingNavPremium" aria-label="DevSpace landing navigation">
        <div className="navBrand">
          <div className="brandLogo" />
          <strong>Da Crewmates</strong>
        </div>
        <button className="navLoginBtn" onClick={() => { setMode("login"); setShowDock(true); }}>Crew Login</button>
      </nav>

      <section className="premiumHero" aria-label="DevSpace Launch">
        <div className="heroGlow left nebulaMove" />
        <div className="heroGlow right nebulaMoveAlt" />
        
        <FadeInSection>
          <div className="heroContent">
            <h1 className="heroTitle">
              Stop Doomscrolling. <br /> <span className="textGradient">Start Exploring.</span>
            </h1>
            <p className="heroSubtitle">
              We built a playable world where you actually walk into rooms instead of endlessly swiping a feed. Hang out, post updates in the Cafeteria, and do missions with your crew.
            </p>
            <div className="heroActions">
              <button className="premiumButton primary" type="button" onClick={() => setShowDock(true)}>
                Get Your Crew Pass
                <span className="buttonGlow" />
              </button>
              <a href="#features" className="premiumButton secondary">See How It Works</a>
            </div>
          </div>
        </FadeInSection>

        <div className="featureCards" id="features">
          <FadeInSection>
            <div className="featureCard">
              <div className="featureIcon feedIcon" />
              <h3>Ditch the Feed</h3>
              <p>Instead of a vertical timeline, you get a ship. Walk into the Cafeteria for the daily gossip or hit the Reactor Room for serious talk.</p>
            </div>
          </FadeInSection>
          <FadeInSection>
            <div className="featureCard">
              <div className="featureIcon missionIcon" />
              <h3>Actually Do Stuff</h3>
              <p>Liking posts is boring. Complete missions with your crew, earn ranks, and unlock stuff to make your avatar look cooler.</p>
            </div>
          </FadeInSection>
          <FadeInSection>
            <div className="featureCard">
              <div className="featureIcon profileIcon" />
              <h3>A Chill Vibe</h3>
              <p>No algorithms screaming at you. Just a cozy, lo-fi space station that's actually nice to leave open on your second monitor.</p>
            </div>
          </FadeInSection>
        </div>

        {showDock && (
          <div className="tabletOverlay" role="dialog" aria-label="Crew login terminal">
            <button className="tabletBackdrop" type="button" onClick={() => setShowDock(false)} aria-label="Close login" />
            <div className="crewTablet">
              <div className="astronautHand left" aria-hidden="true">
                <span className="glovePalm" />
                <span className="gloveThumb" />
              </div>
              <div className="astronautHand right" aria-hidden="true">
                <span className="glovePalm" />
                <span className="gloveThumb" />
              </div>
              <div className="tabletFrame">
                <div className="tabletGrip left" aria-hidden="true" />
                <div className="tabletGrip right" aria-hidden="true" />
                <form className="loginPanel tabletScreen" onSubmit={handleSubmit}>
                  <div className="tabletScan" />
                  <div className="tabletScreenHeader">
                    <span>Station Access</span>
                    <button type="button" onClick={() => setShowDock(false)} aria-label="Close login">
                      X
                    </button>
                  </div>

                  <div className="modeSwitch" aria-label="Authentication mode">
                    <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>
                      Login
                    </button>
                    <button type="button" className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>
                      Sign Up
                    </button>
                  </div>

                  {(mode === "login" || isResetMode) ? (
                    <label>
                      Crew Name / Email
                      <input
                        value={identity}
                        onChange={(event) => setIdentity(event.target.value)}
                        placeholder="Crew ID or name@shipmail.com"
                        maxLength={64}
                      />
                    </label>
                  ) : (
                    <>
                      <label>
                        Crew Name
                        <input
                          value={displayName}
                          onChange={(event) => setDisplayName(event.target.value)}
                          placeholder="Enter your crew name"
                          maxLength={32}
                        />
                      </label>

                      <label>
                        Email
                        <input
                          type="email"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          placeholder="name@shipmail.com"
                        />
                      </label>
                    </>
                  )}

                  {!isResetMode ? (
                    <label>
                      Password
                      <div className="passwordInputWrap">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          placeholder="Enter your password"
                        />
                        <button className="passwordToggle" type="button" onClick={() => setShowPassword((value) => !value)}>
                          {showPassword ? "Hide" : "Show"}
                        </button>
                      </div>
                    </label>
                  ) : (
                    <>
                      <label>
                        New Password
                        <div className="passwordInputWrap">
                          <input
                            type={showResetPassword ? "text" : "password"}
                            value={resetPasswordValue}
                            onChange={(event) => setResetPasswordValue(event.target.value)}
                            placeholder="Enter new password"
                          />
                          <button className="passwordToggle" type="button" onClick={() => setShowResetPassword((value) => !value)}>
                            {showResetPassword ? "Hide" : "Show"}
                          </button>
                        </div>
                      </label>

                      <label>
                        Confirm Password
                        <div className="passwordInputWrap">
                          <input
                            type={showResetConfirmPassword ? "text" : "password"}
                            value={resetConfirmPassword}
                            onChange={(event) => setResetConfirmPassword(event.target.value)}
                            placeholder="Re-enter new password"
                          />
                          <button
                            className="passwordToggle"
                            type="button"
                            onClick={() => setShowResetConfirmPassword((value) => !value)}
                          >
                            {showResetConfirmPassword ? "Hide" : "Show"}
                          </button>
                        </div>
                      </label>
                    </>
                  )}

                  <button className="enterStationButton" type="submit">
                    {isSubmitting
                      ? "Connecting..."
                      : isResetMode
                        ? "Reset Password"
                        : mode === "login"
                          ? "Enter Station"
                          : "Create Crew Pass"}
                  </button>

                  {mode === "login" && !isResetMode && (
                    <>
                      <button className="passwordResetLink" type="button" onClick={() => setIsResetMode(true)}>
                        Forgot Password?
                      </button>
                      <div className="authDivider" aria-hidden="true">
                        <span />
                        <small>or</small>
                        <span />
                      </div>
                      <div className="googleAuthButton" ref={googleBtnRef} />
                    </>
                  )}

                  {isResetMode && (
                    <button className="passwordResetLink" type="button" onClick={() => setIsResetMode(false)}>
                      Back to Login
                    </button>
                  )}

                  {authError && <p className="authError">{authError}</p>}
                  {authSuccess && <p className="authSuccess">{authSuccess}</p>}
                </form>
              </div>
              <div className="tabletDock" aria-hidden="true" />
            </div>
          </div>
        )}
      </section>

      <footer className="landingFooter" aria-label="Site footer">
        <span>© {new Date().getFullYear()} DevSpace. All rights reserved.</span>
        <div className="footerLinks">
          <a href="#about">About Us</a>
          <a href="#contact">Contact Us</a>
        </div>
      </footer>
    </main>
  );
}
