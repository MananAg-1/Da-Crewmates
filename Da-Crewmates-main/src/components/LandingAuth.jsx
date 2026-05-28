import React, { useEffect, useRef, useState } from "react";

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

export default function LandingAuth({ onSubmit }) {
  const [mode, setMode] = useState("login");
  const [isResetMode, setIsResetMode] = useState(false);
  const [identity, setIdentity] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const googleBtnRef = useRef(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setBusy(true);

    try {
      if (isResetMode) {
        const resetIdentity = identity.trim() || email.trim();
        if (!resetIdentity) throw new Error("Enter your crew name or email.");
        if (resetPasswordValue.length < 6) throw new Error("New password must be at least 6 characters.");
        if (resetPasswordValue !== resetConfirmPassword) throw new Error("Passwords do not match.");

        await onSubmit({
          mode: "reset",
          identity: resetIdentity,
          newPassword: resetPasswordValue,
        });

        setSuccess("Password reset complete. You can log in now.");
        setIsResetMode(false);
        setPassword("");
        setResetPasswordValue("");
        setResetConfirmPassword("");
        return;
      }

      if (mode === "login") {
        await onSubmit({ mode: "login", identity: identity.trim(), password });
      } else {
        await onSubmit({
          mode: "signup",
          displayName: displayName.trim(),
          email: email.trim(),
          password,
          avatarColor: "cyan",
        });
      }

      setSuccess(mode === "login" ? "Logged in successfully." : "Account created successfully.");
    } catch (submitError) {
      setError(submitError.message || "Unable to authenticate right now.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (mode !== "login" || isResetMode || !googleBtnRef.current) return;
    let cancelled = false;

    function renderGoogleButton() {
      if (cancelled || !window.google?.accounts?.id || !googleBtnRef.current) return;
      googleBtnRef.current.innerHTML = "";
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response) => {
          const payload = decodeJwtPayload(response.credential);
          const googleEmail = payload?.email;
          const googleName = payload?.name || payload?.given_name || "Google Crew";
          if (!googleEmail) {
            setError("Google sign-in did not return an email.");
            return;
          }
          setError("");
          setBusy(true);
          try {
            await onSubmit({
              mode: "login",
              identity: googleEmail,
              password: "",
              authProvider: "google",
              displayName: googleName,
            });
          } catch (submitError) {
            setError(submitError.message || "Google sign-in failed.");
          } finally {
            setBusy(false);
          }
        },
      });
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        width: 280,
      });
    }

    if (window.google?.accounts?.id) {
      renderGoogleButton();
      return () => {
        cancelled = true;
      };
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = renderGoogleButton;
    document.head.appendChild(script);

    return () => {
      cancelled = true;
    };
  }, [isResetMode, mode, onSubmit]);

  return (
    <main className="shell">
      <section className="card">
        <h1>DevSpace</h1>
        <p>Landing and authentication only.</p>

        <div className="tabs" role="tablist" aria-label="Authentication mode">
          <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Login</button>
          <button type="button" className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>Sign Up</button>
        </div>

        <form onSubmit={handleSubmit} className="form">
          {(mode === "login" || isResetMode) ? (
            <label>
              Crew Name / Email
              <input value={identity} onChange={(e) => setIdentity(e.target.value)} placeholder="Crew ID or name@email.com" maxLength={64} />
            </label>
          ) : (
            <>
              <label>
                Crew Name
                <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Enter your crew name" maxLength={32} />
              </label>
              <label>
                Email
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@email.com" />
              </label>
            </>
          )}

          {!isResetMode ? (
            <label>
              Password
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" />
            </label>
          ) : (
            <>
              <label>
                New Password
                <input type="password" value={resetPasswordValue} onChange={(e) => setResetPasswordValue(e.target.value)} placeholder="Enter new password" />
              </label>
              <label>
                Confirm Password
                <input type="password" value={resetConfirmPassword} onChange={(e) => setResetConfirmPassword(e.target.value)} placeholder="Re-enter new password" />
              </label>
            </>
          )}

          <button className="cta" type="submit" disabled={busy}>
            {busy ? "Please wait..." : isResetMode ? "Reset Password" : mode === "login" ? "Login" : "Create Account"}
          </button>

          {mode === "login" && !isResetMode && (
            <>
              <button className="link" type="button" onClick={() => setIsResetMode(true)}>Forgot Password?</button>
              <div ref={googleBtnRef} />
            </>
          )}

          {isResetMode && (
            <button className="link" type="button" onClick={() => setIsResetMode(false)}>Back to Login</button>
          )}

          {error && <p className="error">{error}</p>}
          {success && <p className="success">{success}</p>}
        </form>
      </section>
    </main>
  );
}
