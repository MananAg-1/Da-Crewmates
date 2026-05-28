import React from "react";

export default function SplashScreen() {
  return (
    <div className="splashScreen">
      <div className="splashContent">
        <div className="splashRings">
          <div className="splashRing ring1"></div>
          <div className="splashRing ring2"></div>
          <div className="splashRing ring3"></div>
        </div>
        <div className="splashLogo">Da Crewmates</div>
        <div className="splashTagline">Establishing Connection...</div>
        <div className="splashProgressBar">
          <div className="splashProgressFill"></div>
        </div>
      </div>
    </div>
  );
}
