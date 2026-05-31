//Ts easy AF
const zoomLevel = 0.5; 

    const landingView = document.getElementById('landing-view');
    const appView = document.getElementById('app-view');
    const mapWrapper = document.getElementById('map-wrapper');
    const player = document.getElementById('player');
    
    const zonePrompt = document.getElementById('zone-prompt');
    const promptActionText = document.getElementById('prompt-action-text');
    const terminalOverlay = document.getElementById('terminal-overlay');
    const gameContainer = document.getElementById('game-container');
    const terminalTitle = document.getElementById('terminal-title');
    const terminalBody = document.getElementById('terminal-body');
    const navigationHUDOverlay = document.getElementById('navigation-hud-overlay');
    const navBaseImg = document.getElementById('nav-base-img');

    const collisionCanvas = document.getElementById('collision-canvas');
    const ctx = collisionCanvas.getContext('2d', { willReadFrequently: true });
    const zoningCanvas = document.getElementById('zoning-canvas');
    const zCtx = zoningCanvas.getContext('2d', { willReadFrequently: true });
    const navZoningCanvas = document.getElementById('nav-zoning-canvas');
    const nzCtx = navZoningCanvas.getContext('2d', { willReadFrequently: true });
    //FAHH HOW DID THE CANVASES WORK
    let externalTemplateDOM = null;

let worldWidth = 0;  
    let worldHeight = 0; 
    let worldX = 0; 
    let worldY = 0; 

    let currentCameraX = null;
    let currentCameraY = null;
    const lerpFactor = 0.08; // Smooth camera damping factor (smaller = smoother, larger = faster) 
    
    const speed = 8;
    let isSystemActive = false;
    let isTerminalOpen = false;
    let isNavHUDOpen = false;
    let isWarpingAnimationActive = false; 
    let spriteFacingLeft = false;

    const hitboxRadiusX = 20; 
    const hitboxRadiusY = 10; 

    let activeCurrentZone = null;
    let standingZoneHexKey = null;
    let currentXOffset = "0px";
    let currentCrewmateColorIndex = 0;
    const queryParams = new URLSearchParams(window.location.search);
    const autoAuthBypass = queryParams.get("authed") === "1";
    const authedCrewName = queryParams.get("crew") || "Crewmate";
    const fallbackCrewId = `guest-${authedCrewName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "crewmate"}`;
    const authedCrewId = queryParams.get("user") || fallbackCrewId;

    const spawnPoints = {
      "ffa420": { x: 0, y: 0, name: "Default Spawn" },
      "4a192c": { x: 0, y: 0, name: "Weapons" },
      "e55137": { x: 0, y: 0, name: "O2" },
      "606e8c": { x: 0, y: 0, name: "Navigation" },
      "0e294b": { x: 0, y: 0, name: "Shields" },
      "20214f": { x: 0, y: 0, name: "Communications" },
      "f5d033": { x: 0, y: 0, name: "Storage" },
      "2d572c": { x: 0, y: 0, name: "Admin" },
      "de4c8a": { x: 0, y: 0, name: "Electrical" },
      "c35831": { x: 0, y: 0, name: "MedBay" },
      "aea04b": { x: 0, y: 0, name: "Security" },
      "b8b799": { x: 0, y: 0, name: "Upper Engine" },
      "633a34": { x: 0, y: 0, name: "Lower Engine" },
      "6c6874": { x: 0, y: 0, name: "Reactor" }
    };

//For anyone wondering, these HEX codes are basically the same as the ones mentioned in the assets

const terminalContentRegistry = {
      "9d9101": { title: "Upper Engine", action: "About us", spawnHex: "b8b799" },
      "47402e": { title: "Lower Engine", action: "About us", spawnHex: "633a34" },
      "641c34": { title: "Reactor", action: "Site Stats", spawnHex: "6c6874" },
      "ffa420": { title: "Security", action: "Security Settings", spawnHex: "aea04b" },
      "755c48": { title: "MedBay", action: "Your Analytics", spawnHex: "c35831" },
      "efa94a": { title: "Electrical", action: "Post Creation", spawnHex: "de4c8a" },
      "8f8b66": { title: "Cafeteria", action: "Feed", spawnHex: "ffa420" }, 
      "00ff00": { title: "O2", action: "Discover", spawnHex: "e55137" },
      "0000ff": { title: "Weapons", action: "Trending", spawnHex: "4a192c" },
      "ff0000": { title: "Navigation", action: "Help", spawnHex: "606e8c" },
      "ffff00": { title: "Shields", action: "Privacy Settings", spawnHex: "0e294b" },
      "00ffff": { title: "Communication", action: "Inbox", spawnHex: "20214f" },
      "efa9fa": { title: "Storage", action: "Saved", spawnHex: "f5d033" },
      "636b2f": { title: "Admin", action: "Account", spawnHex: "2d572c" }
    };

    const keys = {
      ArrowUp: false, w: false,
      ArrowDown: false, s: false,
      ArrowLeft: false, a: false,
      ArrowRight: false, d: false
    };
    loadExternalHTMLTemplates();


    window.addEventListener('keydown', (e) => { 
      if (isWarpingAnimationActive) return; 
      if (isNavHUDOpen) {
        if (e.key === 'Escape' || e.key.toLowerCase() === 'f') closeNavigationHUD();
        return;
      }
      if (isTerminalOpen && e.key.toLowerCase() === 'f') {
        closeTerminal();
        return;
      }
      if (!isTerminalOpen && e.key.toLowerCase() === 'f' && activeCurrentZone) {
        openTerminal(standingZoneHexKey);
        return;
      }
      if (e.key in keys) keys[e.key] = true; 
    });
    
    window.addEventListener('keyup', (e) => { if (e.key in keys) keys[e.key] = false; });

    const collisionImg = new Image();
    const zoningImg = new Image();
    const navZoningImg = new Image();
    let collisionLoaded = false;
    let zoningLoaded = false;
    let navZoningLoaded = false;

    collisionImg.onload = function() {
      worldWidth = collisionImg.naturalWidth;
      worldHeight = collisionImg.naturalHeight;
      mapWrapper.style.width = worldWidth + 'px';
      mapWrapper.style.height = worldHeight + 'px';
      collisionCanvas.width = worldWidth;
      collisionCanvas.height = worldHeight;
      ctx.drawImage(collisionImg, 0, 0, worldWidth, worldHeight);
      collisionLoaded = true;
      tryStartGame();
    };
    
    zoningImg.onload = function() {
      zoningCanvas.width = zoningImg.naturalWidth;
      zoningCanvas.height = zoningImg.naturalHeight;
      zCtx.drawImage(zoningImg, 0, 0, zoningImg.naturalWidth, zoningImg.naturalHeight);
      zoningLoaded = true;
      tryStartGame();
    };

    navZoningImg.onload = function() {
      navZoningCanvas.width = navZoningImg.naturalWidth;
      navZoningCanvas.height = navZoningImg.naturalHeight;
      nzCtx.drawImage(navZoningImg, 0, 0, navZoningImg.naturalWidth, navZoningImg.naturalHeight);
      navZoningLoaded = true;
    };

    collisionImg.src = 'Assets/Map-collision.png'; 
    zoningImg.src = 'Assets/Map-zoning.png';
    navZoningImg.src = 'Assets/Navigate-zoning.png';

    function tryStartGame() {
      if (collisionLoaded && zoningLoaded) {
        scanMapForSpawnCoordinates();
        worldX = spawnPoints["ffa420"].x || worldWidth / 2;
        worldY = spawnPoints["ffa420"].y || worldHeight / 2;
        enterPlatform();
      }
    }

    function enterPlatform() {
      if (landingView) landingView.classList.add('hidden');
      appView.classList.remove('hidden');
      if (!isSystemActive) {
        isSystemActive = true;
        requestAnimationFrame(gameLoop);
      }
    }

    function scanMapForSpawnCoordinates() {
      try {
        const imgData = ctx.getImageData(0, 0, worldWidth, worldHeight);
        const data = imgData.data;
        
        for (let y = 0; y < worldHeight; y += 2) { 
          for (let x = 0; x < worldWidth; x += 2) {
            const index = (y * worldWidth + x) * 4;
            if (data[index + 3] < 10) continue; 

            const hex = rgbToHex(data[index], data[index + 1], data[index + 2]);
            if (hex in spawnPoints) {
              spawnPoints[hex].x = x;
              spawnPoints[hex].y = y;
            }
          }
        }
      } catch (e) {
        console.error("Failed parsing spawn points automatically: ", e);
      }
    }

    function rgbToHex(r, g, b) {
      return ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toLowerCase();
    }

    function isPixelSolid(x, y) {
      if (x < 0 || x >= worldWidth || y < 0 || y >= worldHeight) return true; 
      try {
        const pixel = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
        return rgbToHex(pixel[0], pixel[1], pixel[2]) === "ff00ff"; 
      } catch(e) {
        return false;
      }
    }

    function checkPassable(targetX, targetY) {
      for (let xOffset = -hitboxRadiusX; xOffset <= hitboxRadiusX; xOffset += 6) {
        for (let yOffset = -hitboxRadiusY; yOffset <= hitboxRadiusY; yOffset += 6) {
          if (isPixelSolid(targetX + xOffset, targetY + yOffset)) {
            return false; 
          }
        }
      }
      return true; 
    }

    function checkCurrentZone(playerX, playerY) {
      if (!zoningLoaded) return null;
      try {
        const pixel = zCtx.getImageData(Math.floor(playerX), Math.floor(playerY), 1, 1).data;
        if (pixel[3] < 10) return null;
        const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);
        standingZoneHexKey = hex; 
        return terminalContentRegistry[hex] || null;
      } catch (e) {
        return null;
      }
    }

    function setCrewmateColor(index) {
      currentCrewmateColorIndex = index;
      const pixelShift = -(index * 81.7);
      currentXOffset = `${pixelShift}px`;
      player.style.backgroundPositionX = currentXOffset;
      updateAdminColorSelection();
    }

    function openNavigationHUD() {
      if (!isSystemActive || isTerminalOpen || isWarpingAnimationActive) return;
      isNavHUDOpen = true;
      player.style.animationPlayState = 'paused';
      appView.classList.add('blur-gameplay');
      navigationHUDOverlay.classList.remove('hidden');
      zonePrompt.classList.remove('visible');
    }

    function closeNavigationHUD() {
      isNavHUDOpen = false;
      appView.classList.remove('blur-gameplay');
      navigationHUDOverlay.classList.add('hidden');
      if (activeCurrentZone && !isWarpingAnimationActive) {
        zonePrompt.classList.add('visible');
      }
    }

    function handleNavMapClick(event) {
      if (!navZoningLoaded || isWarpingAnimationActive) return;

      const rect = navBaseImg.getBoundingClientRect();
      const clickX = event.clientX - rect.left;
      const clickY = event.clientY - rect.top;

      const mapPixelX = Math.floor((clickX / rect.width) * navZoningCanvas.width);
      const mapPixelY = Math.floor((clickY / rect.height) * navZoningCanvas.height);

      try {
        const pixel = nzCtx.getImageData(mapPixelX, mapPixelY, 1, 1).data;
        if (pixel[3] < 10) return; 

        const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);
        const targetZone = terminalContentRegistry[hex];

        if (targetZone && targetZone.spawnHex) {
          executeTwoSecondQuantumWarp(targetZone, hex);
        }
      } catch (err) {
        console.error("Map tracking array fault:", err);
      }
    }

    function executeTwoSecondQuantumWarp(targetZone, hexKey) {
      const coordinateSet = spawnPoints[targetZone.spawnHex];
      
      if (!coordinateSet || (coordinateSet.x === 0 && coordinateSet.y === 0)) {
        console.warn(`Spawn token hex #${targetZone.spawnHex} missing in map design.`);
        return;
      }

      isWarpingAnimationActive = true;
      closeNavigationHUD(); 

      player.classList.remove('rematerialize');
      player.classList.add('dematerialize');

      setTimeout(() => {
        mapWrapper.classList.add('warp-active');
        
        worldX = coordinateSet.x;
        worldY = coordinateSet.y;
        standingZoneHexKey = hexKey;
        activeCurrentZone = targetZone;

        // Force snap the internal camera tracking coordinates to sync with the CSS warp transition
        currentCameraX = (window.innerWidth / 2) - (worldX * zoomLevel);
        currentCameraY = (window.innerHeight / 2) - (worldY * zoomLevel);
        updateCameraPosition();

        setTimeout(() => {
          mapWrapper.classList.remove('warp-active'); 
          player.classList.remove('dematerialize');
          player.classList.add('rematerialize');

          setTimeout(() => {
            player.classList.remove('rematerialize');
            isWarpingAnimationActive = false;
            openTerminal(hexKey);
          }, 500);

        }, 1000); 

      }, 500); 
    }

    function updateCameraPosition() {
      const targetOffsetX = (window.innerWidth / 2) - (worldX * zoomLevel);
      const targetOffsetY = (window.innerHeight / 2) - (worldY * zoomLevel);

      if (currentCameraX === null || currentCameraY === null) {
        currentCameraX = targetOffsetX;
        currentCameraY = targetOffsetY;
      } else {
        currentCameraX += (targetOffsetX - currentCameraX) * lerpFactor;
        currentCameraY += (targetOffsetY - currentCameraY) * lerpFactor;
      }

      mapWrapper.style.transform = `translate(${currentCameraX}px, ${currentCameraY}px) scale(${zoomLevel})`;
    }


    async function loadExternalHTMLTemplates() {
      try {
        const response = await fetch('terminalTemplates.html');
        if (!response.ok) throw new Error('Could not pull down layout templates.');
        
        const rawHTMLText = await response.text();
        
        const parser = new DOMParser();
        externalTemplateDOM = parser.parseFromString(rawHTMLText, 'text/html');
        console.log("Raw HTML layouts pulled and ready for extraction.");
      } catch (err) {
        console.error("Failed loading external layout nodes:", err);
      }
    }


    function renderDynamicZoneContent(hexKey) {
      if (!externalTemplateDOM) {
        return `<p>Terminal systems initializing...</p>`;
      }

      const targetMarkup = externalTemplateDOM.querySelector(`[data-room="${hexKey}"]`);

      if (targetMarkup) {
        return targetMarkup.innerHTML;
      } else {
        const zone = terminalContentRegistry[hexKey];
        return `<p>Welcome to the ${zone ? zone.title : 'Station'} Operational Unit.</p>`;
      }
    }
    function openTerminal(hexKey) {
      const zone = terminalContentRegistry[hexKey];
      if (!zone) return;

      isTerminalOpen = true;
      player.style.animationPlayState = 'paused'; 

      terminalTitle.innerText = zone.title || zone.name;
      terminalBody.innerHTML = renderDynamicZoneContent(hexKey);
      if (hexKey === "8f8b66") {
        initCafeteriaBoard();
        loadCafeteriaApod();
      } else if (hexKey === "efa94a") {
        initElectricalHub();
      } else if (hexKey === "00ff00") {
        initO2Hub();
      } else if (hexKey === "0000ff") {
        initWeaponsHub();
      } else if (hexKey === "755c48") {
        initMedbayAnalytics();
      } else if (hexKey === "00ffff") {
        initFriendsHub();
      } else if (hexKey === "ff0000") {
        initNavigationHelpHub();
      } else if (hexKey === "ffff00") {
        initShieldsPrivacyHub();
      } else if (hexKey === "636b2f") {
        initAdminProfileHub();
      } else if (hexKey === "641c34") {
        initReactorHub();
      } else if (hexKey === "ffa420") {
        initSecurityHubBackend();
      } else if (hexKey === "efa9fa") {
        initStorageHub();
      }

      appView.classList.add('blur-gameplay');
      terminalOverlay.classList.remove('hidden');
      zonePrompt.classList.remove('visible'); 
    }

    function closeTerminal() {
      isTerminalOpen = false;
      appView.classList.remove('blur-gameplay');
      terminalOverlay.classList.add('hidden');
      if (activeCurrentZone) {
        zonePrompt.classList.add('visible');
      }
    }

    function gameLoop() {
      if (!isSystemActive) return;

      if (!isTerminalOpen && !isNavHUDOpen && !isWarpingAnimationActive) {
        let nextX = worldX;
        let nextY = worldY;
        let moving = false;

        if (keys.ArrowUp || keys.w)    { nextY -= speed; moving = true; }
        if (keys.ArrowDown || keys.s)  { nextY += speed; moving = true; }
        if (keys.ArrowLeft || keys.a)  { nextX -= speed; moving = true; spriteFacingLeft = true; }
        if (keys.ArrowRight || keys.d) { nextX += speed; moving = true; spriteFacingLeft = false; }

        if (checkPassable(nextX, worldY)) worldX = nextX;
        if (checkPassable(worldX, nextY)) worldY = nextY;

        const standingZone = checkCurrentZone(worldX, worldY);
        if (standingZone !== activeCurrentZone) {
          activeCurrentZone = standingZone;
          if (activeCurrentZone) {
            promptActionText.innerText = activeCurrentZone.action;
            zonePrompt.classList.add('visible');
          } else {
            zonePrompt.classList.remove('visible');
          }
        }

        if (spriteFacingLeft) {
          player.style.transform = 'translate(-50%, -50%) scaleX(-1.25) scaleY(1.25)';
        } else {
          player.style.transform = 'translate(-50%, -50%) scaleX(1.25) scaleY(1.25)';
        }

        player.style.animationPlayState = moving ? 'running' : 'paused';
        player.style.backgroundPositionX = currentXOffset;
      }

      if (!isWarpingAnimationActive) {
        updateCameraPosition();
      }

      requestAnimationFrame(gameLoop);
    }

    window.addEventListener('resize', () => {
      if (isSystemActive) {
        updateCameraPosition();
      }
    });

if (autoAuthBypass) {
  setTimeout(() => {
    if (!isSystemActive) enterPlatform();
  }, 60);
}

const hudUserName = document.getElementById("hud-user-name");
const hudUserInitial = document.getElementById("hud-user-initial");
if (hudUserName) hudUserName.textContent = authedCrewName;
if (hudUserInitial) hudUserInitial.textContent = authedCrewName.charAt(0).toUpperCase();

function toggleUserPanel() {
  const panel = document.getElementById("hud-user-panel");
  if (!panel) return;
  panel.classList.toggle("visible");
}

function requestLogoutToParent() {
  endCurrentSession();
  try {
    window.parent.postMessage({ type: "dc_logout" }, "*");
  } catch (e) {}
}

function openInnerOverlay() {
  document.getElementById("inner-overlay")
    .classList.add("active");
}

function closeInnerOverlay() {
  document.getElementById("inner-overlay")
    .classList.remove("active");
}

const postStore = {
  nextId: 300,
  backendReady: false,
  isLoading: false,
  posts: [
    {
      id: 1,
      tag: "Space",
      title: "Which planetary mission gave the biggest science return in the last decade?",
      body: "Consider mission duration, instrument quality, open data access, and how much each mission changed classroom-level understanding of planets and moons.",
      authorId: "crew-system",
      createdAt: "2026-05-29T10:00:00.000Z",
      upvotes: 1242,
      downvotes: 28,
      comments: ["Anon: Cassini transformed Saturn science across multiple fields.", "Anon: Juno data reshaped our understanding of Jupiter's interior."],
      savedByMe: true,
      seenByMe: false
    },
    {
      id: 2,
      tag: "Space",
      title: "What is one space fact that sounds impossible but is well established?",
      body: "Share one verified observation and include a short explanation for why it happens physically, so new readers can follow without deep math.",
      authorId: "crew-system",
      createdAt: "2026-05-29T09:00:00.000Z",
      upvotes: 987,
      downvotes: 39,
      comments: ["Anon: A day on Venus is longer than its year due to slow retrograde rotation.", "Anon: Time dilation from gravity is measurable with atomic clocks."],
      savedByMe: false,
      seenByMe: false
    },
    {
      id: 3,
      tag: "Space",
      title: "Which unresolved question in astronomy should get priority funding?",
      body: "Pick one major open problem and argue from impact: dark matter, early galaxy formation, exoplanet atmospheres, or something else.",
      authorId: "crew-system",
      createdAt: "2026-05-29T08:00:00.000Z",
      upvotes: 1089,
      downvotes: 87,
      comments: ["Anon: Exoplanet atmosphere chemistry could change the search for life.", "Anon: Dark matter constraints still affect almost every cosmology model."],
      savedByMe: true,
      seenByMe: false
    },
    {
      id: 4,
      tag: "Space",
      title: "How should we balance human spaceflight vs robotic exploration budgets?",
      body: "Discuss scientific output, risk, public engagement, and long-term infrastructure. Try comparing mission classes instead of absolute yes/no positions.",
      authorId: "crew-system",
      createdAt: "2026-05-28T14:00:00.000Z",
      upvotes: 734,
      downvotes: 291,
      comments: ["Anon: Robots are higher cadence science tools for the same cost band.", "Anon: Human missions accelerate systems engineering breakthroughs."],
      savedByMe: false,
      seenByMe: false
    },
    {
      id: 5,
      tag: "Space",
      title: "What are the biggest technical blockers for long-duration lunar habitats?",
      body: "Focus on radiation shielding, dust mitigation, closed-loop life support, and maintenance logistics in low-gravity environments.",
      authorId: "crew-system",
      createdAt: "2026-05-28T12:00:00.000Z",
      upvotes: 428,
      downvotes: 18,
      comments: ["Anon: Lunar regolith dust control is underestimated in many public discussions.", "Anon: Reliable water recycling and redundancy will be mission critical."],
      savedByMe: false,
      seenByMe: false
    },
    {
      id: 6,
      tag: "Space",
      title: "Which telescope era do you think will define the next 20 years?",
      body: "Compare near-term impact of JWST follow-ups, Roman Space Telescope surveys, and upcoming ground observatories in multi-messenger astronomy.",
      authorId: "crew-system",
      createdAt: "2026-05-27T15:30:00.000Z",
      upvotes: 541,
      downvotes: 44,
      comments: ["Anon: Roman's wide-field surveys could unlock major cosmology insights.", "Anon: Ground-based spectroscopy will remain essential for interpretation."],
      savedByMe: false,
      seenByMe: false
    },
    {
      id: 101,
      tag: "Science",
      title: "What is the actual resolution of the human eye?",
      body: "Framed differently: if the eye were a camera sensor, how many megapixels would it have, and what are the constraints that make this question tricky to answer cleanly?",
      authorId: "crew-system",
      createdAt: "2026-05-30T08:20:00.000Z",
      upvotes: 812,
      downvotes: 36,
      comments: new Array(14).fill("Crew note"),
      savedByMe: false,
      seenByMe: false
    },
    {
      id: 102,
      tag: "Tech",
      title: "Is local-first software a viable answer to cloud lock-in?",
      body: "Break down the tradeoffs: offline capability, sync complexity, and the business model problem that makes local-first hard to sustain commercially.",
      authorId: "crew-system",
      createdAt: "2026-05-30T07:40:00.000Z",
      upvotes: 876,
      downvotes: 412,
      comments: new Array(61).fill("Crew note"),
      savedByMe: false,
      seenByMe: false
    },
    {
      id: 103,
      tag: "Discussion",
      title: "Which piece of infrastructure do you think is most underappreciated?",
      body: "Think beyond roads and power: container shipping, undersea cables, sewage systems, or something less obvious. What would collapse first if it failed?",
      authorId: "crew-system",
      createdAt: "2026-05-30T06:50:00.000Z",
      upvotes: 578,
      downvotes: 24,
      comments: new Array(22).fill("Crew note"),
      savedByMe: false,
      seenByMe: false
    },
    {
      id: 104,
      tag: "Space",
      title: "How do orbital debris removal missions actually work in practice?",
      body: "Explain the capture mechanisms being tested, the legal questions around touching another country's satellite debris, and the timescale problem.",
      authorId: "crew-system",
      createdAt: "2026-05-30T06:10:00.000Z",
      upvotes: 491,
      downvotes: 11,
      comments: new Array(7).fill("Crew note"),
      savedByMe: false,
      seenByMe: false
    },
    {
      id: 105,
      tag: "Science",
      title: "Why does muscle memory feel different from learned knowledge?",
      body: "Dig into procedural vs declarative memory, the cerebellum's role, and why you can still ride a bike after decades but forget a phone number overnight.",
      authorId: "crew-system",
      createdAt: "2026-05-30T05:30:00.000Z",
      upvotes: 403,
      downvotes: 9,
      comments: new Array(11).fill("Crew note"),
      savedByMe: false,
      seenByMe: false
    },
    {
      id: 106,
      tag: "Tech",
      title: "What makes type systems actually useful versus just overhead?",
      body: "Compare dynamic and static typing in real production contexts: where types catch bugs versus where they just move the friction.",
      authorId: "crew-system",
      createdAt: "2026-05-30T04:45:00.000Z",
      upvotes: 612,
      downvotes: 603,
      comments: new Array(79).fill("Crew note"),
      savedByMe: false,
      seenByMe: false
    }
  ]
};

const API_BASE = (queryParams.get("api") || window.DC_API_BASE || "http://localhost:4000").replace(/\/$/, "");
const CURRENT_USER_ID = authedCrewId;
const realtimeState = {
  source: null,
  connected: false
};
const sessionState = {
  session: null,
  objectives: [],
  streak: 0
};

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-user-id": CURRENT_USER_ID,
      "x-display-name": authedCrewName,
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "API request failed");
  return data;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function startRealtimeStream() {
  if (!("EventSource" in window) || realtimeState.source) return;
  const source = new EventSource(`${API_BASE}/api/realtime?user=${encodeURIComponent(CURRENT_USER_ID)}`);
  realtimeState.source = source;
  source.onmessage = (event) => {
    try {
      handleRealtimeEvent(JSON.parse(event.data));
    } catch (error) {
      console.warn("Realtime event parse failed:", error.message);
    }
  };
  source.onerror = () => {
    realtimeState.connected = false;
    updateRealtimeBadges();
  };
}

function handleRealtimeEvent(message) {
  if (!message || !message.type) return;
  realtimeState.connected = message.type === "connected" ? true : realtimeState.connected;
  const payload = message.payload || {};

  if (message.type === "post_created" && payload.post) {
    const post = normalizePost(payload.post);
    if (!getPostById(post.id)) postStore.posts.unshift(post);
    refreshPostViews();
  } else if (message.type === "post_deleted" && payload.postId) {
    deletePostFromStore(payload.postId);
    refreshPostViews();
  } else if (message.type === "vote_changed" && payload.postId) {
    const post = getPostById(payload.postId);
    if (post) {
      post.upvotes = payload.upvotes;
      post.downvotes = payload.downvotes;
      refreshPostViews();
    }
  } else if (message.type === "comment_created" && payload.postId) {
    const post = getPostById(payload.postId);
    if (post) {
      post.commentCount = getPostCommentCount(post) + 1;
      post.commentsLoaded = false;
      refreshPostViews();
    }
  } else if (message.type.startsWith("friend_")) {
    if (document.getElementById("friends-list-container")) loadFriendsHub();
  } else if (message.type === "dm_message_created") {
    if (document.getElementById("friends-list-container")) loadDmThreads();
  } else if (message.type === "objective_updated") {
    loadSessionState();
  }

  updateRealtimeBadges();
}

function updateRealtimeBadges() {
  document.querySelectorAll("[data-realtime-badge]").forEach((badge) => {
    badge.textContent = realtimeState.connected ? "Live" : "Offline";
    badge.classList.toggle("offline", !realtimeState.connected);
  });
}

async function loadSessionState() {
  try {
    const data = await apiRequest("/api/session/active");
    if (!data.objectives || data.objectives.length === 0) {
      Object.assign(sessionState, await apiRequest("/api/session/start", { method: "POST" }));
    } else {
      Object.assign(sessionState, data);
    }
    renderObjectivePanel();
  } catch (error) {
    console.warn("Session objective sync failed:", error.message);
  }
}

function getObjectiveProgress() {
  const total = sessionState.objectives.length;
  const done = sessionState.objectives.filter((objective) => objective.completed).length;
  return { done, total };
}

function renderObjectivePanel() {
  const list = document.getElementById("daily-objective-list");
  const summary = document.getElementById("daily-objective-summary");
  if (!list || !summary) return;
  const progress = getObjectiveProgress();
  summary.textContent = `${progress.done}/${progress.total} complete | ${sessionState.streak || 0} day streak`;
  list.innerHTML = sessionState.objectives.map((objective) => {
    const current = Math.min(objective.current_count, objective.target_count);
    return `
      <div class="objective-item ${objective.completed ? "done" : ""}">
        <span class="state-badge">${objective.completed ? "Done" : `${current}/${objective.target_count}`}</span>
        <p>${objective.title}</p>
      </div>
    `;
  }).join("");
}

async function endCurrentSession() {
  await loadSessionState();
  const progress = getObjectiveProgress();
  if (progress.total && progress.done < progress.total) {
    const proceed = window.confirm(`Daily Objectives: ${progress.done}/${progress.total} complete. End session anyway?`);
    if (!proceed) return;
  }
  try {
    await apiRequest("/api/session/end", { method: "POST" });
    await loadSessionState();
  } catch (error) {
    console.warn("Session end failed:", error.message);
  }
}

function normalizePost(rawPost) {
  const comments = Array.isArray(rawPost.comments) ? rawPost.comments : [];
  return {
    id: rawPost.id || postStore.nextId++,
    tag: rawPost.tag || "Space",
    title: rawPost.title || "(Untitled transmission)",
    body: rawPost.body || rawPost.detail || "",
    authorId: rawPost.authorId || "crew-local",
    authorName: rawPost.authorName || rawPost.authorId || "Crewmate",
    createdAt: rawPost.createdAt || new Date().toISOString(),
    upvotes: rawPost.upvotes || rawPost.likes || 0,
    downvotes: rawPost.downvotes || 0,
    comments,
    commentCount: Number.isFinite(rawPost.commentCount) ? rawPost.commentCount : comments.length,
    commentsLoaded: Array.isArray(rawPost.comments),
    savedByMe: Boolean(rawPost.savedByMe),
    seenByMe: Boolean(rawPost.seenByMe),
    canDelete: Boolean(rawPost.canDelete)
  };
}

function normalizePostsResponse(data) {
  return Array.isArray(data.posts) ? data.posts : [];
}

function replacePostsFromBackend(posts) {
  if (!Array.isArray(posts)) return;
  postStore.posts = posts.map(normalizePost);
  postStore.backendReady = true;
  cafeteriaState.shuffleOrder = null;
  if (!getPostById(cafeteriaState.selectedPostId)) cafeteriaState.selectedPostId = postStore.posts[0]?.id || null;
  if (!getPostById(o2State.selectedPostId)) o2State.selectedPostId = null;
  if (!getPostById(weaponsState.selectedPostId)) weaponsState.selectedPostId = null;
  if (!getPostById(storageState.selectedPostId)) storageState.selectedPostId = null;
  refreshPostViews();
}

async function loadPostsFromBackend() {
  if (postStore.isLoading) return;
  postStore.isLoading = true;
  try {
    const data = await apiRequest("/api/posts?feed=new&limit=100");
    replacePostsFromBackend(data.posts);
  } catch (error) {
    console.warn("Using local placeholder posts:", error.message);
  } finally {
    postStore.isLoading = false;
  }
}

async function loadPostsForFeed(feed, extraParams = {}) {
  const params = new URLSearchParams({ feed, limit: "100" });
  Object.entries(extraParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") params.set(key, value);
  });
  const data = await apiRequest(`/api/posts?${params}`);
  replacePostsFromBackend(normalizePostsResponse(data));
}

startRealtimeStream();
loadSessionState();

function refreshPostViews() {
  renderCafeteriaFeed();
  renderCafeteriaDetail();
  renderO2Feed();
  renderO2Detail();
  updateO2UnseenCount();
  renderWeaponsFeed();
  renderWeaponsDetail();
  renderStorageSavedList();
  renderStorageDetail();
  updateStorageSavedCount();
}

function getAllPosts() {
  return postStore.posts;
}

function getPostById(postId) {
  return postStore.posts.find(post => post.id === postId) || null;
}

function getPostCommentCount(post) {
  return Number.isFinite(post.commentCount) ? post.commentCount : (Array.isArray(post.comments) ? post.comments.length : 0);
}

function getPostScore(post) {
  return post.upvotes;
}

function getPostScoreLabel(post) {
  const score = getPostScore(post);
  return `${score} like${Math.abs(score) === 1 ? "" : "s"}`;
}

function createPost(rawPost) {
  const post = normalizePost(rawPost);
  postStore.posts.unshift(post);
  return post;
}

async function createPostOnBackend(rawPost) {
  const data = await apiRequest("/api/posts", {
    method: "POST",
    body: JSON.stringify({
      title: rawPost.title,
      body: rawPost.body,
      tag: rawPost.tag,
      roomId: rawPost.roomId || "electrical"
    })
  });
  return normalizePost(data.post);
}

function loadCommentsForPost(postId) {
  const post = getPostById(postId);
  if (!post || post.commentsLoaded) return;
  apiRequest(`/api/posts/${encodeURIComponent(postId)}/comments`)
    .then(data => {
      const currentPost = getPostById(postId);
      if (!currentPost || !Array.isArray(data.comments)) return;
      currentPost.comments = data.comments.map(comment => `${comment.authorName}: ${comment.content}`);
      currentPost.commentCount = currentPost.comments.length;
      currentPost.commentsLoaded = true;
      renderCafeteriaDetail();
    })
    .catch(error => console.warn("Comment load failed:", error.message));
}

function voteOnPost(postId, direction) {
  const post = getPostById(postId);
  if (!post) return null;
  if (direction === "up") post.upvotes++;
  else {
    post.downvotes++;
    post.upvotes--;
  }
  return post;
}

function syncVoteToBackend(postId, direction) {
  apiRequest(`/api/posts/${encodeURIComponent(postId)}/vote`, {
    method: "POST",
    body: JSON.stringify({ type: direction })
  }).then(data => {
    const post = getPostById(postId);
    if (!post) return;
    post.upvotes = data.upvotes;
    post.downvotes = data.downvotes;
    refreshPostViews();
  }).catch(error => console.warn("Vote sync failed:", error.message));
}

function deletePostFromStore(postId) {
  postStore.posts = postStore.posts.filter(post => post.id !== postId);
  cafeteriaState.shuffleOrder = null;
  if (cafeteriaState.selectedPostId === postId) cafeteriaState.selectedPostId = getCafeteriaPosts()[0]?.id || null;
  if (o2State.selectedPostId === postId) o2State.selectedPostId = null;
  if (weaponsState.selectedPostId === postId) weaponsState.selectedPostId = null;
  if (storageState.selectedPostId === postId) storageState.selectedPostId = null;
}

function deletePostOnBackend(postId) {
  return apiRequest(`/api/posts/${encodeURIComponent(postId)}`, { method: "DELETE" });
}

function getSelectedPostIdBySurface(surface) {
  if (surface === "cafeteria") return cafeteriaState.selectedPostId;
  if (surface === "o2") return o2State.selectedPostId;
  if (surface === "weapons") return weaponsState.selectedPostId;
  if (surface === "storage") return storageState.selectedPostId;
  return null;
}

function deleteActivePost(surface) {
  const postId = getSelectedPostIdBySurface(surface);
  const post = getPostById(postId);
  if (!post) return;

  deletePostOnBackend(postId)
    .then(() => {
      deletePostFromStore(postId);
      refreshPostViews();
    })
    .catch(error => {
      console.warn("Delete sync failed:", error.message);
      loadPostsFromBackend();
    });
}

function updateDeleteButton(buttonId, post) {
  const button = document.getElementById(buttonId);
  if (!button) return;
  button.style.display = post && post.canDelete ? "inline-flex" : "none";
}

function savePost(postId) {
  const post = getPostById(postId);
  if (!post) return false;
  post.savedByMe = true;
  apiRequest(`/api/posts/${encodeURIComponent(postId)}/save`, { method: "POST" })
    .catch(error => console.warn("Save sync failed:", error.message));
  return true;
}

function unsavePost(postId) {
  const post = getPostById(postId);
  if (!post) return false;
  post.savedByMe = false;
  apiRequest(`/api/posts/${encodeURIComponent(postId)}/save`, { method: "DELETE" })
    .catch(error => console.warn("Unsave sync failed:", error.message));
  return true;
}

function getSavedPosts() {
  return postStore.posts.filter(post => post.savedByMe);
}

const cafeteriaState = {
  selectedPostId: null,
  visibleCount: 3,
  carouselStart: 0,
  shuffleOrder: null
};

function initCafeteriaBoard() {
  cafeteriaState.shuffleOrder = null;
  const posts = getCafeteriaPosts();
  cafeteriaState.visibleCount = 3;
  cafeteriaState.carouselStart = 0;
  cafeteriaState.selectedPostId = posts[0] ? posts[0].id : null;
  renderCafeteriaFeed();
  renderCafeteriaDetail();
  loadPostsForFeed("top").catch(() => loadPostsFromBackend());
}

function getCafeteriaPosts() {
  if (cafeteriaState.shuffleOrder) {
    return cafeteriaState.shuffleOrder
      .map(postId => getPostById(postId))
      .filter(Boolean);
  }
  return [...getAllPosts()].sort((a, b) => getPostScore(b) - getPostScore(a));
}

function renderCafeteriaFeed() {
  const feedEl = document.getElementById('cafeteria-feed-list');
  if (!feedEl) return;

  feedEl.innerHTML = '';
  const posts = getCafeteriaPosts();
  const endIndex = cafeteriaState.carouselStart + cafeteriaState.visibleCount;
  posts.slice(cafeteriaState.carouselStart, endIndex).forEach((post) => {
    const item = document.createElement('article');
    item.className = 'cafeteria-feed-item';
    if (post.id === cafeteriaState.selectedPostId) item.classList.add('selected');
    item.onclick = () => selectCafeteriaPost(post.id);

    item.innerHTML = `
      <p class="cafeteria-meta">${post.tag} | ${getPostScoreLabel(post)}</p>
      <p>${post.title}</p>
    `;
    feedEl.appendChild(item);
  });
}

function renderCafeteriaDetail() {
  const detailEl = document.getElementById('cafeteria-thread-detail');
  const metaEl = document.getElementById('cafeteria-selected-meta');
  if (!detailEl || !metaEl) return;

  const post = getPostById(cafeteriaState.selectedPostId);
  if (!post) {
    updateDeleteButton("cafeteria-delete-post-btn", null);
    return;
  }

  metaEl.textContent = `Selected: ${getPostScoreLabel(post)} | ${getPostCommentCount(post)} comments | ${post.authorName}`;
  updateDeleteButton("cafeteria-delete-post-btn", post);
  detailEl.innerHTML = `
    <div class="cafeteria-thread-card">
      <p class="cafeteria-section-label">Post</p>
      <p><strong>${post.title}</strong></p>
      <p style="margin-top:8px;">${post.body}</p>
    </div>
    <div class="cafeteria-comment-list">
      <p class="cafeteria-section-label">Comments</p>
      ${post.comments.length > 0
        ? post.comments.map((comment) => `<div class="cafeteria-comment-item"><p>${comment}</p></div>`).join('')
        : `<div class="cafeteria-comment-item"><p>${getPostCommentCount(post) > 0 ? "Loading comments..." : "No comments yet."}</p></div>`}
    </div>
  `;
}

function selectCafeteriaPost(postId) {
  cafeteriaState.selectedPostId = postId;
  renderCafeteriaFeed();
  renderCafeteriaDetail();
  loadCommentsForPost(postId);

  const threadSection = document.getElementById('cafeteria-thread-section');
  if (threadSection) {
    threadSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function voteOnCafeteriaPost(direction) {
  voteOnPost(cafeteriaState.selectedPostId, direction);
  syncVoteToBackend(cafeteriaState.selectedPostId, direction);
  cafeteriaState.shuffleOrder = null;
  renderCafeteriaFeed();
  renderCafeteriaDetail();
}

function addCafeteriaComment() {
  const inputEl = document.getElementById('cafeteria-comment-input');
  const post = getPostById(cafeteriaState.selectedPostId);
  if (!inputEl || !post) return;

  const text = inputEl.value.trim();
  if (!text) return;
  const previousCommentCount = getPostCommentCount(post);
  post.comments.push(`Anon: ${text}`);
  post.commentCount = previousCommentCount + 1;
  inputEl.value = '';
  renderCafeteriaDetail();
  apiRequest(`/api/posts/${encodeURIComponent(post.id)}/comments`, {
    method: "POST",
    body: JSON.stringify({ content: text })
  }).then(data => {
    const syncedPost = getPostById(post.id);
    if (!syncedPost || !data.comment) return;
    syncedPost.comments[syncedPost.comments.length - 1] = `${data.comment.authorName}: ${data.comment.content}`;
    renderCafeteriaDetail();
  }).catch(error => console.warn("Comment sync failed:", error.message));
}

function shuffleCafeteriaFeed() {
  cafeteriaState.shuffleOrder = [...getAllPosts()]
    .sort(() => Math.random() - 0.5)
    .map(post => post.id);
  cafeteriaState.carouselStart = 0;
  renderCafeteriaFeed();
}

function moveCafeteriaCarousel(direction) {
  const maxStart = Math.max(0, getAllPosts().length - cafeteriaState.visibleCount);
  let nextStart = cafeteriaState.carouselStart + (direction * cafeteriaState.visibleCount);

  if (nextStart < 0) nextStart = 0;
  if (nextStart > maxStart) nextStart = maxStart;

  cafeteriaState.carouselStart = nextStart;
  renderCafeteriaFeed();
}

const medbayState = {
  activeRange: "day",
  data: null,
  isLoading: false,
  error: ""
};

function initMedbayAnalytics() {
  loadMedbayAnalytics();
}

function setMedbayRange(range) {
  if (!["day", "week", "month"].includes(range)) return;
  medbayState.activeRange = range;
  loadMedbayAnalytics();
}

function getEmptyMedbayAnalytics() {
  return {
    focus: 0,
    stats: [
      { label: "Usage Time", value: "0m", trend: "0 sessions" },
      { label: "Posts Viewed", value: "0", trend: "0 comments made" },
      { label: "Messages", value: "0", trend: "0 friends" },
      { label: "Saved/Votes", value: "0", trend: "0 posts created" }
    ],
    zones: [{ name: "No activity yet", percent: 0, color: "#6c757d" }],
    signals: [
      { label: "Objective Completion", value: "0%", percent: 0 },
      { label: "Reply Activity", value: "Quiet", percent: 0 },
      { label: "Explore Balance", value: "Narrow", percent: 0 },
      { label: "Creation Health", value: "Reading", percent: 0 }
    ],
    notes: [medbayState.error || "MedBay analytics are waiting for backend activity."]
  };
}

function loadMedbayAnalytics() {
  medbayState.isLoading = true;
  renderMedbayAnalytics();
  apiRequest(`/api/users/me/analytics?range=${encodeURIComponent(medbayState.activeRange)}`)
    .then((data) => {
      medbayState.data = data.analytics || null;
      medbayState.error = "";
    })
    .catch((error) => {
      medbayState.data = null;
      medbayState.error = `Could not load backend analytics: ${error.message}`;
    })
    .finally(() => {
      medbayState.isLoading = false;
      renderMedbayAnalytics();
    });
}

function renderMedbayAnalytics() {
  const data = medbayState.data || getEmptyMedbayAnalytics();
  const score = document.getElementById("medbay-focus-score");
  const statGrid = document.getElementById("medbay-stat-grid");
  const zoneList = document.getElementById("medbay-zone-list");
  const signalList = document.getElementById("medbay-signal-list");
  const noteList = document.getElementById("medbay-note-list");
  if (!data || !score || !statGrid || !zoneList || !signalList || !noteList) return;

  score.textContent = medbayState.isLoading ? "..." : data.focus;

  document.querySelectorAll(".medbay-tab").forEach((tab) => {
    tab.classList.toggle("selected", tab.dataset.range === medbayState.activeRange);
  });

  statGrid.innerHTML = data.stats
    .map((stat) => `<article class="medbay-stat-card"><p>${escapeHtml(stat.label)}</p><strong>${escapeHtml(stat.value)}</strong><span>${escapeHtml(stat.trend)}</span></article>`)
    .join("");

  zoneList.innerHTML = data.zones
    .map((zone) => `
      <div class="medbay-zone-item">
        <div><strong>${escapeHtml(zone.name)}</strong><span>${zone.percent}%</span></div>
        <div class="dynamic-progress-bar"><div class="dynamic-progress-fill" style="width:${zone.percent}%; background:${escapeHtml(zone.color)};"></div></div>
      </div>
    `)
    .join("");

  signalList.innerHTML = data.signals
    .map((signal) => `
      <div class="medbay-signal-item">
        <div><strong>${escapeHtml(signal.label)}</strong><span>${escapeHtml(signal.value)}</span></div>
        <div class="dynamic-progress-bar"><div class="dynamic-progress-fill" style="width:${signal.percent}%; background:#0f766e;"></div></div>
      </div>
    `)
    .join("");

  noteList.innerHTML = data.notes
    .map((note) => `<div class="medbay-note-item">${escapeHtml(note)}</div>`)
    .join("");
}


const commState = {
  selectedDmId: null,
  dms: [],
  alerts: []
};

function initCommunicationsHub() {
  commState.dms = [
    {
      id: 1,
      name: "Mission Control",
      unread: 2,
      messages: [
        { from: "Mission Control", text: "Daily check-in: confirm oxygen and power reserves." },
        { from: "You", text: "All stable. Sending updated readings in 10 minutes." },
        { from: "Mission Control", text: "Received. Keep thermal drift below target threshold." }
      ]
    },
    {
      id: 2,
      name: "Crewmate Blue",
      unread: 1,
      messages: [
        { from: "Crewmate Blue", text: "Can you review the sensor calibration notes?" },
        { from: "You", text: "Yes. I will annotate and send back before shift end." }
      ]
    },
    {
      id: 3,
      name: "Research Team",
      unread: 0,
      messages: [
        { from: "Research Team", text: "Sharing updated exoplanet spectroscopy reference set." },
        { from: "You", text: "Great. I will compare it with our prior model output." }
      ]
    }
  ];

  commState.alerts = [
    { id: 1, level: "Priority", text: "Solar weather watch: elevated activity expected in 6 hours." },
    { id: 2, level: "Info", text: "New telemetry packet from APOD integration completed." },
    { id: 3, level: "Reminder", text: "Navigation diagnostics window opens at 19:00 station time." }
  ];

  commState.selectedDmId = commState.dms[0].id;
  renderCommDmList();
  renderCommThread();
  renderCommAlerts();
}

function renderCommDmList() {
  const dmList = document.getElementById('comm-dm-list');
  if (!dmList) return;

  dmList.innerHTML = '';
  commState.dms.forEach((dm) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'comm-dm-item';
    if (dm.id === commState.selectedDmId) item.classList.add('selected');

    const unreadBadge = dm.unread > 0 ? `<span class="comm-unread">${dm.unread}</span>` : '';
    item.innerHTML = `<span>${dm.name}</span>${unreadBadge}`;
    item.onclick = () => selectCommDm(dm.id);
    dmList.appendChild(item);
  });
}

function selectCommDm(dmId) {
  commState.selectedDmId = dmId;
  const targetDm = commState.dms.find((dm) => dm.id === dmId);
  if (targetDm) targetDm.unread = 0;
  renderCommDmList();
  renderCommThread();
}

function renderCommThread() {
  const meta = document.getElementById('comm-thread-meta');
  const view = document.getElementById('comm-thread-view');
  if (!meta || !view) return;

  const dm = commState.dms.find((item) => item.id === commState.selectedDmId);
  if (!dm) {
    meta.textContent = 'Select a DM thread to view messages.';
    view.innerHTML = '<p>No thread selected.</p>';
    return;
  }

  meta.textContent = `${dm.name} | ${dm.messages.length} messages`;
  view.innerHTML = dm.messages
    .map((msg) => `<div class="comm-msg ${msg.from === 'You' ? 'sent' : 'recv'}"><p><strong>${msg.from}:</strong> ${msg.text}</p></div>`)
    .join('');
}

function addCommReply() {
  const input = document.getElementById('comm-compose-input');
  const dm = commState.dms.find((item) => item.id === commState.selectedDmId);
  if (!input || !dm) return;
  const text = input.value.trim();
  if (!text) return;
  dm.messages.push({ from: "You", text });
  input.value = '';
  renderCommThread();
}

function renderCommAlerts() {
  const list = document.getElementById('comm-alert-list');
  if (!list) return;

  list.innerHTML = '';
  commState.alerts.forEach((alert) => {
    const row = document.createElement('div');
    row.className = 'comm-alert-item';
    row.innerHTML = `<p><strong>${alert.level}:</strong> ${alert.text}</p>`;
    list.appendChild(row);
  });
}

const shieldsPrivacyState = {
  blockedUsers: ["MutedExample"]
};

function initNavigationHelpHub() {
  renderNavGuide();
  renderNavigationSupportList();
}

const navGuideState = {
  activeZone: 0,
  zones: [
    {
      name: "Cafeteria",
      icon: "☕",
      tagline: "The main social feed.",
      tips: [
        { heading: "Browse the Feed", body: "Posts are sorted by likes by default. Hit Shuffle to mix things up and find something unexpected." },
        { heading: "APOD Spotlight", body: "The top-left card pulls NASA's Astronomy Picture of the Day. Tap the link to open the full NASA page." },
        { heading: "Interact with Posts", body: "Select any post from the carousel to open it. You can upvote, downvote, and leave comments." },
        { heading: "Navigate the Carousel", body: "Use the arrow buttons to scroll through posts three at a time." }
      ]
    },
    {
      name: "Communications",
      icon: "💬",
      tagline: "Your inbox and direct messages.",
      tips: [
        { heading: "Reading DMs", body: "Select a thread from the left panel to open it. Unread counts clear automatically when you open a thread." },
        { heading: "Quick Reply", body: "Type in the reply box and hit Send Reply to add a message to the active thread." },
        { heading: "Alerts", body: "System alerts appear at the bottom — these include priority notices, reminders, and info updates." }
      ]
    },
    {
      name: "Admin",
      icon: "🪪",
      tagline: "Your profile and preferences.",
      tips: [
        { heading: "Change Your Suit Colour", body: "Pick any colour from the grid — your crewmate updates on the map in real time." },
        { heading: "Set a Display Name", body: "Type a name up to 18 characters. It shows in your profile pill and HUD badge." },
        { heading: "Status", body: "Set your crew status to On Duty, Exploring, Do Not Disturb, or Away." },
        { heading: "Save Your Profile", body: "Hit Save Profile to persist your name, status, and colour to this device." }
      ]
    },
    {
      name: "Shields",
      icon: "🛡️",
      tagline: "Privacy and protection controls.",
      tips: [
        { heading: "Privacy Mode", body: "Switch between Enabled, Friends Only, and Public to control who can see your profile." },
        { heading: "DM Permissions", body: "Limit who can message you — Crewmates Only, Followers, or Everyone." },
        { heading: "Block a Crew Member", body: "Enter their name in Block Controls and hit Block. They disappear from your view immediately." },
        { heading: "Protection Audit", body: "The audit panel grades your current settings and flags anything that could expose your account." }
      ]
    },
    {
      name: "MedBay",
      icon: "📊",
      tagline: "Your personal usage analytics.",
      tips: [
        { heading: "Focus Score", body: "A rolling score based on your session quality — how balanced and intentional your usage looks." },
        { heading: "Switch Time Ranges", body: "Toggle between Today, Week, and Month to see how your habits shift over time." },
        { heading: "Zone Usage", body: "See which zones you spend the most time in, with a proportional bar for each." },
        { heading: "Health Signals", body: "Scroll pace, reply speed, and explore balance are tracked as soft indicators of engagement quality." }
      ]
    },
    {
      name: "Reactor",
      icon: "⚡",
      tagline: "Site-wide system status.",
      tips: [
        { heading: "System Health", body: "Bars for API, Database, CDN, and Auth show current service status at a glance." },
        { heading: "Zone Activity", body: "See which zones are getting the most visits across all crew — updated each time you open this terminal." },
        { heading: "Event Log", body: "Recent system events are shown with OK or warning badges so you can see if anything needs attention." }
      ]
    },
    {
      name: "Security",
      icon: "🔒",
      tagline: "Reports and moderation.",
      tips: [
        { heading: "Submitting a Report", body: "Choose a report type, enter the crew name if relevant, and describe the issue. Hit Submit Report to queue it for review." },
        { heading: "Report Types", body: "You can report Harassment, Spam, Impersonation, a Bug, or anything else under Other." },
        { heading: "Moderation Log", body: "All open and resolved tickets are listed here. Open tickets are still under review — resolved ones are closed." }
      ]
    },
    {
      name: "O2",
      icon: "🌱",
      tagline: "Discover feed — things you haven't seen yet.",
      tips: [
        { heading: "What is Discover?", body: "O2 surfaces content you haven't interacted with yet — no repeats, no posts you've already liked or commented on." },
        { heading: "How it's Ranked", body: "Posts are ranked by a mix of recency and crew engagement, weighted away from your existing history so you always see something new." },
        { heading: "Why it's separate from Cafeteria", body: "Cafeteria shows the most popular content globally. O2 is personalised to show you what you've been missing." }
      ]
    },
    {
      name: "Weapons",
      icon: "🔥",
      tagline: "Trending topics across the station.",
      tips: [
        { heading: "What is Trending?", body: "Weapons tracks which topics and posts are gaining momentum right now across all crew activity." },
        { heading: "Sort Modes", body: "Switch between Top (highest engagement), Relevance (matched to your zone activity), Newest (chronological), and Controversial (high interaction, mixed votes)." },
        { heading: "Controversial Sort", body: "Controversial surfaces posts with roughly equal upvotes and downvotes — high engagement but split opinion. Use it to find active debates." },
        { heading: "How Trending Differs from Cafeteria", body: "Cafeteria is static top-by-likes. Weapons is dynamic — a post climbing fast will appear here before it tops the Cafeteria feed." }
      ]
    },
    {
      name: "Electrical",
      icon: "✏️",
      tagline: "Create and publish posts.",
      tips: [
        { heading: "Starting a Post", body: "Open Electrical and use the composer to write your post. Add a topic tag before submitting so it gets routed to the right feeds." },
        { heading: "Topic Tags", body: "Tags determine where your post appears — posts without tags may not surface in Discover or Trending." },
        { heading: "Encryption Topic", body: "The encryption topic field sets the heading for your transmission. Keep it short and descriptive." },
        { heading: "After Posting", body: "Your post enters the feed immediately. Head to Cafeteria to see it ranked, or Weapons to watch it trend if it picks up momentum." }
      ]
    },
    {
      name: "Moving Around",
      icon: "🗺️",
      tagline: "Getting around the station.",
      tips: [
        { heading: "WASD or Arrow Keys", body: "Move your crewmate around the map using WASD or the arrow keys." },
        { heading: "Entering a Zone", body: "Walk into a highlighted zone and press F when the prompt appears to open that zone's terminal." },
        { heading: "Fast Travel", body: "Open the map button in the top-right corner and tap any named zone to warp there instantly." },
        { heading: "Closing a Terminal", body: "Press F again or tap the close button on the tablet to return to the map." }
      ]
    }
  ]
};

function renderNavGuide() {
  const tabsEl = document.getElementById("navhelp-tip-tabs");
  const contentEl = document.getElementById("navhelp-tip-content");
  if (!tabsEl || !contentEl) return;

  tabsEl.innerHTML = navGuideState.zones.map((zone, i) => `
    <button class="navhelp-tab-btn ${i === navGuideState.activeZone ? "selected" : ""}" type="button" onclick="selectNavGuideZone(${i})">
      ${zone.icon} ${zone.name}
    </button>
  `).join("");

  renderNavGuideContent();
}

function selectNavGuideZone(index) {
  navGuideState.activeZone = index;
  renderNavGuide();
}

function renderNavGuideContent() {
  const contentEl = document.getElementById("navhelp-tip-content");
  if (!contentEl) return;

  const zone = navGuideState.zones[navGuideState.activeZone];
  contentEl.innerHTML = `
    <div class="navhelp-zone-header">
      <span class="navhelp-zone-icon">${zone.icon}</span>
      <div>
        <p class="navhelp-zone-name">${zone.name}</p>
        <p class="navhelp-zone-tagline">${zone.tagline}</p>
      </div>
    </div>
    <div class="navhelp-tips-grid">
      ${zone.tips.map((tip, i) => `
        <div class="navhelp-tip-card">
          <span class="navhelp-tip-num">${String(i + 1).padStart(2, "0")}</span>
          <div>
            <strong>${tip.heading}</strong>
            <p>${tip.body}</p>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderNavigationSupportList() {
  const list = document.getElementById("nav-support-list");
  if (!list) return;

  list.innerHTML = [
    "<strong>Map Sync:</strong><br>All zone markers online.",
    "<strong>Reports and Moderation:</strong><br>Head to Security to submit a report or check the mod log.",
    "<strong>Privacy Controls:</strong><br>Head to Shields for visibility, DM permissions, blocks, and filters."
  ].map((item) => `<div class="navhelp-item">${item}</div>`).join("");
}

function initShieldsPrivacyHub() {
  updateShieldPrivacySummary();
  renderShieldBlockedUsersList();
  renderShieldAuditList();
}

function updateShieldPrivacySummary() {
  const privacy = document.getElementById("shield-privacy");
  const dm = document.getElementById("shield-dm");
  const filter = document.getElementById("shield-filter");
  const online = document.getElementById("shield-online-toggle");
  const activity = document.getElementById("shield-activity-toggle");
  const alerts = document.getElementById("shield-alert-toggle");
  const privacySummary = document.getElementById("shield-privacy-summary");
  const visibilitySummary = document.getElementById("shield-visibility-summary");
  const score = document.getElementById("shields-score-value");
  if (!privacy || !dm || !filter || !online || !activity || !alerts || !privacySummary || !visibilitySummary) return;

  privacySummary.textContent = `${privacy.value} | ${dm.value} | ${filter.value}`;
  visibilitySummary.textContent = `${online.checked ? "Presence on" : "Presence hidden"} | ${activity.checked ? "Activity shared" : "Activity private"} | ${alerts.checked ? "Alerts on" : "Alerts muted"}`;

  let rating = 70;
  if (privacy.value !== "Public") rating += 8;
  if (dm.value !== "Everyone") rating += 7;
  if (filter.value !== "Relaxed") rating += 5;
  if (!online.checked) rating += 4;
  if (!activity.checked) rating += 4;
  if (alerts.checked) rating += 2;
  if (score) score.textContent = `${Math.min(rating, 100)}%`;
  renderShieldAuditList();
}

function renderShieldBlockedUsersList() {
  const list = document.getElementById("shield-blocked-users-list");
  if (!list) return;

  if (shieldsPrivacyState.blockedUsers.length === 0) {
    list.innerHTML = `<div class="shields-item">No blocked users.</div>`;
    return;
  }

  list.innerHTML = shieldsPrivacyState.blockedUsers
    .map((user) => `<div class="shields-item"><strong>${user}</strong> is blocked.</div>`)
    .join("");
}

function blockUserFromShields() {
  const input = document.getElementById("shield-block-user-input");
  if (!input) return;
  const user = input.value.trim();
  if (!user) return;

  if (!shieldsPrivacyState.blockedUsers.includes(user)) {
    shieldsPrivacyState.blockedUsers.push(user);
  }
  input.value = "";
  renderShieldBlockedUsersList();
  renderShieldAuditList();
}

function unblockUserFromShields() {
  const input = document.getElementById("shield-block-user-input");
  if (!input) return;
  const user = input.value.trim();
  if (!user) return;

  shieldsPrivacyState.blockedUsers = shieldsPrivacyState.blockedUsers.filter((name) => name.toLowerCase() !== user.toLowerCase());
  input.value = "";
  renderShieldBlockedUsersList();
  renderShieldAuditList();
}

function renderShieldAuditList() {
  const list = document.getElementById("shield-audit-list");
  if (!list) return;

  const privacy = document.getElementById("shield-privacy");
  const dm = document.getElementById("shield-dm");
  const filter = document.getElementById("shield-filter");
  const online = document.getElementById("shield-online-toggle");
  const activity = document.getElementById("shield-activity-toggle");

  const items = [
    { label: privacy && privacy.value === "Public" ? "Profile is publicly visible" : "Profile visibility protected", done: !privacy || privacy.value !== "Public" },
    { label: dm && dm.value === "Everyone" ? "DMs open to everyone" : "DMs limited to trusted crew", done: !dm || dm.value !== "Everyone" },
    { label: filter && filter.value === "Relaxed" ? "Content filter relaxed" : "Content filter active", done: !filter || filter.value !== "Relaxed" },
    { label: online && online.checked ? "Online presence visible" : "Online presence hidden", done: !online || !online.checked },
    { label: activity && activity.checked ? "Zone activity shared" : "Zone activity private", done: !activity || !activity.checked },
    { label: `${shieldsPrivacyState.blockedUsers.length} blocked crew record${shieldsPrivacyState.blockedUsers.length === 1 ? "" : "s"}`, done: shieldsPrivacyState.blockedUsers.length > 0 }
  ];

  list.innerHTML = items
    .map((item) => `<div class="shields-audit-item ${item.done ? "done" : ""}"><span>${item.done ? "OK" : "!"}</span><p>${item.label}</p></div>`)
    .join("");
}

const adminColorOptions = [
  { name: "Cyan", hex: "#00ffff", ink: "#1d2a3b" },
  { name: "Red", hex: "#ef3340", ink: "#ffffff" },
  { name: "Blue", hex: "#1d3557", ink: "#ffffff" },
  { name: "Purple", hex: "#8338ec", ink: "#ffffff" },
  { name: "Brown", hex: "#704214", ink: "#ffffff" },
  { name: "Grey", hex: "#6c757d", ink: "#ffffff" },
  { name: "Pink", hex: "#ffc0cb", ink: "#1d2a3b" }
];

const adminState = {
  displayName: authedCrewName,
  status: "On Duty",
  profileSaved: false,
  crewmates: {
    following: [],
    followers: [],
    suggestions: []
  }
};

function initAdminProfileHub() {
  const savedProfile = readAdminProfileFromStorage();
  if (savedProfile) {
    adminState.displayName = savedProfile.displayName || adminState.displayName;
    adminState.status = savedProfile.status || adminState.status;
    if (Number.isInteger(savedProfile.colorIndex)) {
      setCrewmateColor(savedProfile.colorIndex);
    }
  }

  const nameInput = document.getElementById("admin-display-name");
  const statusSelect = document.getElementById("admin-status-select");
  if (nameInput) {
    nameInput.value = adminState.displayName;
    nameInput.addEventListener("input", updateAdminProfilePreview);
  }
  if (statusSelect) statusSelect.value = adminState.status;

  updateAdminProfilePreview();
  updateAdminPreferencesSummary();
  updateAdminColorSelection();
  renderAdminChecklist();
  loadAdminCrewmates();
}

function readAdminProfileFromStorage() {
  try {
    const raw = window.localStorage.getItem("dc_admin_profile");
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function setAdminCrewmateColor(index) {
  setCrewmateColor(index);
  renderAdminChecklist();
}

function updateAdminColorSelection() {
  const color = adminColorOptions[currentCrewmateColorIndex] || adminColorOptions[0];
  const summary = document.getElementById("admin-color-summary");
  const chip = document.getElementById("admin-avatar-chip");
  const buttons = document.querySelectorAll(".admin-color-grid .color-picker-btn");

  if (summary) summary.textContent = `Current: ${color.name}`;
  if (chip) {
    chip.style.background = color.hex;
    chip.style.color = color.ink;
  }

  buttons.forEach((button) => {
    const isSelected = Number(button.dataset.colorIndex) === currentCrewmateColorIndex;
    button.classList.toggle("selected", isSelected);
  });
}

function updateAdminProfilePreview() {
  const nameInput = document.getElementById("admin-display-name");
  const statusSelect = document.getElementById("admin-status-select");
  const profileName = document.getElementById("admin-profile-name");
  const chip = document.getElementById("admin-avatar-chip");

  const displayName = nameInput && nameInput.value.trim() ? nameInput.value.trim() : "Crewmate";
  adminState.displayName = displayName;
  adminState.status = statusSelect ? statusSelect.value : adminState.status;

  if (profileName) profileName.textContent = `${displayName} | ${adminState.status}`;
  if (chip) chip.textContent = displayName.charAt(0).toUpperCase();
  renderAdminChecklist();
}

function updateAdminPreferencesSummary() {
  const homeZone = document.getElementById("admin-home-zone");
  const compact = document.getElementById("admin-compact-toggle");
  const motion = document.getElementById("admin-motion-toggle");
  const summary = document.getElementById("admin-preferences-summary");
  if (!homeZone || !compact || !motion || !summary) return;

  summary.textContent = `Home: ${homeZone.value} | ${compact.checked ? "Compact layout" : "Standard layout"} | ${motion.checked ? "Animations on" : "Animations off"}`;
}

function saveAdminProfileSettings() {
  const status = document.getElementById("admin-save-status");
  const profile = {
    displayName: adminState.displayName,
    status: adminState.status,
    colorIndex: currentCrewmateColorIndex
  };

  try {
    window.localStorage.setItem("dc_admin_profile", JSON.stringify(profile));
    adminState.profileSaved = true;
    if (status) {
      status.textContent = "Profile settings saved on this device.";
      status.style.color = "#0f766e";
    }
  } catch (e) {
    if (status) {
      status.textContent = "Could not save profile settings.";
      status.style.color = "#7f1d1d";
    }
  }

  renderAdminChecklist();
}

function renderAdminChecklist() {
  const list = document.getElementById("admin-checklist");
  if (!list) return;

  const color = adminColorOptions[currentCrewmateColorIndex] || adminColorOptions[0];
  const items = [
    { label: `Suit colour selected: ${color.name}`, done: true },
    { label: `Status set: ${adminState.status}`, done: true },
    { label: adminState.displayName !== "Crewmate" ? "Custom display name active" : "Default display name in use", done: adminState.displayName !== "Crewmate" },
    { label: adminState.profileSaved ? "Profile saved locally" : "Profile not saved yet", done: adminState.profileSaved }
  ];

  list.innerHTML = items
    .map((item) => `<div class="admin-check-item ${item.done ? "done" : ""}"><span>${item.done ? "OK" : "!"}</span><p>${item.label}</p></div>`)
    .join("");
}

function loadAdminCrewmates() {
  apiRequest("/api/users/me/crewmates")
    .then(data => {
      adminState.crewmates.following = data.following || [];
      adminState.crewmates.followers = data.followers || [];
      adminState.crewmates.suggestions = data.suggestions || [];
      if (
        adminState.crewmates.following.length === 0 &&
        adminState.crewmates.followers.length === 0 &&
        adminState.crewmates.suggestions.length === 0
      ) {
        adminState.crewmates.suggestions = getFallbackCrewmates();
      }
      renderAdminCrewmates();
    })
    .catch(error => {
      console.warn("Da Crewmates sync failed:", error.message);
      adminState.crewmates.suggestions = getFallbackCrewmates();
      renderAdminCrewmates("Could not load Da Crewmates from the API.");
    });
}

function getFallbackCrewmates() {
  return [
    { id: "cyan-crew", displayName: "Cyan", avatarColor: "cyan" },
    { id: "yellow-crew", displayName: "Yellow", avatarColor: "yellow" },
    { id: "purple-crew", displayName: "Purple", avatarColor: "purple" }
  ].filter((crewmate) => crewmate.id !== CURRENT_USER_ID);
}

function renderAdminCrewmates(errorMessage) {
  const summary = document.getElementById("admin-crewmates-summary");
  const followingList = document.getElementById("admin-following-list");
  const followersList = document.getElementById("admin-followers-list");
  const suggestionsList = document.getElementById("admin-suggestions-list");
  if (!summary || !followingList || !followersList || !suggestionsList) return;

  const { following, followers, suggestions } = adminState.crewmates;
  summary.textContent = errorMessage || `${following.length} following | ${followers.length} followed by`;
  followingList.innerHTML = renderCrewmateRows(following, "following");
  followersList.innerHTML = renderCrewmateRows(followers, "followers");
  suggestionsList.innerHTML = renderCrewmateRows(suggestions, "suggestions");
}

function renderCrewmateRows(crewmates, mode) {
  if (!crewmates || crewmates.length === 0) {
    return `<p class="admin-meta">No crewmates here yet.</p>`;
  }

  return crewmates.map(crewmate => {
    const initial = (crewmate.displayName || "C").charAt(0).toUpperCase();
    const color = crewmate.avatarColor || "cyan";
    const action = mode === "following"
      ? `<button class="dynamic-btn danger-btn" type="button" onclick="unfollowCrewmate('${crewmate.id}')">Remove</button>`
      : mode === "suggestions"
        ? `<button class="dynamic-btn" type="button" onclick="followCrewmate('${crewmate.id}')">Add</button>`
        : `<span>Follower</span>`;

    return `
      <div class="admin-crewmate-item">
        <div class="admin-crewmate-avatar" style="background:${color};"></div>
        <p><strong>${initial}</strong> ${crewmate.displayName}</p>
        ${action}
      </div>
    `;
  }).join("");
}

function followCrewmate(userId) {
  apiRequest(`/api/users/${encodeURIComponent(userId)}/follow`, { method: "POST" })
    .then(loadAdminCrewmates)
    .catch(error => console.warn("Follow failed:", error.message));
}

function unfollowCrewmate(userId) {
  apiRequest(`/api/users/${encodeURIComponent(userId)}/unfollow`, { method: "POST" })
    .then(loadAdminCrewmates)
    .catch(error => console.warn("Unfollow failed:", error.message));
}

const APOD_OFFLINE_IMAGE = "Assets/apod-fallback.svg";

async function loadCafeteriaApod() {
  const imageEl = document.getElementById('cafeteria-apod-image');
  const titleEl = document.getElementById('cafeteria-apod-title');
  const metaEl = document.getElementById('cafeteria-apod-meta');
  const linkEl = document.getElementById('cafeteria-apod-link');
  if (!imageEl || !titleEl || !metaEl || !linkEl) return;

  try {
    const payload = await apiRequest('/api/space/apod');
    const apod = payload && payload.data ? payload.data : null;
    applyApodToCard(apod, imageEl, titleEl, metaEl, linkEl);
    if (payload && payload.warning) {
      metaEl.textContent = apod && apod.source === "html"
        ? `NASA APOD | ${apod.date || "today"} | backup source`
        : payload.warning;
    }
  } catch (err) {
    applyApodToCard({
      title: "Station Nebula",
      date: "Offline APOD fallback",
      media_type: "image",
      url: APOD_OFFLINE_IMAGE,
      hdurl: "https://apod.nasa.gov/apod/astropix.html"
    }, imageEl, titleEl, metaEl, linkEl);
    metaEl.textContent = 'APOD API unavailable. Showing local station fallback.';
    console.error('APOD load error:', err);
  }
}

function applyApodToCard(apod, imageEl, titleEl, metaEl, linkEl) {
  if (!apod) return;

  titleEl.textContent = apod.title || 'Astronomy Picture of the Day';
  metaEl.textContent = apod.date ? `NASA APOD | ${apod.date}` : 'NASA APOD';

  const mediaUrl = apod.media_type === 'video' ? (apod.thumbnail_url || '') : (apod.url || '');
  if (mediaUrl) {
    imageEl.src = mediaUrl;
  }

  linkEl.href = apod.hdurl || apod.url || 'https://apod.nasa.gov/apod/astropix.html';
}

const friendsState = {
  activeTab: "friends",
  selected: null,
  data: {
    friends: [],
    incoming: [],
    outgoing: [],
    following: [],
    followers: [],
    suggestions: []
  },
  dmThreads: [],
  dmMessages: [],
  selectedThreadId: null,
  dmError: ""
};

function initFriendsHub() {
  friendsState.activeTab = friendsState.activeTab || "friends";
  friendsState.selected = null;
  renderFriendsHub();
  loadFriendsHub();
  loadDmThreads();
  loadSessionState();
}

function loadFriendsHub() {
  apiRequest("/api/friends/list")
    .then((data) => {
      friendsState.data = {
        friends: data.friends || [],
        incoming: data.incoming || [],
        outgoing: data.outgoing || [],
        following: data.following || [],
        followers: data.followers || [],
        suggestions: data.suggestions || []
      };
      renderFriendsHub();
    })
    .catch((error) => {
      const banner = document.getElementById("friends-error-banner");
      if (banner) {
        banner.textContent = `Crew network unavailable: ${error.message}`;
        banner.style.display = "block";
      }
    });
}

function switchFriendsTab(tab) {
  friendsState.activeTab = tab;
  friendsState.selected = null;
  renderFriendsHub();
  if (tab === "objectives") loadSessionState();
  if (tab === "messages") loadDmThreads();
}

function renderFriendsHub() {
  document.querySelectorAll(".friends-tab-btn").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === friendsState.activeTab);
  });
  const friendsBadge = document.getElementById("badge-friends");
  const requestsBadge = document.getElementById("badge-requests");
  const messagesBadge = document.getElementById("badge-messages");
  if (friendsBadge) friendsBadge.textContent = friendsState.data.friends.length;
  if (requestsBadge) requestsBadge.textContent = friendsState.data.incoming.length;
  if (messagesBadge) messagesBadge.textContent = friendsState.dmThreads.length;
  renderFriendsList();
  renderFriendsFooter();
  renderObjectivePanel();
}

function getActiveFriendRows() {
  if (friendsState.activeTab === "friends") return friendsState.data.friends.map((row) => ({ ...row, status: "Friend" }));
  if (friendsState.activeTab === "requests") {
    return [
      ...friendsState.data.incoming.map((row) => ({ ...row, status: "Incoming" })),
      ...friendsState.data.outgoing.map((row) => ({ ...row, status: "Outgoing" }))
    ];
  }
  if (friendsState.activeTab === "suggestions") return friendsState.data.suggestions.map((row) => ({ ...row, status: "Suggested" }));
  if (friendsState.activeTab === "following") return friendsState.data.following.map((row) => ({ ...row, status: "Following" }));
  if (friendsState.activeTab === "followers") return friendsState.data.followers.map((row) => ({ ...row, status: "Follower" }));
  return [];
}

function renderFriendsList() {
  const container = document.getElementById("friends-list-container");
  if (!container) return;
  if (friendsState.activeTab === "objectives") {
    container.innerHTML = `
      <div class="daily-objectives-panel">
        <div class="daily-objectives-header">
          <strong>Daily Objectives</strong>
          <span id="daily-objective-summary" class="state-badge">Loading</span>
        </div>
        <div id="daily-objective-list" class="daily-objective-list"></div>
        <button class="dynamic-btn danger-btn" type="button" onclick="endCurrentSession()">End Session</button>
      </div>
    `;
    renderObjectivePanel();
    return;
  }

  if (friendsState.activeTab === "messages") {
    const threads = friendsState.dmThreads;
    const selectedThread = threads.find((thread) => thread.id === friendsState.selectedThreadId);
    container.innerHTML = `
      <div class="dm-panel">
        <div class="dm-thread-list">
          ${friendsState.dmError ? `<p class="friends-error-banner">${escapeHtml(friendsState.dmError)}</p>` : ""}
          ${threads.length === 0 ? `<p class="friends-empty-msg">No DM threads yet. Select a friend and hit Message.</p>` : threads.map((thread) => {
            const selected = thread.id === friendsState.selectedThreadId;
            const other = thread.otherUser || {};
            const preview = thread.lastMessage ? thread.lastMessage.body : "No messages yet.";
            return `
              <button class="dm-thread-row ${selected ? "selected" : ""}" type="button" onclick="selectDmThread('${thread.id}')">
                <span class="friends-avatar" style="background:${escapeHtml(other.avatarColor || "cyan")};">${escapeHtml((other.displayName || "C").charAt(0).toUpperCase())}</span>
                <span><strong>${escapeHtml(other.displayName || other.id || "Crewmate")}</strong><small>${escapeHtml(preview)}</small></span>
              </button>
            `;
          }).join("")}
        </div>
        <div class="dm-thread-pane">
          <div class="dm-thread-meta">
            <strong>${selectedThread ? escapeHtml(selectedThread.otherUser?.displayName || "Crewmate") : "Select a thread"}</strong>
            <span>${selectedThread ? "Direct message" : "Messages are stored on the backend"}</span>
          </div>
          <div id="dm-message-list" class="dm-message-list">
            ${renderDmMessagesMarkup()}
          </div>
          <div class="dm-compose-row">
            <input id="dm-compose-input" class="dynamic-input" type="text" maxlength="1000" placeholder="${selectedThread ? "Write a message..." : "Select a thread first"}" ${selectedThread ? "" : "disabled"}>
            <button class="dynamic-btn" type="button" onclick="sendDmMessage()" ${selectedThread ? "" : "disabled"}>Send</button>
          </div>
        </div>
      </div>
    `;
    return;
  }

  const rows = getActiveFriendRows();
  if (rows.length === 0) {
    container.innerHTML = `<p class="friends-empty-msg">No crewmates in this panel.</p>`;
    return;
  }
  container.innerHTML = rows.map((crewmate) => {
    const selected = friendsState.selected && friendsState.selected.id === crewmate.id && friendsState.selected.status === crewmate.status;
    const initial = (crewmate.displayName || "C").charAt(0).toUpperCase();
    return `
      <button class="friends-row ${selected ? "selected" : ""}" type="button" onclick="selectFriendRow('${crewmate.id}', '${crewmate.status}', '${crewmate.requestId || ""}')">
        <span class="friends-avatar" style="background:${crewmate.avatarColor || "cyan"};">${initial}</span>
        <span><strong>${crewmate.displayName || crewmate.id}</strong><small>${crewmate.id}</small></span>
        <span class="state-badge">${crewmate.status}</span>
      </button>
    `;
  }).join("");
}

function selectFriendRow(id, status, requestId) {
  const row = getActiveFriendRows().find((item) => item.id === id && item.status === status);
  friendsState.selected = row ? { ...row, requestId } : null;
  renderFriendsHub();
}

function renderFriendsFooter() {
  const selectedName = document.getElementById("friends-selected-name");
  const selectedStatus = document.getElementById("friends-selected-status");
  const actions = document.getElementById("friends-footer-actions");
  if (!selectedName || !selectedStatus || !actions) return;
  const selected = friendsState.selected;
  selectedName.textContent = selected ? selected.displayName : "No crewmate selected";
  selectedStatus.textContent = selected ? selected.status : "";
  if (!selected) {
    actions.innerHTML = "";
    return;
  }
  if (selected.status === "Incoming") {
    actions.innerHTML = `
      <button class="dynamic-btn" type="button" onclick="acceptFriendRequest('${selected.requestId}')">Accept</button>
      <button class="dynamic-btn danger-btn" type="button" onclick="declineFriendRequest('${selected.requestId}')">Decline</button>
    `;
  } else if (selected.status === "Outgoing") {
    actions.innerHTML = `<button class="dynamic-btn danger-btn" type="button" onclick="cancelFriendRequest('${selected.requestId}')">Cancel</button>`;
  } else if (selected.status === "Suggested" || selected.status === "Follower") {
    actions.innerHTML = `<button class="dynamic-btn" type="button" onclick="sendFriendRequest('${selected.id}')">Add Friend</button>`;
  } else if (selected.status === "Friend") {
    actions.innerHTML = `
      <button class="dynamic-btn" type="button" onclick="openDmWithUser('${selected.id}')">Message</button>
      <button class="dynamic-btn danger-btn" type="button" onclick="removeFriend('${selected.id}')">Remove</button>
    `;
  } else {
    actions.innerHTML = "";
  }
}

function renderDmMessagesMarkup() {
  if (!friendsState.selectedThreadId) return `<p class="friends-empty-msg">Pick a DM thread from the left.</p>`;
  if (friendsState.dmMessages.length === 0) return `<p class="friends-empty-msg">No messages yet. Start the thread.</p>`;
  return friendsState.dmMessages.map((message) => `
    <div class="dm-message ${message.sentByMe ? "sent" : "received"}">
      <small>${escapeHtml(message.senderName || (message.sentByMe ? "You" : "Crewmate"))}</small>
      <p>${escapeHtml(message.body)}</p>
    </div>
  `).join("");
}

function loadDmThreads() {
  return apiRequest("/api/dm/threads")
    .then((data) => {
      friendsState.dmThreads = data.threads || [];
      friendsState.dmError = "";
      if (!friendsState.selectedThreadId && friendsState.dmThreads.length > 0) {
        friendsState.selectedThreadId = friendsState.dmThreads[0].id;
        return loadDmMessages(friendsState.selectedThreadId);
      }
      renderFriendsHub();
      return null;
    })
    .catch((error) => {
      friendsState.dmError = `Messages unavailable: ${error.message}`;
      renderFriendsHub();
    });
}

function openDmWithUser(receiverId) {
  apiRequest("/api/dm/threads", { method: "POST", body: JSON.stringify({ receiverId }) })
    .then((data) => {
      const thread = data.thread;
      if (thread && !friendsState.dmThreads.some((item) => item.id === thread.id)) {
        friendsState.dmThreads.unshift(thread);
      }
      friendsState.selectedThreadId = thread ? thread.id : friendsState.selectedThreadId;
      friendsState.activeTab = "messages";
      return loadDmMessages(friendsState.selectedThreadId);
    })
    .catch((error) => {
      friendsState.dmError = `Could not open DM: ${error.message}`;
      friendsState.activeTab = "messages";
      renderFriendsHub();
    });
}

function selectDmThread(threadId) {
  friendsState.selectedThreadId = threadId;
  loadDmMessages(threadId);
}

function loadDmMessages(threadId) {
  if (!threadId) {
    friendsState.dmMessages = [];
    renderFriendsHub();
    return Promise.resolve();
  }
  return apiRequest(`/api/dm/threads/${encodeURIComponent(threadId)}/messages`)
    .then((data) => {
      friendsState.dmMessages = data.messages || [];
      const updatedThread = data.thread;
      if (updatedThread) {
        const index = friendsState.dmThreads.findIndex((thread) => thread.id === updatedThread.id);
        if (index >= 0) friendsState.dmThreads[index] = updatedThread;
      }
      friendsState.dmError = "";
      renderFriendsHub();
    })
    .catch((error) => {
      friendsState.dmError = `Could not load thread: ${error.message}`;
      friendsState.dmMessages = [];
      renderFriendsHub();
    });
}

function sendDmMessage() {
  const input = document.getElementById("dm-compose-input");
  const threadId = friendsState.selectedThreadId;
  if (!input || !threadId) return;
  const body = input.value.trim();
  if (!body) return;
  input.disabled = true;
  apiRequest(`/api/dm/threads/${encodeURIComponent(threadId)}/messages`, {
    method: "POST",
    body: JSON.stringify({ body })
  })
    .then(() => {
      input.value = "";
      return loadDmMessages(threadId).then(loadDmThreads);
    })
    .catch((error) => {
      friendsState.dmError = `Could not send message: ${error.message}`;
      renderFriendsHub();
    })
    .finally(() => {
      input.disabled = false;
    });
}

function sendFriendRequest(receiverId) {
  apiRequest("/api/friends/request", { method: "POST", body: JSON.stringify({ receiverId }) }).then(loadFriendsHub).then(loadSessionState);
}

function acceptFriendRequest(requestId) {
  apiRequest("/api/friends/accept", { method: "POST", body: JSON.stringify({ requestId }) }).then(loadFriendsHub);
}

function declineFriendRequest(requestId) {
  apiRequest("/api/friends/decline", { method: "POST", body: JSON.stringify({ requestId }) }).then(loadFriendsHub);
}

function cancelFriendRequest(requestId) {
  apiRequest("/api/friends/cancel", { method: "POST", body: JSON.stringify({ requestId }) }).then(loadFriendsHub);
}

function removeFriend(friendId) {
  apiRequest("/api/friends/remove", { method: "POST", body: JSON.stringify({ friendId }) }).then(loadFriendsHub);
}



// =========================
// REACTOR HUB
// =========================

const reactorState = { data: null, error: "" };

function initReactorHub() {
  renderReactorHub();
  apiRequest("/api/system/reactor")
    .then((data) => {
      reactorState.data = data.reactor;
      reactorState.error = "";
      renderReactorHub();
    })
    .catch((error) => {
      reactorState.data = null;
      reactorState.error = `Reactor backend unavailable: ${error.message}`;
      renderReactorHub();
    });
}

function getReactorFallback() {
  return {
    status: reactorState.error || "Backend offline",
    visitorsToday: 0,
    activeSessions: 0,
    totalUsers: 0,
    openReports: 0,
    storageCounts: [
      { label: "Posts", count: 0, color: "#6c757d" },
      { label: "Comments", count: 0, color: "#6c757d" },
      { label: "DMs", count: 0, color: "#6c757d" },
      { label: "Reports", count: 0, color: "#6c757d" }
    ],
    zones: [{ name: "No backend data", visits: 0, color: "#6c757d" }],
    events: [{ type: "warn", text: reactorState.error || "Waiting for Reactor backend data." }]
  };
}

function renderReactorHub() {
  const data = reactorState.data || getReactorFallback();
  const visitors = document.getElementById("reactor-visitors");
  const active = document.getElementById("reactor-active");
  const uptime = document.getElementById("reactor-uptime");
  const latency = document.getElementById("reactor-latency");
  const statusLabel = document.getElementById("reactor-status-label");
  const healthList = document.querySelector(".reactor-health-list");
  const list = document.getElementById("reactor-zone-activity");
  const log = document.getElementById("reactor-event-log");

  if (visitors) visitors.textContent = data.visitorsToday;
  if (active) active.textContent = data.activeSessions;
  if (uptime) uptime.textContent = data.totalUsers;
  if (latency) latency.textContent = data.openReports;
  if (statusLabel) statusLabel.textContent = data.status;

  if (healthList) {
    const counts = data.storageCounts || [];
    const maxCount = Math.max(...counts.map((item) => item.count), 1);
    healthList.innerHTML = counts.map((item) => {
      const percent = Math.round((item.count / maxCount) * 100);
      return `
      <div class="reactor-health-item">
        <span>${escapeHtml(item.label)}</span>
        <div class="dynamic-progress-bar"><div class="dynamic-progress-fill" style="width:${percent}%; background:${escapeHtml(item.color)};"></div></div>
        <small>${item.count}</small>
      </div>
    `;
    }).join("");
  }

  if (list) {
    const max = Math.max(...data.zones.map(z => z.visits), 1);
    list.innerHTML = data.zones.map(zone => `
      <div class="reactor-item">
        <strong>${escapeHtml(zone.name)}</strong>
        <div style="flex:1; margin: 0 10px;">
          <div class="dynamic-progress-bar">
            <div class="dynamic-progress-fill" style="width:${Math.round((zone.visits / max) * 100)}%; background:${escapeHtml(zone.color)};"></div>
          </div>
        </div>
        <span>${zone.visits} events</span>
      </div>
    `).join("");
  }

  if (log) {
    log.innerHTML = data.events.map(ev => `
      <div class="reactor-event-item ${ev.type === "ok" ? "ok" : ""}">
        <span>${ev.type === "ok" ? "OK" : "!"}</span>
        <p>${escapeHtml(ev.text)}</p>
      </div>
    `).join("");
  }
}

// =========================
// SECURITY HUB
// =========================

const securityState = {
  reports: [],
  modLog: [
    { status: "resolved", text: "Spam report against a test account — closed after review." },
    { status: "resolved", text: "Duplicate post report — original kept, copy removed." },
    { status: "open", text: "Harassment report pending review — awaiting moderator." },
    { status: "open", text: "Bug report: zone prompt not dismissing on mobile — logged." },
    { status: "open", text: "Impersonation claim — under investigation." }
  ]
};

function initSecurityHub() {
  updateSecurityOpenCount();
  renderSecurityModLog();
}

function updateSecurityOpenCount() {
  const countEl = document.getElementById("security-open-count");
  if (!countEl) return;
  const open = securityState.modLog.filter(item => item.status === "open").length;
  countEl.textContent = open;
}

function submitSecurityReport() {
  const typeEl = document.getElementById("sec-report-type");
  const targetEl = document.getElementById("sec-report-target");
  const detailEl = document.getElementById("sec-report-detail");
  const statusEl = document.getElementById("sec-report-status");
  if (!typeEl || !detailEl || !statusEl) return;

  const detail = detailEl.value.trim();
  if (!detail) {
    statusEl.textContent = "Please fill in the details field before submitting.";
    statusEl.style.color = "#7f1d1d";
    return;
  }

  const target = targetEl ? targetEl.value.trim() : "";
  const type = typeEl.value;
  const label = target ? `${type} report against ${target}` : `${type} report submitted`;

  securityState.modLog.unshift({ status: "open", text: `${label} — pending moderator review.` });
  securityState.reports.push({ type, target, detail });

  if (detailEl) detailEl.value = "";
  if (targetEl) targetEl.value = "";

  statusEl.textContent = `Report submitted. A moderator will review it shortly.`;
  statusEl.style.color = "#0f766e";

  updateSecurityOpenCount();
  renderSecurityModLog();
}

function renderSecurityModLog() {
  const log = document.getElementById("security-mod-log");
  if (!log) return;

  log.innerHTML = securityState.modLog.map(item => `
    <div class="security-mod-item ${item.status === "resolved" ? "resolved" : ""}">
      <span>${item.status === "resolved" ? "Done" : "Open"}</span>
      <p>${item.text}</p>
    </div>
  `).join("");
}

function initSecurityHubBackend() {
  loadSecurityReports();
}

function submitSecurityReportBackend() {
  const typeEl = document.getElementById("sec-report-type");
  const targetEl = document.getElementById("sec-report-target");
  const detailEl = document.getElementById("sec-report-detail");
  const statusEl = document.getElementById("sec-report-status");
  if (!typeEl || !detailEl || !statusEl) return;

  const detail = detailEl.value.trim();
  if (!detail) {
    statusEl.textContent = "Please fill in the details field before submitting.";
    statusEl.style.color = "#7f1d1d";
    return;
  }

  const target = targetEl ? targetEl.value.trim() : "";
  const type = typeEl.value;
  apiRequest("/api/security/reports", {
    method: "POST",
    body: JSON.stringify({ type, target, detail })
  }).then((data) => {
    securityState.reports = data.overview?.reports || [];
    securityState.openCount = data.overview?.openCount || 0;
    securityState.error = "";
    detailEl.value = "";
    if (targetEl) targetEl.value = "";
    statusEl.textContent = "Report submitted and stored on the backend.";
    statusEl.style.color = "#0f766e";
    renderSecurityModLogBackend();
  }).catch((error) => {
    statusEl.textContent = `Report failed: ${error.message}`;
    statusEl.style.color = "#7f1d1d";
  });
}

function loadSecurityReports() {
  apiRequest("/api/security/reports")
    .then((data) => {
      securityState.reports = data.reports || [];
      securityState.openCount = data.openCount || 0;
      securityState.error = "";
      renderSecurityModLogBackend();
    })
    .catch((error) => {
      securityState.reports = [];
      securityState.openCount = 0;
      securityState.error = `Security backend unavailable: ${error.message}`;
      renderSecurityModLogBackend();
    });
}

function renderSecurityModLogBackend() {
  const countEl = document.getElementById("security-open-count");
  const log = document.getElementById("security-mod-log");
  if (countEl) countEl.textContent = securityState.openCount || 0;
  if (!log) return;

  if (securityState.error) {
    log.innerHTML = `<div class="security-mod-item"><span>Warn</span><p>${escapeHtml(securityState.error)}</p></div>`;
    return;
  }
  if (!securityState.reports || securityState.reports.length === 0) {
    log.innerHTML = `<div class="security-mod-item resolved"><span>OK</span><p>No reports stored yet.</p></div>`;
    return;
  }

  log.innerHTML = securityState.reports.map(item => {
    const target = item.target ? ` against ${item.target}` : "";
    return `
      <div class="security-mod-item ${item.status === "resolved" ? "resolved" : ""}">
        <span>${item.status === "resolved" ? "Done" : "Open"}</span>
        <p>${escapeHtml(item.type)} report${escapeHtml(target)} - ${escapeHtml(item.detail)}</p>
      </div>
    `;
  }).join("");
}

if (typeof window !== "undefined") {
  window.submitSecurityReport = submitSecurityReportBackend;
}

// Electrical Hub (post creator)

const electricalState = {
  drafts: [],
  postCount: 0
};
 
function initElectricalHub() {
  loadPostsFromBackend();
  updateElecDraftCount();
  renderElecDraftList();
  updateElecPreview();
}
 
function updateElecPreview() {
  const tag = document.getElementById("elec-tag-select");
  const title = document.getElementById("elec-title-input");
  const body = document.getElementById("elec-body-input");
  const previewTag = document.getElementById("elec-preview-tag");
  const previewTitle = document.getElementById("elec-preview-title");
  const previewBody = document.getElementById("elec-preview-body");
  if (!tag || !title || !body) return;
 
  if (previewTag) previewTag.textContent = tag.value || "Space";
  if (previewTitle) previewTitle.textContent = title.value.trim() || "Your heading will appear here.";
  if (previewBody) previewBody.textContent = body.value.trim() || "Your post body will appear here once you start typing.";
}
 
function saveElecDraft() {
  const tag = document.getElementById("elec-tag-select");
  const title = document.getElementById("elec-title-input");
  const body = document.getElementById("elec-body-input");
  const status = document.getElementById("elec-submit-status");
  if (!title || !body) return;
 
  const titleVal = title.value.trim();
  const bodyVal = body.value.trim();
  if (!titleVal && !bodyVal) {
    if (status) { status.textContent = "Nothing to save — write something first."; status.style.color = "#7f1d1d"; }
    return;
  }
 
  electricalState.drafts.unshift({
    id: Date.now(),
    tag: tag ? tag.value : "Space",
    title: titleVal || "(No heading)",
    body: bodyVal || "(No body)",
    savedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  });
 
  if (status) { status.textContent = "Draft saved."; status.style.color = "#0f766e"; }
  updateElecDraftCount();
  renderElecDraftList();
}
 
async function submitElecPost() {
  const tag = document.getElementById("elec-tag-select");
  const title = document.getElementById("elec-title-input");
  const body = document.getElementById("elec-body-input");
  const status = document.getElementById("elec-submit-status");
  if (!title || !body) return;
 
  const titleVal = title.value.trim();
  const bodyVal = body.value.trim();
  if (!titleVal) {
    if (status) { status.textContent = "Add an encryption topic before transmitting."; status.style.color = "#7f1d1d"; }
    return;
  }
  if (!bodyVal) {
    if (status) { status.textContent = "Write something in the transmission body before sending."; status.style.color = "#7f1d1d"; }
    return;
  }
 
  const draftPost = {
    tag: tag ? tag.value : "Space",
    title: titleVal,
    body: bodyVal,
    authorId: CURRENT_USER_ID,
    authorName: authedCrewName || "Crewmate",
    comments: [],
    upvotes: 0,
    downvotes: 0,
    canDelete: false
  };
  let newPost;
  try {
    newPost = await createPostOnBackend(draftPost);
    newPost.canDelete = true;
    postStore.posts.unshift(newPost);
    postStore.backendReady = true;
  } catch (error) {
    console.warn("Create post sync failed:", error.message);
    if (status) {
      status.textContent = "Could not transmit. Check that the backend is running, then try again.";
      status.style.color = "#7f1d1d";
    }
    return;
  }
  electricalState.postCount++;
  title.value = "";
  body.value = "";
  updateElecPreview();
  refreshPostViews();
 
  if (status) {
    status.textContent = `Transmission sent (${newPost.tag} - "${titleVal.slice(0, 40)}${titleVal.length > 40 ? "..." : ""}"). Head to Cafeteria or Weapons to track it.`;
    status.style.color = "#0f766e";
  }
}
 
function loadElecDraft(draftId) {
  const draft = electricalState.drafts.find(d => d.id === draftId);
  if (!draft) return;
  const tag = document.getElementById("elec-tag-select");
  const title = document.getElementById("elec-title-input");
  const body = document.getElementById("elec-body-input");
  if (tag) tag.value = draft.tag;
  if (title) title.value = draft.title === "(No heading)" ? "" : draft.title;
  if (body) body.value = draft.body === "(No body)" ? "" : draft.body;
  updateElecPreview();
}
 
function deleteElecDraft(draftId) {
  electricalState.drafts = electricalState.drafts.filter(d => d.id !== draftId);
  updateElecDraftCount();
  renderElecDraftList();
}
 
function updateElecDraftCount() {
  const el = document.getElementById("electrical-draft-count");
  if (el) el.textContent = `${electricalState.drafts.length} draft${electricalState.drafts.length !== 1 ? "s" : ""}`;
}
 
function renderElecDraftList() {
  const list = document.getElementById("elec-draft-list");
  if (!list) return;
  if (electricalState.drafts.length === 0) {
    list.innerHTML = `<p class="electrical-meta">No drafts saved yet.</p>`;
    return;
  }
  list.innerHTML = electricalState.drafts.map(draft => `
    <div class="electrical-draft-item">
      <p><strong>${draft.tag}</strong> — ${draft.title}</p>
      <span>${draft.savedAt}</span>
      <button class="dynamic-btn" type="button" onclick="loadElecDraft(${draft.id})" style="padding:4px 10px; font-size:12px;">Load</button>
      <button class="dynamic-btn" type="button" onclick="deleteElecDraft(${draft.id})" style="padding:4px 10px; font-size:12px;">Delete</button>
    </div>
  `).join("");
}

//O2 (Discover feed)

const o2State = {
  activeFilter: "new",
  selectedPostId: null
};
 
function initO2Hub() {
  o2State.selectedPostId = null;
  renderO2Feed();
  renderO2Detail();
  updateO2UnseenCount();
  loadPostsForFeed("new", { unseen: "1" }).catch(() => loadPostsFromBackend());
}
 
function setO2Filter(filter) {
  o2State.activeFilter = filter;
  document.querySelectorAll(".o2-filter-btn").forEach(btn => {
    btn.classList.toggle("selected", btn.dataset.filter === filter);
  });
  renderO2Feed();
  const feed = filter === "rising" ? "rising" : "new";
  loadPostsForFeed(feed, { unseen: filter === "random" ? "" : "1" }).catch(() => {});
}
 
function refreshO2Feed() {
  getAllPosts().forEach(post => { post.seenByMe = false; });
  o2State.selectedPostId = null;
  renderO2Feed();
  renderO2Detail();
  updateO2UnseenCount();
  Promise.allSettled(getAllPosts().map(post => (
    apiRequest(`/api/posts/${encodeURIComponent(post.id)}/seen`, { method: "DELETE" })
  ))).catch(error => console.warn("Seen reset failed:", error.message));
}
 
function getO2SortedPosts() {
  const unseen = getAllPosts().filter(p => !p.seenByMe);
  if (o2State.activeFilter === "new") return [...unseen].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (o2State.activeFilter === "rising") return [...unseen].sort((a, b) => getPostCommentCount(b) - getPostCommentCount(a));
  if (o2State.activeFilter === "random") return [...unseen].sort(() => Math.random() - 0.5);
  return unseen;
}
 
function renderO2Feed() {
  const list = document.getElementById("o2-feed-list");
  if (!list) return;
  const posts = getO2SortedPosts();
  if (posts.length === 0) {
    list.innerHTML = `<p class="o2-meta">You've seen everything in this filter. Hit Refresh to reset.</p>`;
    return;
  }
  list.innerHTML = posts.map(post => `
    <div class="o2-feed-item ${post.id === o2State.selectedPostId ? "selected" : ""}" onclick="selectO2Post(${post.id})">
      <p class="o2-feed-tag">${post.tag}</p>
      <p class="o2-feed-title">${post.title}</p>
    </div>
  `).join("");
}
 
function selectO2Post(postId) {
  o2State.selectedPostId = postId;
  renderO2Feed();
  renderO2Detail();
}
 
function renderO2Detail() {
  const meta = document.getElementById("o2-selected-meta");
  const detail = document.getElementById("o2-post-detail");
  const actions = document.getElementById("o2-post-actions");
  if (!meta || !detail) return;
 
  const post = getPostById(o2State.selectedPostId);
  if (!post) {
    meta.textContent = "Select a post to read.";
    detail.innerHTML = "<p>Nothing selected yet.</p>";
    if (actions) actions.style.display = "none";
    updateDeleteButton("o2-delete-post-btn", null);
    return;
  }
 
  meta.textContent = `${post.tag} | ${getPostScoreLabel(post)} | ${getPostCommentCount(post)} comments`;
  updateDeleteButton("o2-delete-post-btn", post);
  detail.innerHTML = `
    <p style="font-weight:bold; margin:0 0 6px;">${post.title}</p>
    <p style="margin:0; font-size:13px;">${post.body}</p>
  `;
  if (actions) actions.style.display = "flex";
}
 
function o2Vote(direction) {
  voteOnPost(o2State.selectedPostId, direction);
  syncVoteToBackend(o2State.selectedPostId, direction);
  renderO2Detail();
  renderO2Feed();
}
 
function o2MarkSeen() {
  if (o2State.selectedPostId !== null) {
    const post = getPostById(o2State.selectedPostId);
    if (post) post.seenByMe = true;
    apiRequest(`/api/posts/${encodeURIComponent(o2State.selectedPostId)}/seen`, { method: "POST" })
      .catch(error => console.warn("Seen sync failed:", error.message));
    o2State.selectedPostId = null;
    renderO2Feed();
    renderO2Detail();
    updateO2UnseenCount();
  }
}
 
function updateO2UnseenCount() {
  const el = document.getElementById("o2-unseen-count");
  if (el) el.textContent = getAllPosts().filter(p => !p.seenByMe).length;
}


// Weapons (Controversial feed)

const weaponsState = {
  activeSort: "top",
  selectedPostId: null
};
 
function initWeaponsHub() {
  weaponsState.selectedPostId = null;
  renderWeaponsFeed();
  renderWeaponsDetail();
  loadPostsForFeed("top").catch(() => loadPostsFromBackend());
}
 
function setWeaponsSort(sort) {
  weaponsState.activeSort = sort;
  document.querySelectorAll(".weapons-sort-btn").forEach(btn => {
    btn.classList.toggle("selected", btn.dataset.sort === sort);
  });
  renderWeaponsFeed();
  const feed = sort === "controversial" ? "controversial" : sort === "rising" ? "rising" : sort === "new" ? "new" : "top";
  loadPostsForFeed(feed).catch(() => {});
}
 
function getWeaponsSortedPosts() {
  const posts = [...getAllPosts()];
  if (weaponsState.activeSort === "top") return posts.sort((a, b) => (b.upvotes + getPostCommentCount(b) * 2) - (a.upvotes + getPostCommentCount(a) * 2));
  if (weaponsState.activeSort === "rising") return posts.sort((a, b) => getPostScore(b) - getPostScore(a));
  if (weaponsState.activeSort === "new") return posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (weaponsState.activeSort === "controversial") {
    return posts.sort((a, b) => {
      const ratioA = Math.min(a.upvotes, a.downvotes) / Math.max(a.upvotes + a.downvotes, 1);
      const ratioB = Math.min(b.upvotes, b.downvotes) / Math.max(b.upvotes + b.downvotes, 1);
      return ratioB - ratioA;
    });
  }
  return posts;
}
 
function renderWeaponsFeed() {
  const list = document.getElementById("weapons-feed-list");
  if (!list) return;
  const posts = getWeaponsSortedPosts();
  list.innerHTML = posts.map(post => {
    const isControversial = weaponsState.activeSort === "controversial";
    const badge = isControversial ? `<span class="weapons-trend-badge">Split</span>` : "";
    return `
      <div class="weapons-feed-item ${post.id === weaponsState.selectedPostId ? "selected" : ""}" onclick="selectWeaponsPost(${post.id})">
        <p class="weapons-feed-tag">${post.tag}</p>
        <p class="weapons-feed-title">${badge}${post.title}</p>
        <p class="weapons-feed-meta">${getPostScoreLabel(post)} | ${post.downvotes} down | ${getPostCommentCount(post)} comments</p>
      </div>
    `;
  }).join("");
}
 
function selectWeaponsPost(postId) {
  weaponsState.selectedPostId = postId;
  renderWeaponsFeed();
  renderWeaponsDetail();
}
 
function renderWeaponsDetail() {
  const meta = document.getElementById("weapons-selected-meta");
  const detail = document.getElementById("weapons-post-detail");
  const actions = document.getElementById("weapons-post-actions");
  if (!meta || !detail) return;
 
  const post = getPostById(weaponsState.selectedPostId);
  if (!post) {
    meta.textContent = "Select a post to expand.";
    detail.innerHTML = "<p>Nothing selected.</p>";
    if (actions) actions.style.display = "none";
    updateDeleteButton("weapons-delete-post-btn", null);
    return;
  }
 
  meta.textContent = `${post.tag} | ${getPostScoreLabel(post)} | ${post.downvotes} down | ${getPostCommentCount(post)} comments`;
  updateDeleteButton("weapons-delete-post-btn", post);
  detail.innerHTML = `
    <p style="font-weight:bold; margin:0 0 6px;">${post.title}</p>
    <p style="margin:0; font-size:13px;">${post.body}</p>
  `;
  if (actions) actions.style.display = "flex";
}
 
function weaponsVote(direction) {
  voteOnPost(weaponsState.selectedPostId, direction);
  syncVoteToBackend(weaponsState.selectedPostId, direction);
  renderWeaponsDetail();
  renderWeaponsFeed();
}

// Storage Terminal Hub (Saved Posts Manifest)
const storageState = {
  selectedPostId: null
};

function initStorageHub() {
  loadPostsFromBackend();
  storageState.selectedPostId = null;
  renderStorageSavedList();
  renderStorageDetail();
  updateStorageSavedCount();
}

function updateStorageSavedCount() {
  const el = document.getElementById("storage-saved-count");
  const savedCount = getSavedPosts().length;
  if (el) el.textContent = `${savedCount} item${savedCount === 1 ? "" : "s"}`;
}

function renderStorageSavedList() {
  const list = document.getElementById("storage-saved-list");
  if (!list) return;

  const items = getSavedPosts();
  if (items.length === 0) {
    list.innerHTML = `<p class="storage-meta">No saved posts found in data banks.</p>`;
    return;
  }

  list.innerHTML = items.map(post => `
    <div class="storage-saved-item ${post.id === storageState.selectedPostId ? "selected" : ""}" onclick="selectStoragePost(${post.id})">
      <p class="storage-meta">${post.tag || "Space"} | ${getPostScoreLabel(post)}</p>
      <p><strong>${post.title}</strong></p>
    </div>
  `).join("");
}

function selectStoragePost(postId) {
  storageState.selectedPostId = postId;
  renderStorageSavedList();
  renderStorageDetail();
}

function renderStorageDetail() {
  const meta = document.getElementById("storage-selected-meta");
  const detail = document.getElementById("storage-post-detail");
  const actions = document.getElementById("storage-post-actions");
  if (!meta || !detail || !actions) return;

  const post = getPostById(storageState.selectedPostId);
  if (!post) {
    meta.textContent = "Select a saved post to view details.";
    detail.innerHTML = "<p>No saved transmission selected.</p>";
    actions.style.display = "none";
    return;
  }

  meta.textContent = `${post.tag || "Space"} | ${getPostScoreLabel(post)}`;
  detail.innerHTML = `
    <p style="font-weight:bold; margin:0 0 6px;">${post.title}</p>
    <p style="margin:0; font-size:13px; text-transform:none;">${post.body || "No details available."}</p>
  `;
  actions.style.display = "block";
}

function unsavePostFromStorage() {
  if (storageState.selectedPostId !== null) {
    unsavePost(storageState.selectedPostId);
    storageState.selectedPostId = null;
    refreshPostViews();
  }
}

function saveActivePostToStorage() {
  if (cafeteriaState.selectedPostId !== null) {
    savePost(cafeteriaState.selectedPostId);
    refreshPostViews();
    alert("Transmission bookmarked in Storage data banks.");
  }
}

function saveWeaponsPostToStorage() {
  if (weaponsState.selectedPostId !== null) {
    savePost(weaponsState.selectedPostId);
    refreshPostViews();
    alert("Transmission bookmarked in Storage data banks.");
  }
}
