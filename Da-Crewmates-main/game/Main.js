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

    function isTextEntryTarget(target) {
      if (!target || !(target instanceof Element)) return false;
      return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
    }

    loadExternalHTMLTemplates();


    window.addEventListener('keydown', (e) => { 
      if (isTextEntryTarget(e.target)) return;
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
    
    window.addEventListener('keyup', (e) => {
      if (isTextEntryTarget(e.target)) return;
      if (e.key in keys) keys[e.key] = false;
    });

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
      trackRoomVisit(hexKey, zone);
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

    function roomIdForZone(hexKey, zone) {
      return String(zone?.title || hexKey || "room")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "room";
    }

    function trackRoomVisit(hexKey, zone) {
      const roomId = roomIdForZone(hexKey, zone);
      const roomName = zone?.title || "Station Room";
      apiRequest("/api/rooms/visit", {
        method: "POST",
        body: JSON.stringify({ roomId, roomName })
      })
        .then(() => {
          if (document.getElementById("medbay-stat-grid")) loadMedbayAnalytics();
          if (document.getElementById("reactor-stat-grid")) initReactorHub();
        })
        .catch(error => console.warn("Room visit sync failed:", error.message));
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
  posts: createAstronomyFallbackPosts()
};

function createAstronomyFallbackPosts() {
  const author = {
    authorId: "observatory-crew",
    authorName: "Observatory Crew",
    savedByMe: false,
    seenByMe: false
  };
  return [
    {
      ...author,
      id: "fallback-astrophysics-cmb-map",
      tag: "Astrophysics",
      title: "What does the cosmic microwave background still leave unresolved?",
      body: "Cosmology has precise temperature maps, but questions around inflation, dark matter, and early structure growth still shape how we interpret the CMB.",
      createdAt: "2026-06-01T10:00:00.000Z",
      upvotes: 42,
      downvotes: 0,
      comments: ["Observatory Crew: The CMB is precise, but interpretation still depends on the model around it."]
    },
    {
      ...author,
      id: "fallback-astrophysics-solar-oscillations",
      tag: "Astrophysics",
      title: "How do solar oscillations reveal the Sun's interior?",
      body: "Helioseismology tracks pressure waves across the solar surface to infer rotation, density, magnetic behavior, and energy transport below the photosphere.",
      createdAt: "2026-06-01T09:30:00.000Z",
      upvotes: 36,
      downvotes: 0,
      comments: ["Observatory Crew: Oscillation modes make the Sun behave like an instrument."]
    },
    {
      ...author,
      id: "fallback-astrometry-gaia-distance-ladder",
      tag: "Astrometry",
      title: "Why does Gaia astrometry matter for the cosmic distance ladder?",
      body: "Accurate parallax and proper-motion measurements calibrate nearby stars, which strengthens distance estimates used for Cepheids, supernovae, and galaxy-scale measurements.",
      createdAt: "2026-06-01T09:00:00.000Z",
      upvotes: 39,
      downvotes: 0,
      comments: ["Observatory Crew: Better local measurements improve the faraway measurements built on them."]
    },
    {
      ...author,
      id: "fallback-astrometry-exoplanet-wobble",
      tag: "Astrometry",
      title: "What can tiny stellar wobbles tell us about exoplanets?",
      body: "Astrometric shifts can reveal planetary masses and orbits, especially when paired with transit and radial-velocity observations.",
      createdAt: "2026-06-01T08:30:00.000Z",
      upvotes: 31,
      downvotes: 0,
      comments: ["Observatory Crew: Position measurements are slow work, but they can break key orbit degeneracies."]
    },
    {
      ...author,
      id: "fallback-astrogeology-lunar-regolith",
      tag: "Astrogeology",
      title: "Why is lunar regolith such a difficult engineering material?",
      body: "Selenography and planetary geology show that lunar dust is sharp, charged, abrasive, and chemically reactive enough to affect habitats, suits, seals, and instruments.",
      createdAt: "2026-06-01T08:00:00.000Z",
      upvotes: 34,
      downvotes: 0,
      comments: ["Observatory Crew: Dust behavior is geology becoming an engineering problem."]
    },
    {
      ...author,
      id: "fallback-astrogeology-mars-valleys",
      tag: "Astrogeology",
      title: "What do Martian valley networks imply about ancient water?",
      body: "Areology compares channel shapes, crater ages, minerals, and sediment deposits to test whether early Mars had persistent rainfall, groundwater, or episodic meltwater.",
      createdAt: "2026-06-01T07:30:00.000Z",
      upvotes: 37,
      downvotes: 0,
      comments: ["Observatory Crew: Valley networks are one of the strongest clues that Mars had a very different climate."]
    },
    {
      ...author,
      id: "fallback-astrobiology-europa-plumes",
      tag: "Astrobiology",
      title: "What would make Europa plume chemistry compelling for life?",
      body: "Astrobiology looks for chemical disequilibrium, organics, salts, and energy gradients that could connect an ocean environment to potential biological processes.",
      createdAt: "2026-06-01T07:00:00.000Z",
      upvotes: 45,
      downvotes: 0,
      comments: ["Observatory Crew: A plume sample would be valuable because it may connect directly to the subsurface ocean."]
    },
    {
      ...author,
      id: "fallback-astrobiology-atmosphere-false-positives",
      tag: "Astrobiology",
      title: "Which biosignature gases have the hardest false positives?",
      body: "Astrochemistry helps separate possible biological signals from photochemistry, volcanism, atmospheric escape, and star-planet interaction effects.",
      createdAt: "2026-06-01T06:30:00.000Z",
      upvotes: 41,
      downvotes: 0,
      comments: ["Observatory Crew: Context matters as much as the gas itself."]
    }
  ];
}

const postCategoryMap = {
  Space: "Astrophysics",
  Science: "Astrobiology",
  Tech: "Astrometry",
  Discussion: "Astrogeology",
  Social: "Astrobiology",
  Other: "Astrophysics"
};
const postCategories = ["Astrophysics", "Astrometry", "Astrogeology", "Astrobiology"];

function normalizePostCategory(value) {
  const raw = String(value || "").trim();
  if (postCategories.includes(raw)) return raw;
  return postCategoryMap[raw] || "Astrophysics";
}

function getGameApiBase() {
  if (queryParams.get("api")) return normalizeApiBase(queryParams.get("api"));
  if (window.DC_API_BASE) return normalizeApiBase(window.DC_API_BASE);

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

const API_BASE = getGameApiBase().replace(/\/$/, "");
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
    if (document.getElementById("friends-list-container")) {
      const shouldReloadSelectedThread =
        payload.threadId &&
        payload.threadId === friendsState.selectedThreadId;
      loadDmThreads().then(() => {
        if (shouldReloadSelectedThread) {
          return loadDmMessages(payload.threadId);
        }
        return null;
      });
    }
  } else if (message.type === "dm_messages_read") {
    if (payload.threadId === friendsState.selectedThreadId) {
      loadDmMessages(payload.threadId);
    }
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
  summary.textContent = `${progress.done} Point(s) Earned | ${sessionState.streak || 0} day streak`;
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
    tag: normalizePostCategory(rawPost.tag),
    title: rawPost.title || "(Untitled transmission)",
    body: rawPost.body || rawPost.detail || "",
    imageUrl: rawPost.imageUrl || rawPost.image_url || "",
    authorId: rawPost.authorId || "crew-local",
    authorName: rawPost.authorName || rawPost.authorId || "Crewmate",
    createdAt: rawPost.createdAt || new Date().toISOString(),
    upvotes: rawPost.upvotes || rawPost.likes || 0,
    downvotes: rawPost.downvotes || 0,
    shares: rawPost.shares || 0,
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

function escapeInlineArg(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
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
  renderStorageList();
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
  const shares = Number(post?.shares || 0);
  return `${score} like${Math.abs(score) === 1 ? "" : "s"} | ${shares} share${shares === 1 ? "" : "s"}`;
}

function renderPostImage(post, extraClass = "") {
  if (!post?.imageUrl) return "";
  return `<img class="post-image ${extraClass}" src="${escapeHtml(post.imageUrl)}" alt="${escapeHtml(post.title || "Post image")}" loading="lazy">`;
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
      tag: normalizePostCategory(rawPost.tag),
      imageUrl: rawPost.imageUrl || "",
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
  storageState.myPosts = storageState.myPosts.filter(post => post.id !== postId);
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

function findFriendByChoice(friends, choice) {
  const normalized = String(choice || "").trim().toLowerCase();
  if (!normalized) return null;
  const number = Number(normalized);
  if (Number.isInteger(number) && number >= 1 && number <= friends.length) {
    return friends[number - 1];
  }
  return friends.find((friend) => (
    String(friend.displayName || "").toLowerCase() === normalized ||
    String(friend.id || "").toLowerCase() === normalized
  )) || null;
}

function getShareTargetForSurface(surface) {
  return {
    cafeteria: { hexKey: "8f8b66", label: "Cafeteria" },
    o2: { hexKey: "00ff00", label: "O2" },
    weapons: { hexKey: "0000ff", label: "Weapons" },
    storage: { hexKey: "efa9fa", label: "Storage" }
  }[surface] || { hexKey: "8f8b66", label: "Cafeteria" };
}

async function shareActivePost(surface) {
  const postId = getSelectedPostIdBySurface(surface);
  const post = getPostById(postId);
  if (!post) return;

  try {
    const friendsPayload = await apiRequest("/api/friends/list");
    const friends = friendsPayload.friends || [];
    if (friends.length === 0) {
      showShareStatus("Add a friend first, then share this transmission again.", true);
      return;
    }

    const friend = await chooseShareFriend(post, friends);
    if (!friend) return;

    const threadPayload = await apiRequest("/api/dm/threads", {
      method: "POST",
      body: JSON.stringify({ receiverId: friend.id })
    });
    const threadId = threadPayload.thread?.id;
    if (!threadId) throw new Error("Could not open a DM thread.");

    const target = getShareTargetForSurface(surface);
    const shareMeta = `[[DC_SHARE:${encodeURIComponent(post.id)}:${encodeURIComponent(surface)}]]`;
    const preview = [
      shareMeta,
      `Shared post: ${post.title}`,
      `${post.authorName || "Crewmate"} | ${normalizePostCategory(post.tag)} | ${target.label}`,
      post.body ? post.body.slice(0, 220) : ""
    ].filter(Boolean).join("\n");

    await apiRequest(`/api/dm/threads/${encodeURIComponent(threadId)}/messages`, {
      method: "POST",
      body: JSON.stringify({ body: preview })
    });

    const sharePayload = await apiRequest(`/api/posts/${encodeURIComponent(post.id)}/share`, { method: "POST" });
    post.shares = sharePayload.shares ?? (Number(post.shares || 0) + 1);
    refreshPostViews();
    showShareStatus(`Shared with ${friend.displayName || "Crewmate"}.`, false);
  } catch (error) {
    showShareStatus(`Could not share this post: ${error.message}`, true);
  }
}

function showShareStatus(message, isError) {
  const existing = document.getElementById("share-status-toast");
  if (existing) existing.remove();
  const toast = document.createElement("div");
  toast.id = "share-status-toast";
  toast.className = `share-status-toast ${isError ? "error" : ""}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  window.setTimeout(() => toast.remove(), 2600);
}

function chooseShareFriend(post, friends) {
  return new Promise((resolve) => {
    const existing = document.getElementById("share-friend-dialog");
    if (existing) existing.remove();

    const dialog = document.createElement("div");
    dialog.id = "share-friend-dialog";
    dialog.className = "share-dialog-backdrop";
    dialog.innerHTML = `
      <div class="share-dialog">
        <div class="share-dialog-header">
          <strong>Share Transmission</strong>
          <button type="button" class="tw-close" data-share-close>X</button>
        </div>
        <p class="share-dialog-title">${escapeHtml(post.title)}</p>
        <div class="share-friend-list">
          ${friends.map((friend, index) => `
            <button type="button" class="share-friend-row" data-friend-index="${index}">
              <span class="friends-avatar" style="background:${escapeHtml(friend.avatarColor || "cyan")};">${escapeHtml((friend.displayName || "C").charAt(0).toUpperCase())}</span>
              <span><strong>${escapeHtml(friend.displayName || "Crewmate")}</strong><small>Send as DM share card</small></span>
            </button>
          `).join("")}
        </div>
      </div>
    `;
    document.body.appendChild(dialog);

    function close(value) {
      dialog.remove();
      resolve(value);
    }

    dialog.querySelector("[data-share-close]")?.addEventListener("click", () => close(null));
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) close(null);
    });
    dialog.querySelectorAll("[data-friend-index]").forEach((button) => {
      button.addEventListener("click", () => {
        close(friends[Number(button.dataset.friendIndex)]);
      });
    });
  });
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
      ${renderPostImage(post)}
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
  scrollCafeteriaThreadIntoView();
}

function scrollCafeteriaThreadIntoView() {
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
  blockedUsers: [],
  searchResults: [],
  selectedUserId: "",
  settingsLoaded: false,
  applyingSettings: false,
  saveTimer: null
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
  loadShieldPrivacySettings();
  loadShieldBlockedUsers();
  renderShieldAuditList();
}

function getShieldPrivacyControls() {
  return {
    privacy: document.getElementById("shield-privacy"),
    dm: document.getElementById("shield-dm"),
    filter: document.getElementById("shield-filter"),
    online: document.getElementById("shield-online-toggle"),
    activity: document.getElementById("shield-activity-toggle"),
    alerts: document.getElementById("shield-alert-toggle")
  };
}

function readShieldPrivacySettingsFromControls() {
  const controls = getShieldPrivacyControls();
  return {
    privacyMode: controls.privacy?.value || "Enabled",
    dmPermissions: controls.dm?.value || "Crewmates Only",
    contentFilter: controls.filter?.value || "Standard",
    showOnlinePresence: controls.online ? controls.online.checked : true,
    shareZoneActivity: controls.activity ? controls.activity.checked : true,
    criticalAlerts: controls.alerts ? controls.alerts.checked : true
  };
}

function applyShieldPrivacySettings(settings) {
  const controls = getShieldPrivacyControls();
  shieldsPrivacyState.applyingSettings = true;
  if (controls.privacy) controls.privacy.value = settings.privacyMode || "Enabled";
  if (controls.dm) controls.dm.value = settings.dmPermissions || "Crewmates Only";
  if (controls.filter) controls.filter.value = settings.contentFilter || "Standard";
  if (controls.online) controls.online.checked = settings.showOnlinePresence !== false;
  if (controls.activity) controls.activity.checked = settings.shareZoneActivity !== false;
  if (controls.alerts) controls.alerts.checked = settings.criticalAlerts !== false;
  shieldsPrivacyState.settingsLoaded = true;
  updateShieldPrivacySummary();
  shieldsPrivacyState.applyingSettings = false;
}

function loadShieldPrivacySettings() {
  apiRequest("/api/users/me/privacy")
    .then((data) => {
      applyShieldPrivacySettings(data.privacySettings || {});
      const status = document.getElementById("shield-block-status");
      if (status) status.textContent = "Privacy controls synced.";
    })
    .catch((error) => {
      shieldsPrivacyState.settingsLoaded = true;
      updateShieldPrivacySummary();
      const status = document.getElementById("shield-block-status");
      if (status) status.textContent = `Privacy settings unavailable: ${error.message}`;
    });
}

function scheduleShieldPrivacySave() {
  if (!shieldsPrivacyState.settingsLoaded || shieldsPrivacyState.applyingSettings) return;
  if (shieldsPrivacyState.saveTimer) window.clearTimeout(shieldsPrivacyState.saveTimer);
  shieldsPrivacyState.saveTimer = window.setTimeout(saveShieldPrivacySettings, 250);
}

function saveShieldPrivacySettings() {
  const status = document.getElementById("shield-block-status");
  apiRequest("/api/users/me/privacy", {
    method: "PATCH",
    body: JSON.stringify(readShieldPrivacySettingsFromControls())
  })
    .then((data) => {
      if (data.privacySettings) applyShieldPrivacySettings(data.privacySettings);
      if (status) status.textContent = "Privacy controls saved and enforced.";
    })
    .catch((error) => {
      if (status) status.textContent = `Privacy save failed: ${error.message}`;
    });
}

function updateShieldPrivacySummary() {
  const { privacy, dm, filter, online, activity, alerts } = getShieldPrivacyControls();
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
  scheduleShieldPrivacySave();
}

function renderShieldBlockedUsersList() {
  const list = document.getElementById("shield-blocked-users-list");
  if (!list) return;

  if (shieldsPrivacyState.blockedUsers.length === 0) {
    list.innerHTML = `<div class="shields-item">No blocked crew accounts.</div>`;
    return;
  }

  list.innerHTML = shieldsPrivacyState.blockedUsers
    .map((user) => `
      <div class="shields-item">
        <strong>${escapeHtml(user.displayName || "Crewmate")}</strong>
        <span>Blocked</span>
        <button class="dynamic-btn" type="button" onclick="unblockUserFromShields('${escapeInlineArg(user.id)}')">Unblock</button>
      </div>
    `)
    .join("");
}

function loadShieldBlockedUsers() {
  apiRequest("/api/users/me/blocked-users")
    .then((data) => {
      shieldsPrivacyState.blockedUsers = data.blockedUsers || [];
      renderShieldBlockedUsersList();
      renderShieldAuditList();
    })
    .catch((error) => {
      const status = document.getElementById("shield-block-status");
      if (status) status.textContent = `Block list unavailable: ${error.message}`;
      renderShieldBlockedUsersList();
    });
}

function searchShieldCrewmates() {
  const input = document.getElementById("shield-block-user-input");
  if (!input) return;
  const query = input.value.trim();
  const status = document.getElementById("shield-block-status");
  if (!query) {
    if (status) status.textContent = "Enter a crew name to search.";
    return;
  }

  searchCrewUsers(query)
    .then((users) => {
      shieldsPrivacyState.searchResults = users;
      shieldsPrivacyState.selectedUserId = shieldsPrivacyState.searchResults[0]?.id || "";
      renderShieldSearchResults();
      if (status) status.textContent = shieldsPrivacyState.searchResults.length ? "Select a crewmate, then block." : "No matching crewmates found.";
    })
    .catch((error) => {
      if (status) status.textContent = `Search failed: ${error.message}`;
    });
}

function renderShieldSearchResults() {
  const list = document.getElementById("shield-search-results");
  if (!list) return;
  if (shieldsPrivacyState.searchResults.length === 0) {
    list.innerHTML = "";
    return;
  }
  list.innerHTML = shieldsPrivacyState.searchResults.map((user) => {
    const selected = shieldsPrivacyState.selectedUserId === user.id;
    return `
      <button class="friends-row ${selected ? "selected" : ""}" type="button" onclick="selectShieldBlockTarget('${escapeInlineArg(user.id)}')">
        <span class="friends-avatar" style="background:${escapeHtml(user.avatarColor || "cyan")};">${escapeHtml((user.displayName || "C").charAt(0).toUpperCase())}</span>
        <span><strong>${escapeHtml(user.displayName || "Crewmate")}</strong><small>${escapeHtml(getRelationshipLabel(user.relationship))}</small></span>
        <span class="state-badge">${escapeHtml(getRelationshipLabel(user.relationship))}</span>
      </button>
    `;
  }).join("");
}

function selectShieldBlockTarget(userId) {
  shieldsPrivacyState.selectedUserId = userId;
  renderShieldSearchResults();
}

async function resolveShieldBlockTarget() {
  if (shieldsPrivacyState.selectedUserId) return shieldsPrivacyState.selectedUserId;

  const input = document.getElementById("shield-block-user-input");
  const query = input ? input.value.trim() : "";
  if (!query) return "";

  const users = await searchCrewUsers(query);
  shieldsPrivacyState.searchResults = users;
  const normalizedQuery = query.toLowerCase();
  const exactMatch = users.find((user) => {
    const id = String(user.id || "").toLowerCase();
    const name = String(user.displayName || "").toLowerCase();
    return id === normalizedQuery || name === normalizedQuery;
  });
  const target = exactMatch || users[0];
  shieldsPrivacyState.selectedUserId = target?.id || "";
  renderShieldSearchResults();
  return shieldsPrivacyState.selectedUserId;
}

async function blockUserFromShields() {
  const status = document.getElementById("shield-block-status");
  if (status) status.textContent = "Resolving crewmate...";
  let userId = "";
  try {
    userId = await resolveShieldBlockTarget();
  } catch (error) {
    if (status) status.textContent = `Search failed: ${error.message}`;
    return;
  }

  if (!userId) {
    if (status) status.textContent = "No matching crewmate found.";
    return;
  }

  try {
    await apiRequest("/api/users/me/blocked-users", {
      method: "POST",
      body: JSON.stringify({ blockedUserId: userId })
    });
    if (status) status.textContent = "Crewmate blocked. Follows and DMs are now restricted.";
    shieldsPrivacyState.selectedUserId = "";
    shieldsPrivacyState.searchResults = [];
    renderShieldSearchResults();
    loadShieldBlockedUsers();
    loadFriendsHub();
  } catch (error) {
    if (status) status.textContent = `Block failed: ${error.message}`;
  }
}

function unblockUserFromShields(userId) {
  const status = document.getElementById("shield-block-status");
  if (!userId) return;
  apiRequest(`/api/users/me/blocked-users/${encodeURIComponent(userId)}`, { method: "DELETE" })
    .then(() => {
      if (status) status.textContent = "Crewmate unblocked.";
      loadShieldBlockedUsers();
      loadFriendsHub();
    })
    .catch((error) => {
      if (status) status.textContent = `Unblock failed: ${error.message}`;
    });
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
  updateAdminColorSelection();
  renderAdminChecklist();
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
    following: [],
    followers: [],
    suggestions: [],
    blockedUsers: []
  },
  searchQuery: "",
  searchResults: [],
  searchHasRun: false,
  dmThreads: [],
  dmMessages: [],
  selectedThreadId: null,
  dmError: "",
  profile: {
    open: false,
    loading: false,
    error: "",
    data: null
  }
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
        following: data.following || [],
        followers: data.followers || [],
        suggestions: data.suggestions || [],
        blockedUsers: data.blockedUsers || []
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
  if (tab === "search") renderFriendsHub();
}

function renderFriendsHub() {
  document.querySelectorAll(".friends-tab-btn").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === friendsState.activeTab);
  });
  const friendsBadge = document.getElementById("badge-friends");
  const messagesBadge = document.getElementById("badge-messages");
  if (friendsBadge) friendsBadge.textContent = friendsState.data.friends.length;
  if (messagesBadge) messagesBadge.textContent = friendsState.dmThreads.length;
  renderFriendsList();
  renderFriendsFooter();
  renderObjectivePanel();
  renderCrewProfileDialog();
  if (friendsState.activeTab === "messages") scrollDmMessagesToBottom();
}

function getActiveFriendRows() {
  if (friendsState.activeTab === "friends") return friendsState.data.friends.map((row) => ({ ...row, status: "Friend" }));
  if (friendsState.activeTab === "suggestions") return friendsState.data.suggestions.map((row) => ({ ...row, status: "Suggested" }));
  if (friendsState.activeTab === "following") return friendsState.data.following.map((row) => ({ ...row, status: "Following" }));
  if (friendsState.activeTab === "followers") return friendsState.data.followers.map((row) => ({ ...row, status: "Follower" }));
  if (friendsState.activeTab === "search") return friendsState.searchResults.map((row) => ({ ...row, status: getRelationshipLabel(row.relationship) }));
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
            const preview = formatDmThreadPreview(thread.lastMessage);
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
          <p class="privacy-helper-text">Message delivery follows the recipient's Shields DM Permissions.</p>
        </div>
      </div>
    `;
    return;
  }

  if (friendsState.activeTab === "search") {
    container.innerHTML = `
      <div class="friends-search-panel">
        <div class="dm-compose-row">
          <input id="friends-search-input" class="dynamic-input" type="text" maxlength="80" placeholder="Search crew names" value="${escapeHtml(friendsState.searchQuery)}">
          <button class="dynamic-btn" type="button" onclick="searchFriendsHub()">Search</button>
        </div>
        <p class="friends-empty-msg">Search only shows crew profiles visible under their Shields Privacy Mode.</p>
        <div id="friends-search-results">${renderFriendRowsMarkup(getActiveFriendRows())}</div>
      </div>
    `;
    const input = document.getElementById("friends-search-input");
    if (input) {
      input.onkeydown = (event) => {
        if (event.key === "Enter") searchFriendsHub();
      };
    }
    return;
  }

  const rows = getActiveFriendRows();
  if (rows.length === 0) {
    container.innerHTML = `<p class="friends-empty-msg">No crewmates in this panel.</p>`;
    return;
  }
  container.innerHTML = renderFriendRowsMarkup(rows);
}

function renderFriendRowsMarkup(rows) {
  if (!rows || rows.length === 0) {
    const message = friendsState.activeTab === "search" && friendsState.searchHasRun
      ? "No visible crewmates matched. Their Shields privacy may hide them from search."
      : "No crewmates in this panel.";
    return `<p class="friends-empty-msg">${message}</p>`;
  }
  return rows.map((crewmate) => {
    const selected = friendsState.selected && friendsState.selected.id === crewmate.id && friendsState.selected.status === crewmate.status;
    const displayName = crewmate.displayName || "Crewmate";
    const initial = displayName.charAt(0).toUpperCase();
    const label = getRelationshipLabel(crewmate.relationship) || crewmate.status;
    return `
      <button class="friends-row ${selected ? "selected" : ""}" type="button" onclick="selectFriendRow('${escapeInlineArg(crewmate.id)}', '${escapeInlineArg(crewmate.status)}')">
        <span class="friends-avatar" style="background:${escapeHtml(crewmate.avatarColor || "cyan")};">${escapeHtml(initial)}</span>
        <span><strong>${escapeHtml(displayName)}</strong><small>${escapeHtml(label)}</small></span>
        <span class="state-badge">${escapeHtml(label)}</span>
      </button>
    `;
  }).join("");
}

function selectFriendRow(id, status) {
  const row = getActiveFriendRows().find((item) => item.id === id && item.status === status);
  friendsState.selected = row ? { ...row } : null;
  renderFriendsHub();
}

function renderFriendsFooter() {
  const selectedName = document.getElementById("friends-selected-name");
  const selectedStatus = document.getElementById("friends-selected-status");
  const actions = document.getElementById("friends-footer-actions");
  if (!selectedName || !selectedStatus || !actions) return;
  const selected = friendsState.selected;
  selectedName.textContent = selected ? (selected.displayName || "Crewmate") : "No crewmate selected";
  selectedStatus.textContent = selected ? getRelationshipLabel(selected.relationship) || selected.status : "";
  if (!selected) {
    actions.innerHTML = "";
    return;
  }
  if (selected.relationship === "blocked" || selected.relationship === "blockedBy") {
    actions.innerHTML = `
      <button class="dynamic-btn" type="button" onclick="openCrewProfile('${escapeInlineArg(selected.id)}')">View Profile</button>
      <span class="friends-empty-msg">Messaging is blocked.</span>
    `;
  } else if (selected.relationship === "friend" || selected.status === "Friend") {
    actions.innerHTML = `
      <button class="dynamic-btn" type="button" onclick="openCrewProfile('${escapeInlineArg(selected.id)}')">View Profile</button>
      <button class="dynamic-btn" type="button" onclick="openDmWithUser('${escapeInlineArg(selected.id)}')">Message</button>
      <button class="dynamic-btn danger-btn" type="button" onclick="unfollowCrewmateFromComms('${escapeInlineArg(selected.id)}')">Unfollow</button>
    `;
  } else if (selected.relationship === "following" || selected.status === "Following") {
    actions.innerHTML = `
      <button class="dynamic-btn" type="button" onclick="openCrewProfile('${escapeInlineArg(selected.id)}')">View Profile</button>
      <button class="dynamic-btn danger-btn" type="button" onclick="unfollowCrewmateFromComms('${escapeInlineArg(selected.id)}')">Unfollow</button>
    `;
  } else {
    actions.innerHTML = `
      <button class="dynamic-btn" type="button" onclick="openCrewProfile('${escapeInlineArg(selected.id)}')">View Profile</button>
      <button class="dynamic-btn" type="button" onclick="followCrewmateFromComms('${escapeInlineArg(selected.id)}')">Follow</button>
    `;
  }
}

function getRelationshipLabel(relationship) {
  if (relationship === "friend") return "Friend";
  if (relationship === "following") return "Following";
  if (relationship === "follower") return "Follows you";
  if (relationship === "blocked") return "Blocked";
  if (relationship === "blockedBy") return "Unavailable";
  if (relationship === "self") return "You";
  return relationship ? "Crewmate" : "";
}

function openCrewProfile(userId) {
  if (!userId) return;
  friendsState.profile = {
    open: true,
    loading: true,
    error: "",
    data: null
  };
  renderFriendsHub();
  apiRequest(`/api/users/${encodeURIComponent(userId)}/profile`)
    .then((data) => {
      friendsState.profile = {
        open: true,
        loading: false,
        error: "",
        data: data.profile || null
      };
      renderFriendsHub();
    })
    .catch((error) => {
      friendsState.profile = {
        open: true,
        loading: false,
        error: formatCrewPrivacyError(error, "Could not load profile"),
        data: null
      };
      renderFriendsHub();
    });
}

function closeCrewProfile() {
  friendsState.profile = {
    open: false,
    loading: false,
    error: "",
    data: null
  };
  renderFriendsHub();
}

function renderCrewProfileDialog() {
  const existing = document.getElementById("crew-profile-dialog");
  if (existing) existing.remove();
  if (!friendsState.profile.open) return;

  const dialog = document.createElement("div");
  dialog.id = "crew-profile-dialog";
  dialog.className = "crew-profile-backdrop";
  dialog.innerHTML = renderCrewProfileDialogMarkup();
  document.body.appendChild(dialog);
  dialog.querySelector("[data-profile-close]")?.addEventListener("click", closeCrewProfile);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeCrewProfile();
  });
}

function renderCrewProfileDialogMarkup() {
  const state = friendsState.profile;
  if (state.loading) {
    return `
      <div class="crew-profile-dialog compact">
        <div class="crew-profile-header">
          <strong>Loading Profile</strong>
          <button type="button" class="tw-close" data-profile-close>X</button>
        </div>
        <p class="friends-empty-msg">Checking Shields visibility...</p>
      </div>
    `;
  }

  if (state.error || !state.data) {
    return `
      <div class="crew-profile-dialog compact">
        <div class="crew-profile-header">
          <strong>Profile Unavailable</strong>
          <button type="button" class="tw-close" data-profile-close>X</button>
        </div>
        <p class="friends-empty-msg">${escapeHtml(state.error || "This profile could not be loaded.")}</p>
      </div>
    `;
  }

  const profile = state.data;
  const initial = (profile.displayName || "C").charAt(0).toUpperCase();
  return `
    <div class="crew-profile-dialog">
      <div class="crew-profile-header">
        <div class="crew-profile-title">
          <span class="friends-avatar" style="background:${escapeHtml(profile.avatarColor || "cyan")};">${escapeHtml(initial)}</span>
          <div>
            <strong>${escapeHtml(profile.displayName || "Crewmate")}</strong>
            <small>${escapeHtml(getRelationshipLabel(profile.relationship))} | ${escapeHtml(profile.privacyMode || "Enabled")}</small>
          </div>
        </div>
        <button type="button" class="tw-close" data-profile-close>X</button>
      </div>

      <div class="crew-profile-stats">
        <div><strong>${Number(profile.followersCount || 0)}</strong><span>Followers</span></div>
        <div><strong>${Number(profile.followingCount || 0)}</strong><span>Following</span></div>
        <div><strong>${(profile.posts || []).length}</strong><span>Recent Posts</span></div>
      </div>

      <p class="crew-profile-bio">${escapeHtml(profile.bio || "No profile bio yet.")}</p>
      <p class="privacy-helper-text">This view follows the profile owner's Shields Privacy Mode. If their profile is visible to you, their posts and crew lists are shown.</p>

      <div class="crew-profile-grid">
        <section>
          <h4>Recent Posts</h4>
          ${renderCrewProfilePosts(profile.posts || [])}
        </section>
        <section>
          <h4>Friends (${(profile.friends || []).length})</h4>
          ${renderCrewProfileCrewList(profile.friends || [])}
        </section>
        <section>
          <h4>Following (${(profile.following || []).length}/${Number(profile.followingCount || 0)})</h4>
          ${renderCrewProfileCrewList(profile.following || [])}
        </section>
        <section>
          <h4>Followers (${(profile.followers || []).length}/${Number(profile.followersCount || 0)})</h4>
          ${renderCrewProfileCrewList(profile.followers || [])}
        </section>
      </div>
    </div>
  `;
}

function renderCrewProfilePosts(posts) {
  if (!posts.length) return `<p class="friends-empty-msg">No visible posts yet.</p>`;
  return `
    <div class="crew-profile-posts">
      ${posts.map((post) => `
        <article class="crew-profile-post">
          <span>${escapeHtml(normalizePostCategory(post.tag))} | ${escapeHtml(new Date(post.createdAt).toLocaleDateString())}</span>
          <strong>${escapeHtml(post.title || "Untitled transmission")}</strong>
          ${renderPostImage(post)}
          <p>${escapeHtml((post.body || "").slice(0, 180))}</p>
          <small>${Number(post.upvotes || 0)} likes | ${Number(post.commentCount || 0)} comments | ${Number(post.shares || 0)} shares</small>
        </article>
      `).join("")}
    </div>
  `;
}

function renderCrewProfileCrewList(rows) {
  if (!rows.length) return `<p class="friends-empty-msg">No visible crewmates.</p>`;
  return `
    <div class="crew-profile-list">
      ${rows.map((row) => `
        <button type="button" class="crew-profile-person" onclick="openCrewProfile('${escapeInlineArg(row.id)}')">
          <span class="friends-avatar" style="background:${escapeHtml(row.avatarColor || "cyan")};">${escapeHtml((row.displayName || "C").charAt(0).toUpperCase())}</span>
          <span><strong>${escapeHtml(row.displayName || "Crewmate")}</strong><small>${escapeHtml(getRelationshipLabel(row.relationship))}</small></span>
        </button>
      `).join("")}
    </div>
  `;
}

function searchCrewUsers(query) {
  const normalized = String(query || "").trim().toLowerCase();
  if (!normalized) return Promise.resolve([]);
  return apiRequest(`/api/users/search?q=${encodeURIComponent(query)}`)
    .then((data) => data.users || [])
    .catch((error) => {
      if (!/route not found|not found/i.test(error.message || "")) throw error;
      return apiRequest("/api/friends/list").then((data) => {
        const rows = [
          ...(data.friends || []),
          ...(data.following || []),
          ...(data.followers || []),
          ...(data.suggestions || []),
          ...(data.blockedUsers || [])
        ];
        const byId = new Map();
        rows.forEach((row) => {
          if (!row || !row.id || byId.has(row.id)) return;
          byId.set(row.id, row);
        });
        return [...byId.values()].filter((row) => {
          const name = String(row.displayName || "").toLowerCase();
          const id = String(row.id || "").toLowerCase();
          return name.includes(normalized) || id.includes(normalized);
        });
      });
    });
}

function formatCrewPrivacyError(error, fallback) {
  const message = error?.message || "";
  if (/profile is private/i.test(message)) return "That crewmate's Shields Privacy Mode hides this action.";
  if (/dm permissions/i.test(message)) return "That crewmate's Shields DM Permissions prevent this message.";
  return `${fallback}: ${message || "Unknown error"}`;
}

function searchFriendsHub() {
  const input = document.getElementById("friends-search-input");
  const query = input ? input.value.trim() : friendsState.searchQuery;
  friendsState.searchQuery = query;
  if (!query) {
    friendsState.searchResults = [];
    friendsState.searchHasRun = false;
    renderFriendsHub();
    return;
  }
  searchCrewUsers(query)
    .then((users) => {
      friendsState.searchResults = users;
      friendsState.searchHasRun = true;
      friendsState.selected = null;
      renderFriendsHub();
    })
    .catch((error) => {
      const banner = document.getElementById("friends-error-banner");
      if (banner) {
        banner.textContent = `Search unavailable: ${error.message}`;
        banner.style.display = "block";
      }
    });
}

function followCrewmateFromComms(userId) {
  apiRequest(`/api/users/${encodeURIComponent(userId)}/follow`, { method: "POST" })
    .then(() => loadFriendsHub())
    .then(loadSessionState)
    .then(() => {
      if (friendsState.activeTab === "search" && friendsState.searchQuery) return searchFriendsHub();
      return null;
    })
    .catch((error) => {
      const banner = document.getElementById("friends-error-banner");
      if (banner) {
        banner.textContent = formatCrewPrivacyError(error, "Follow failed");
        banner.style.display = "block";
      }
    });
}

function unfollowCrewmateFromComms(userId) {
  apiRequest(`/api/users/${encodeURIComponent(userId)}/unfollow`, { method: "POST" })
    .then(() => {
      friendsState.selected = null;
      return loadFriendsHub();
    })
    .then(() => {
      if (friendsState.activeTab === "search" && friendsState.searchQuery) return searchFriendsHub();
      return null;
    })
    .catch((error) => {
      const banner = document.getElementById("friends-error-banner");
      if (banner) {
        banner.textContent = `Unfollow failed: ${error.message}`;
        banner.style.display = "block";
      }
    });
}

function blockCrewmateFromComms(userId) {
  apiRequest("/api/users/me/blocked-users", {
    method: "POST",
    body: JSON.stringify({ blockedUserId: userId })
  })
    .then(() => {
      friendsState.selected = null;
      return loadFriendsHub();
    })
    .catch((error) => {
      const banner = document.getElementById("friends-error-banner");
      if (banner) {
        banner.textContent = `Block failed: ${error.message}`;
        banner.style.display = "block";
      }
    });
}

function renderDmMessagesMarkup() {
  if (!friendsState.selectedThreadId) return `<p class="friends-empty-msg">Pick a DM thread from the left.</p>`;
  if (friendsState.dmMessages.length === 0) return `<p class="friends-empty-msg">No messages yet. Start the thread.</p>`;
  return friendsState.dmMessages.map(renderDmMessageMarkup).join("");
}

function renderDmMessageMarkup(message) {
  const share = parseSharedPostMessage(message.body);
  if (share) {
    return `
      <div class="dm-message share-message ${message.sentByMe ? "sent" : "received"}">
        <small>${escapeHtml(message.senderName || (message.sentByMe ? "You" : "Crewmate"))} | ${escapeHtml(formatDmTimestamp(message.createdAt))}</small>
        <button class="dm-share-card" type="button" onclick="openSharedPostFromMessage('${escapeInlineArg(share.postId)}', '${escapeInlineArg(share.surface)}')">
          <span>${escapeHtml(share.place)} Shared Post</span>
          <strong>${escapeHtml(share.title)}</strong>
          <small>${escapeHtml(share.meta)}</small>
          <p>${escapeHtml(share.preview)}</p>
        </button>
        ${message.sentByMe ? `<span class="dm-read-receipt">${escapeHtml(message.read ? `Read ${formatDmTimestamp(message.readAt)}` : "Delivered")}</span>` : ""}
      </div>
    `;
  }
  return `
    <div class="dm-message ${message.sentByMe ? "sent" : "received"}">
      <small>${escapeHtml(message.senderName || (message.sentByMe ? "You" : "Crewmate"))} | ${escapeHtml(formatDmTimestamp(message.createdAt))}</small>
      <p>${escapeHtml(message.body)}</p>
      ${message.sentByMe ? `<span class="dm-read-receipt">${escapeHtml(message.read ? `Read ${formatDmTimestamp(message.readAt)}` : "Delivered")}</span>` : ""}
    </div>
  `;
}

function parseSharedPostMessage(body) {
  const lines = String(body || "").split("\n");
  const marker = lines[0] || "";
  const match = marker.match(/^\[\[DC_SHARE:([^:]+):([^\]]+)\]\]$/);
  if (!match) return null;
  const surface = decodeURIComponent(match[2]);
  const target = getShareTargetForSurface(surface);
  return {
    postId: decodeURIComponent(match[1]),
    surface,
    place: target.label,
    title: (lines[1] || "Shared post").replace(/^Shared post:\s*/i, ""),
    meta: lines[2] || target.label,
    preview: lines.slice(3).join(" ").trim() || "Open this shared transmission in its station room."
  };
}

function formatDmThreadPreview(message) {
  if (!message) return "No messages yet.";
  const share = parseSharedPostMessage(message.body);
  if (share) return `Shared post: ${share.title}`;
  return message.body || "No messages yet.";
}

function scrollDmMessagesToBottom() {
  window.setTimeout(() => {
    const list = document.getElementById("dm-message-list");
    if (list) list.scrollTop = list.scrollHeight;
  }, 0);
}

function formatDmTimestamp(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function openSharedPostFromMessage(postId, surface) {
  const target = getShareTargetForSurface(surface);
  const zone = terminalContentRegistry[target.hexKey];
  if (!zone) return;

  if (isTerminalOpen) closeTerminal();
  executeTwoSecondQuantumWarp(zone, target.hexKey);
  window.setTimeout(() => selectSharedPostAfterWarp(postId, surface), 2600);
}

function selectSharedPostAfterWarp(postId, surface) {
  loadPostsFromBackend()
    .then(() => {
      if (surface === "o2") {
        o2State.selectedPostId = postId;
        renderO2Feed();
        renderO2Detail();
        return;
      }
      if (surface === "weapons") {
        weaponsState.selectedPostId = postId;
        renderWeaponsFeed();
        renderWeaponsDetail();
        return;
      }
      if (surface === "storage") {
        storageState.selectedPostId = postId;
        renderStorageList();
        renderStorageDetail();
        return;
      }
      cafeteriaState.selectedPostId = postId;
      renderCafeteriaFeed();
      renderCafeteriaDetail();
      loadCommentsForPost(postId);
      scrollCafeteriaThreadIntoView();
    })
    .catch((error) => {
      showShareStatus(`Could not open shared post: ${error.message}`, true);
    });
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
      friendsState.dmError = formatCrewPrivacyError(error, "Could not open DM");
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
      friendsState.dmError = formatCrewPrivacyError(error, "Could not send message");
      renderFriendsHub();
    })
    .finally(() => {
      input.disabled = false;
    });
}

// =========================
// REACTOR HUB
// =========================

const reactorState = { data: null, error: "" };

function initReactorHub() {
  renderReactorHub();
  apiRequest("/api/system/reactor")
    .then((data) => {
      reactorState.data = normalizeReactorStats(data.reactor);
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
    headlineStats: [
      { label: "Registered Crew", value: 0, detail: "No backend data" },
      { label: "Total Activity", value: 0, detail: "No backend data" },
      { label: "Engagement", value: 0, detail: "No backend data" },
      { label: "Open Reports", value: 0, detail: "No backend data" }
    ],
    activityMix: [{ label: "No activity", count: 0, color: "#6c757d" }],
    topTopics: [{ label: "No topics yet", count: 0, meta: "Waiting for posts.", color: "#6c757d" }],
    networkStats: [{ label: "Backend", value: "Offline", detail: reactorState.error || "Waiting for Reactor backend data." }]
  };
}

function normalizeReactorStats(raw) {
  if (!raw) return getReactorFallback();
  if (Array.isArray(raw.headlineStats)) return raw;

  const counts = Array.isArray(raw.storageCounts) ? raw.storageCounts : [];
  const countByLabel = new Map(counts.map((item) => [String(item.label || ""), Number(item.count || 0)]));
  const posts = countByLabel.get("Posts") || 0;
  const comments = countByLabel.get("Comments") || 0;
  const dms = countByLabel.get("DMs") || 0;
  const visits = countByLabel.get("Room Visits") || 0;
  const reports = Number(raw.openReports ?? countByLabel.get("Reports") ?? 0);
  const totalActivity = posts + comments + dms + visits;

  return {
    ...raw,
    status: raw.status || "Community Stats Live",
    headlineStats: [
      { label: "Registered Crew", value: Number(raw.totalUsers || 0), detail: `${Number(raw.activeSessions || 0)} visible active now` },
      { label: "Total Activity", value: totalActivity, detail: "Posts, comments, DMs, and visible visits" },
      { label: "Engagement", value: posts + comments + dms, detail: `${posts} posts | ${comments} comments | ${dms} DMs` },
      { label: "Open Reports", value: reports, detail: reports ? "Security review needed" : "No open tickets" }
    ],
    activityMix: counts.filter((item) => item.label !== "Reports"),
    topTopics: [{ label: "Backend restart needed", count: 1, meta: "Restart API to enable topic rankings.", color: "#6c757d" }],
    networkStats: [
      { label: "Visible Active", value: Number(raw.activeSessions || 0), detail: `${Number(raw.visitorsToday || 0)} visible visits today` },
      { label: "Registered Crew", value: Number(raw.totalUsers || 0), detail: "Loaded from current API" },
      { label: "Activity Records", value: totalActivity, detail: "Legacy Reactor payload converted" },
      { label: "Open Reports", value: reports, detail: reports ? "Security review needed" : "No open tickets" }
    ]
  };
}

function renderReactorHub() {
  const data = reactorState.data || getReactorFallback();
  const headline = data.headlineStats || getReactorFallback().headlineStats;
  const crewTotal = document.getElementById("reactor-crew-total");
  const activityTotal = document.getElementById("reactor-activity-total");
  const engagementTotal = document.getElementById("reactor-engagement-total");
  const openReports = document.getElementById("reactor-open-reports");
  const statusLabel = document.getElementById("reactor-status-label");
  const activityMix = document.getElementById("reactor-activity-mix");
  const topTopics = document.getElementById("reactor-top-topics");
  const networkStats = document.getElementById("reactor-network-stats");

  if (crewTotal) crewTotal.textContent = formatStatValue(headline[0]?.value);
  if (activityTotal) activityTotal.textContent = formatStatValue(headline[1]?.value);
  if (engagementTotal) engagementTotal.textContent = formatStatValue(headline[2]?.value);
  if (openReports) openReports.textContent = formatStatValue(headline[3]?.value);
  if (statusLabel) statusLabel.textContent = data.status;

  if (activityMix) {
    activityMix.innerHTML = renderReactorBarRows(data.activityMix || []);
  }

  if (topTopics) {
    topTopics.innerHTML = renderReactorBarRows(data.topTopics || [], true);
  }

  if (networkStats) {
    networkStats.innerHTML = (data.networkStats || []).map((item) => `
      <div class="reactor-metric-card">
        <strong>${escapeHtml(formatStatValue(item.value))}</strong>
        <span>${escapeHtml(item.label)}</span>
        <small>${escapeHtml(item.detail || "")}</small>
      </div>
    `).join("");
  }
}

function renderReactorBarRows(rows, includeMeta = false) {
  if (!rows || rows.length === 0) return `<p class="friends-empty-msg">No stats available yet.</p>`;
  const max = Math.max(...rows.map((row) => Number(row.count || 0)), 1);
  return rows.map((row) => {
    const count = Number(row.count || 0);
    const percent = Math.round((count / max) * 100);
    return `
      <div class="reactor-item">
        <div>
          <strong>${escapeHtml(row.label)}</strong>
          ${includeMeta ? `<small>${escapeHtml(row.meta || "")}</small>` : ""}
        </div>
        <div class="reactor-bar-track">
          <div class="dynamic-progress-bar">
            <div class="dynamic-progress-fill" style="width:${percent}%; background:${escapeHtml(row.color || "#6c757d")};"></div>
          </div>
        </div>
        <span>${formatStatValue(count)}</span>
      </div>
    `;
  }).join("");
}

function formatStatValue(value) {
  if (typeof value === "number") return value.toLocaleString();
  return String(value ?? "0");
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
  postCount: 0,
  imageFile: null,
  imagePreviewUrl: ""
};
 
function initElectricalHub() {
  loadPostsFromBackend();
  updateElecDraftCount();
  renderElecDraftList();
  updateElecPreview();
}

function clearElecImageSelection() {
  const input = document.getElementById("elec-image-input");
  const status = document.getElementById("elec-image-status");
  const previewImage = document.getElementById("elec-preview-image");
  if (electricalState.imagePreviewUrl) URL.revokeObjectURL(electricalState.imagePreviewUrl);
  electricalState.imageFile = null;
  electricalState.imagePreviewUrl = "";
  if (input) input.value = "";
  if (status) {
    status.textContent = "No image attached.";
    status.style.color = "";
  }
  if (previewImage) {
    previewImage.hidden = true;
    previewImage.removeAttribute("src");
  }
}

function handleElecImageSelection() {
  const input = document.getElementById("elec-image-input");
  const status = document.getElementById("elec-image-status");
  const file = input?.files?.[0] || null;
  if (!file) {
    clearElecImageSelection();
    return;
  }

  const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
  if (!allowedTypes.has(file.type)) {
    if (input) input.value = "";
    electricalState.imageFile = null;
    if (electricalState.imagePreviewUrl) URL.revokeObjectURL(electricalState.imagePreviewUrl);
    electricalState.imagePreviewUrl = "";
    updateElecPreview();
    if (status) {
      status.textContent = "Image must be JPEG, PNG, WebP, or GIF.";
      status.style.color = "#7f1d1d";
    }
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    if (input) input.value = "";
    electricalState.imageFile = null;
    if (electricalState.imagePreviewUrl) URL.revokeObjectURL(electricalState.imagePreviewUrl);
    electricalState.imagePreviewUrl = "";
    updateElecPreview();
    if (status) {
      status.textContent = "Image must be 5 MB or smaller.";
      status.style.color = "#7f1d1d";
    }
    return;
  }

  if (electricalState.imagePreviewUrl) URL.revokeObjectURL(electricalState.imagePreviewUrl);
  electricalState.imageFile = file;
  electricalState.imagePreviewUrl = URL.createObjectURL(file);
  if (status) {
    status.textContent = `Image attached: ${file.name}`;
    status.style.color = "#0f766e";
  }
  updateElecPreview();
}

async function uploadElecImageIfNeeded() {
  if (!electricalState.imageFile) return "";
  const formData = new FormData();
  formData.append("image", electricalState.imageFile);
  const response = await fetch(`${API_BASE}/api/post-images`, {
    method: "POST",
    headers: {
      "x-user-id": CURRENT_USER_ID,
      "x-display-name": authedCrewName
    },
    body: formData
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Image upload failed.");
  return data.imageUrl || "";
}
 
function updateElecPreview() {
  const tag = document.getElementById("elec-tag-select");
  const title = document.getElementById("elec-title-input");
  const body = document.getElementById("elec-body-input");
  const previewTag = document.getElementById("elec-preview-tag");
  const previewTitle = document.getElementById("elec-preview-title");
  const previewImage = document.getElementById("elec-preview-image");
  const previewBody = document.getElementById("elec-preview-body");
  if (!tag || !title || !body) return;
 
  if (previewTag) previewTag.textContent = normalizePostCategory(tag.value);
  if (previewTitle) previewTitle.textContent = title.value.trim() || "Your heading will appear here.";
  if (previewImage) {
    if (electricalState.imagePreviewUrl) {
      previewImage.src = electricalState.imagePreviewUrl;
      previewImage.hidden = false;
    } else {
      previewImage.hidden = true;
      previewImage.removeAttribute("src");
    }
  }
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
    tag: tag ? normalizePostCategory(tag.value) : "Astrophysics",
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
 
  let imageUrl = "";
  if (electricalState.imageFile && status) {
    status.textContent = "Uploading image...";
    status.style.color = "#6b7280";
  }
  try {
    imageUrl = await uploadElecImageIfNeeded();
  } catch (error) {
    console.warn("Image upload failed:", error.message);
    if (status) {
      status.textContent = `Image upload failed: ${error.message}`;
      status.style.color = "#7f1d1d";
    }
    return;
  }

  const draftPost = {
    tag: tag ? normalizePostCategory(tag.value) : "Astrophysics",
    title: titleVal,
    body: bodyVal,
    imageUrl,
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
  clearElecImageSelection();
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
  loadPostsForFeed("new").catch(() => loadPostsFromBackend());
}
 
function setO2Filter(filter) {
  o2State.activeFilter = filter;
  document.querySelectorAll(".o2-filter-btn").forEach(btn => {
    btn.classList.toggle("selected", btn.dataset.filter === filter);
  });
  renderO2Feed();
  const feed = filter === "rising" ? "rising" : "new";
  loadPostsForFeed(feed).catch(() => {});
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
  const source = unseen.length > 0 ? unseen : getAllPosts();
  if (o2State.activeFilter === "new") return [...source].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (o2State.activeFilter === "rising") return [...source].sort((a, b) => getPostCommentCount(b) - getPostCommentCount(a));
  if (o2State.activeFilter === "random") return [...source].sort(() => Math.random() - 0.5);
  return source;
}
 
function renderO2Feed() {
  const list = document.getElementById("o2-feed-list");
  if (!list) return;
  const posts = getO2SortedPosts();
  if (posts.length === 0) {
    list.innerHTML = `<p class="o2-meta">No transmissions available yet. Create one in Electrical first.</p>`;
    return;
  }
  list.innerHTML = posts.map(post => `
    <div class="o2-feed-item ${post.id === o2State.selectedPostId ? "selected" : ""}" onclick="selectO2Post('${escapeInlineArg(post.id)}')">
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
    ${renderPostImage(post)}
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
      <div class="weapons-feed-item ${post.id === weaponsState.selectedPostId ? "selected" : ""}" onclick="selectWeaponsPost('${escapeInlineArg(post.id)}')">
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
    ${renderPostImage(post)}
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
  activeTab: "saved",
  selectedPostId: null,
  myPosts: [],
  isLoadingMine: false
};

function initStorageHub() {
  loadPostsFromBackend();
  loadMyPostsForStorage();
  storageState.selectedPostId = null;
  renderStorageTabs();
  renderStorageList();
  renderStorageDetail();
  updateStorageSavedCount();
}

function updateStorageSavedCount() {
  const el = document.getElementById("storage-saved-count");
  const savedCount = getSavedPosts().length;
  const myCount = getMyPostsForStorage().length;
  if (el) el.textContent = storageState.activeTab === "mine"
    ? `${myCount} post${myCount === 1 ? "" : "s"}`
    : `${savedCount} item${savedCount === 1 ? "" : "s"}`;
}

function setStorageTab(tab) {
  storageState.activeTab = tab === "mine" ? "mine" : "saved";
  storageState.selectedPostId = null;
  renderStorageTabs();
  renderStorageList();
  renderStorageDetail();
  updateStorageSavedCount();
  if (storageState.activeTab === "mine") loadMyPostsForStorage();
}

function renderStorageTabs() {
  document.querySelectorAll(".storage-tab-btn").forEach(btn => {
    btn.classList.toggle("selected", btn.dataset.storageTab === storageState.activeTab);
  });
  const listTitle = document.getElementById("storage-list-title");
  const detailTitle = document.getElementById("storage-detail-title");
  if (listTitle) listTitle.textContent = storageState.activeTab === "mine" ? "My Posts" : "Saved Feeds";
  if (detailTitle) detailTitle.textContent = storageState.activeTab === "mine" ? "Selected Post" : "Selected Saved Post";
}

function getMyPostsForStorage() {
  const merged = new Map();
  getAllPosts()
    .filter(post => post.authorId === CURRENT_USER_ID)
    .forEach(post => merged.set(post.id, post));
  storageState.myPosts.forEach(post => merged.set(post.id, post));
  return [...merged.values()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function loadMyPostsForStorage() {
  if (storageState.isLoadingMine) return;
  storageState.isLoadingMine = true;
  try {
    const data = await apiRequest("/api/posts?mine=1&feed=new&limit=100");
    storageState.myPosts = normalizePostsResponse(data).map(normalizePost);
    storageState.myPosts.forEach(post => {
      if (!getPostById(post.id)) postStore.posts.push(post);
    });
    if (storageState.activeTab === "mine") {
      renderStorageList();
      renderStorageDetail();
      updateStorageSavedCount();
    }
  } catch (error) {
    console.warn("My posts history load failed:", error.message);
  } finally {
    storageState.isLoadingMine = false;
  }
}

function renderStorageList() {
  const list = document.getElementById("storage-saved-list");
  if (!list) return;

  const isMine = storageState.activeTab === "mine";
  const items = isMine ? getMyPostsForStorage() : getSavedPosts();
  if (items.length === 0) {
    list.innerHTML = `<p class="storage-meta">${isMine ? "No posts created by you yet. Publish one from Electrical." : "No saved posts found in data banks."}</p>`;
    return;
  }

  list.innerHTML = items.map(post => `
    <div class="storage-saved-item ${post.id === storageState.selectedPostId ? "selected" : ""}" onclick="selectStoragePost('${escapeInlineArg(post.id)}')">
      <p class="storage-meta">${normalizePostCategory(post.tag)} | ${getPostScoreLabel(post)} | ${new Date(post.createdAt).toLocaleDateString()}</p>
      <p><strong>${post.title}</strong></p>
      ${isMine ? `<p class="storage-meta">${getPostCommentCount(post)} comment${getPostCommentCount(post) === 1 ? "" : "s"}</p>` : ""}
    </div>
  `).join("");
}

function selectStoragePost(postId) {
  storageState.selectedPostId = postId;
  renderStorageList();
  renderStorageDetail();
}

function renderStorageDetail() {
  const meta = document.getElementById("storage-selected-meta");
  const detail = document.getElementById("storage-post-detail");
  const actions = document.getElementById("storage-post-actions");
  const removeButton = document.getElementById("storage-remove-bookmark-btn");
  const deleteButton = document.getElementById("storage-delete-post-btn");
  if (!meta || !detail || !actions) return;

  const post = getPostById(storageState.selectedPostId);
  if (!post) {
    meta.textContent = storageState.activeTab === "mine" ? "Select one of your posts to view details." : "Select a saved post to view details.";
    detail.innerHTML = `<p>${storageState.activeTab === "mine" ? "No authored transmission selected." : "No saved transmission selected."}</p>`;
    actions.style.display = "none";
    if (deleteButton) deleteButton.style.display = "none";
    return;
  }

  meta.textContent = `${normalizePostCategory(post.tag)} | ${getPostScoreLabel(post)} | ${getPostCommentCount(post)} comments | ${new Date(post.createdAt).toLocaleDateString()}`;
  detail.innerHTML = `
    <p style="font-weight:bold; margin:0 0 6px;">${post.title}</p>
    ${renderPostImage(post)}
    <p style="margin:0; font-size:13px; text-transform:none;">${post.body || "No details available."}</p>
  `;
  actions.style.display = "block";
  if (removeButton) removeButton.style.display = storageState.activeTab === "saved" ? "inline-flex" : "none";
  if (deleteButton) deleteButton.style.display = storageState.activeTab === "mine" && post.canDelete ? "inline-flex" : "none";
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
//Uhhhhhhhhhhhhhhh idk how to hide ts

window.addEventListener('load', () => {
  //heheheheh
  if (!document.getElementById('map-wrapper')) return;

  const easterCanvas = document.createElement('canvas');
  const eCtx = easterCanvas.getContext('2d', { willReadFrequently: true });
  const easterMapImg = new Image();
  easterMapImg.src = 'Assets/Map - Easter.png';

  easterMapImg.onload = () => {
    //The map loadation for click detection
    easterCanvas.width = (typeof worldWidth !== 'undefined' && worldWidth > 0) ? worldWidth : easterMapImg.width;
    easterCanvas.height = (typeof worldHeight !== 'undefined' && worldHeight > 0) ? worldHeight : easterMapImg.height;
    eCtx.drawImage(easterMapImg, 0, 0, easterCanvas.width, easterCanvas.height);
  };

  const targetMap = document.getElementById('map-wrapper');
  targetMap.addEventListener('click', (e) => {
    try {
      const rect = targetMap.getBoundingClientRect();
      const currentZoom = (typeof zoomLevel !== 'undefined') ? zoomLevel : 0.5;
      
      const clickX = (e.clientX - rect.left) / currentZoom;
      const clickY = (e.clientY - rect.top) / currentZoom;

      if (clickX >= 0 && clickX <= easterCanvas.width && clickY >= 0 && clickY <= easterCanvas.height) {
        const pixel = eCtx.getImageData(Math.floor(clickX), Math.floor(clickY), 1, 1).data;
        
        // Transparent regions terminator
        if (pixel[3] === 0) return;

        const hex = "#" + ((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2]).toString(16).slice(1).toUpperCase();
        
        // Pass 
        handleEasterEggTrigger(hex);
      }
    } catch (err) {
      console.error("Easter egg system read error safety catch:", err);
    }
  });
});

function handleEasterEggTrigger(hexColor) {
  const overlay = document.getElementById('terminal-overlay');
  const title = document.getElementById('terminal-title');
  const body = document.getElementById('terminal-body');

  if (!overlay || !body) return;

  if (window.currentEasterEggLoop) {
    cancelAnimationFrame(window.currentEasterEggLoop);
  }

  // FIX: Force the hidden class off so it actually appears!
  overlay.classList.remove('hidden');
  
  // FIX: Tell your base game loop that the terminal is open so the 
  // player stops moving in the background and 'F' to close works.
  if (typeof isTerminalOpen !== 'undefined') {
    isTerminalOpen = true; 
  }

  switch(hexColor) {
    case '#CF3476':
      title.innerText = "Navigation: Asteroid Dodge";
      initNavigationGame(body);
      break;
    case '#59351F':
      title.innerText = "Weapons: Tactical Blaster";
      initWeaponsGame(body);
      break;
    case '#25221B':
      title.innerText = "Emergency Systems";
      initEmergencySystem(body);
      break;
    case '#7E7B52':
      title.innerText = "Reactor: Memory Sequence";
      initReactorGame(body);
      break;
    case '#382C1E':
      title.innerText = "Comms: Subspace Memes";
      initCommsMemes(body);
      break;
    default:
      break;
  }
}


function initNavigationGame(container) {
  // Colllllllliiisiiiionnn Image
  const shipCollisionImg = new Image();
  shipCollisionImg.src = 'Assets/Ship - Collision.png'; 

  container.innerHTML = `
    <div style="position:relative; width:100%; height:300px; background:#02050c; overflow:hidden;">
      <canvas id="navGameCanvas" width="400" height="300" style="display:block; margin:0 auto; border:2px solid #555;"></canvas>
      <div id="restartContainer" style="display:none; position:absolute; top:120px; width:100%; text-align:center;">
        <button id="restartBtn" style="padding:10px 20px; font-size:16px; cursor:pointer; background:#ef3340; color:white; border:none; border-radius:5px;">Restart Game</button>
      </div>
    </div>
  `;

  const canvas = document.getElementById('navGameCanvas');
  const gameCtx = canvas.getContext('2d');
  

  const collisionCanvas = document.createElement('canvas');
  collisionCanvas.width = 40;
  collisionCanvas.height = 46;
  const colCtx = collisionCanvas.getContext('2d');

  shipCollisionImg.onload = () => {
    // Same dimensions
    colCtx.drawImage(shipCollisionImg, 0, 0, 40, 46);
  };

  let ship = { x: 180, y: 230, w: 40, h: 46 };
  let asteroids = [];
  let score = 0;
  let gameActive = true;

  const shipImg = new Image();
  shipImg.src = 'Assets/Ship.png';

  const keys = {};
  window.addEventListener('keydown', (e) => {
    if (isTextEntryTarget(e.target)) return;
    keys[e.key] = true;
  });
  window.addEventListener('keyup', (e) => {
    if (isTextEntryTarget(e.target)) return;
    keys[e.key] = false;
  });

  
  function checkCollision(targetWorldX, targetWorldY) {
    if (targetWorldX < 0 || targetWorldX + ship.w > canvas.width) return true;

    // Translateeee global coordinates down to local 40x46 canvas points
    let localX = Math.floor(targetWorldX - ship.x);
    let localY = Math.floor(targetWorldY - ship.y);

    // Safeguard lookup bounds
    if (localX < 0 || localX >= 40 || localY < 0 || localY >= 46) return false;

    const pixel = colCtx.getImageData(localX, localY, 1, 1).data;
    // True if hit matches blue 
    return (pixel[0] < 50 && pixel[1] < 50 && pixel[2] > 200);
  }

  function gameLoop() {
    if (!gameActive) return;
    gameCtx.clearRect(0, 0, canvas.width, canvas.height);

    if (keys['ArrowLeft'] && !checkCollision(ship.x - 4, ship.y + 20)) ship.x -= 4;
    if (keys['ArrowRight'] && !checkCollision(ship.x + 4, ship.y + 20)) ship.x += 4;

    gameCtx.drawImage(shipImg, ship.x, ship.y, ship.w, ship.h);

    if (Math.random() < 0.03) {
      asteroids.push({ x: Math.random() * (canvas.width - 20), y: -20, size: 20, speed: 3 });
    }

    for (let i = asteroids.length - 1; i >= 0; i--) {
      let a = asteroids[i];
      a.y += a.speed;
      gameCtx.fillStyle = '#7f8c8d';
      gameCtx.beginPath();
      gameCtx.arc(a.x, a.y, 10, 0, Math.PI * 2);
      gameCtx.fill();

      if (a.x < ship.x + ship.w && a.x + 20 > ship.x && a.y < ship.y + ship.h && a.y + 20 > ship.y) {
        gameActive = false;
        document.getElementById('restartContainer').style.display = 'block';
        gameCtx.fillStyle = '#ef3340';
        gameCtx.font = '20px sans-serif';
        gameCtx.fillText("CRASHED! Score: " + score, 120, 100);
      }
      if (a.y > canvas.height) { asteroids.splice(i, 1); score++; }
    }

    gameCtx.fillStyle = '#fff';
    gameCtx.font = '14px sans-serif';
    gameCtx.fillText("Score: " + score, 10, 20);
    
    if (gameActive) window.currentEasterEggLoop = requestAnimationFrame(gameLoop);
  }

  document.getElementById('restartBtn').onclick = () => {
    gameActive = true;
    score = 0;
    asteroids = [];
    ship.x = 180;
    document.getElementById('restartContainer').style.display = 'none';
    gameLoop();
  };

  shipImg.onload = () => gameLoop();
}
function initWeaponsGame(container) {
  container.innerHTML = `
    <div style="text-align:center; color:#fff; font-family:sans-serif;">
      <p style="margin:4px; color:#f39c12;">Target Goal: Zap RED targets. Avoid BLUE systems!</p>
      <canvas id="weaponCanvas" width="400" height="250" style="background:#000; border:2px solid #333; cursor:crosshair;"></canvas>
      <div id="wpnScore" style="margin-top:5px; font-weight:bold;">Score: 0</div>
    </div>
  `;
  const canvas = document.getElementById('weaponCanvas');
  const ctx = canvas.getContext('2d');
  let score = 0;
  let targets = [];

  function spawnTarget() {
    const isRed = Math.random() > 0.4;
    targets.push({
      x: Math.random() * (canvas.width - 30) + 15,
      y: Math.random() * (canvas.height - 30) + 15,
      r: 12,
      color: isRed ? '#ef3340' : '#0000ff',
      isRed: isRed,
      timer: 120 
    });
  }

  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    for (let i = targets.length - 1; i >= 0; i--) {
      let t = targets[i];
      let dist = Math.hypot(mx - t.x, my - t.y);
      if (dist < t.r) {
        if (t.isRed) score += 10;
        else score -= 15;
        targets.splice(i, 1);
        document.getElementById('wpnScore').innerText = "Score: " + score;
        break;
      }
    }
  });

  function update() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (Math.random() < 0.04 && targets.length < 5) spawnTarget();

    for (let i = targets.length - 1; i >= 0; i--) {
      let t = targets[i];
      t.timer--;
      
      ctx.fillStyle = t.color;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();

      if (t.timer <= 0) targets.splice(i, 1);
    }
    window.currentEasterEggLoop = requestAnimationFrame(update);
  }
  update();
}

function initEmergencySystem(container) {
  const randomPhrases = [
    "You stare at the button. It stares back. Riveting stuff.",
    "Just a dusty red button. Nothing to see here, keep moving.",
    "You press it, but it just goes *click*. Complete radio silence.",
    "Pretty sure ghosts don't file emergency reports.",
    "Congratulations on finding this easter egg yayyaayy!",
 "The button appreciates your concern but remains unhelpful.",
  "Emergency button.exe has encountered a severe lack of emergencies.",
  "Nothing happened. Exactly as designed.",
  "You expected alarms. You got disappointment.",
  "The button shrugs dramatically.",
  "Somewhere, a tumbleweed rolls by.",
  "The emergency team is currently imaginary.",
  "You push the button. The button pushes back emotionally.",
  "No sirens. No lights. Just vibes.",
  "This button has a strict no-work policy.",
  "A tiny voice whispers: 'Not implemented yet.'",
  "The button files your report directly into the void.",
  "404: Emergency not found.",
  "Achievement unlocked: Pressed the Useless Button.",
  "If this were a real emergency, we'd both be in trouble.",
  "The button is on its coffee break.",
  "You hear distant elevator music. Probably unrelated.",
  "This feature is powered by hopes and placeholders.",
  "You pressed it with confidence. Admirable.",
  "The button blinks internally.",
  "No emergencies detected. Carry on, citizen.",
  "The red paint adds at least +10 urgency.",
  "The button nods solemnly and does absolutely nothing.",
  "An intern is pretending to look into it.",
  "You found the world's least responsive panic button.",
  "Pressing it again won't help. But you can try.",
  "The button's warranty does not cover expectations.",
  "You feel slightly more prepared. The system does not.",
  "Some buttons launch rockets. This isn't one of them.",
  "Your click has been carefully ignored.",
  "The emergency owl is off duty.",
  "This button exists purely for dramatic effect.",
  "Task failed successfully.",
  "Instructions unclear. Emergency stuck in ceiling fan.",
  "Understandable. Have a nice day.",
  "We've tried nothing and we're all out of ideas.",
  "This is fine. 🔥🐶",
  "Panic.exe has stopped responding.",
  "Error 418: I'm a teapot, not an emergency service.",
  "Skill issue.",
  "The emergency button is currently buffering...",
  "Please clap.",
  "The button understood the assignment and chose violence. Just kidding, it did nothing.",
  "Congratulations, you've discovered premium disappointment.",
  "The button has entered goblin mode.",
  "Your emergency is important to us. Estimated wait time: ∞",
  "Loading consequences... 0%",
  "Button pressed. Expectations lowered.",
  "The button said 'bet' and then vanished emotionally.",
  "You pressed the button. The button said 'nah'.",
  "Emergency? In this economy?",
  "The button is built different. Unfortunately.",
  "No thoughts. Head empty. Button empty too.",
  "The button passed the vibe check. Functionality did not.",
  "This feature ships next quarter™.",
  "Coming soon since 2024.",
  "The button works on my machine.",
  "Your click has been forwarded to /dev/null.",
  "Button not found. Have you tried panicking harder?",
  "Press F to pay respects to this feature.",
  "We've escalated your concern directly to the void.",
  "The button is giving 404 energy.",
  "Low-key not an emergency button.",
  "The button ghosted your request.",
  "POV: You expected functionality.",
  "The button hit you with the classic 'new phone, who dis?'",
  "The emergency button left you on read.",
  "Certified bruh moment.",
  "The button is just here for the aesthetics.",
  "This button peaked in development.",
  "You unlocked: Hidden Feature (it's useless).",
  "The button said 'I ain't reading all that.'",
  "Emergency status: we ball.",
  "The button chose chaotic neutral.",
  "Your panic has been queued behind 37 other panics.",
  "The button is in its flop era.",
  "One does not simply summon help.",
  "You can tell it's serious because the button is red.",
  "This interaction has been rated: mildly concerning.",
  "The button posted an apology video and moved on.",
  "Your emergency has been successfully ignored.",
  "The button generated this response using 0% effort.",
  "The servers are running on hopes, dreams, and duct tape.",
  "The button would like to remain anonymous.",
  "You found an easter egg. Unfortunately, the egg is empty.",
  "The button is AFK.",
  "Outstanding move. Nothing happened."
];

  const roll = Math.random();
  if (roll > 0.10) {
    // 90% Normal Dead-Air Sequence
    const text = randomPhrases[Math.floor(Math.random() * randomPhrases.length)];
    container.innerHTML = `
      <div style="text-align:center; padding:40px; color:#fff; font-family:sans-serif;">
        <h2 style="color:#ef3340;">🚨 Emergency Console</h2>
        <p style="font-style:italic; margin-top:20px; color:#000000;">"${text}"</p>
      </div>
    `;
  } else {
    // 10% Jump-scare Emergency Red Alert Fakeout Event
    container.innerHTML = `
      <div id="emergencyAlarmScreen" style="text-align:center; padding:40px; color:#fff; background:#5a0000; animation: redFlash 0.5s infinite alternate; height:100%;">
        <h1 style="font-size:28px; margin:0; letter-spacing:2px;">🚨 EMERGENCY MEETING 🚨</h1>
        <p id="alarmSubtext" style="font-weight:bold; margin-top:30px; font-size:16px;">SABBING SYSTEMS IN PROGRESS...</p>
      </div>
      <style>
        @keyframes redFlash {
          0% { background: #5a0000; }
          100% { background: #b30000; }
        }
      </style>
    `;

    setTimeout(() => {
      const sub = document.getElementById('alarmSubtext');
      const screen = document.getElementById('emergencyAlarmScreen');
      if (sub && screen) {
        screen.style.animation = "none";
        screen.style.background = "#1a1a1a";
        sub.innerText = "..... oh wait, nevermind. System scans confirm 0 lifeforms around.";
      }
    }, 5000);
  }
}

function initReactorGame(container) {
  container.innerHTML = `
    <div style="text-align:center; color:#fff; font-family:sans-serif;">
      <p id="reactorHint" style="margin:5px; color:#2ecc71;">Watch the Reactor Sequence!</p>
      <div id="reactorGrid" style="display:grid; grid-template-columns: repeat(2, 70px); gap:10px; justify-content:center; margin:15px auto;">
        <div class="react-node" data-id="0" style="width:70px; height:70px; background:#1abc9c; border-radius:8px; cursor:pointer;"></div>
        <div class="react-node" data-id="1" style="width:70px; height:70px; background:#e67e22; border-radius:8px; cursor:pointer;"></div>
        <div class="react-node" data-id="2" style="width:70px; height:70px; background:#9b59b6; border-radius:8px; cursor:pointer;"></div>
        <div class="react-node" data-id="3" style="width:70px; height:70px; background:#34495e; border-radius:8px; cursor:pointer;"></div>
      </div>
    </div>
  `;

  const nodes = container.querySelectorAll('.react-node');
  let sequence = [Math.floor(Math.random()*4), Math.floor(Math.random()*4), Math.floor(Math.random()*4)];
  let userStep = 0;

  function flashSequence() {
    let i = 0;
    const interval = setInterval(() => {
      if (i >= sequence.length) {
        clearInterval(interval);
        if(document.getElementById('reactorHint')) document.getElementById('reactorHint').innerText = "Replicate Pattern Now!";
        return;
      }
      let targetNode = container.querySelector(`[data-id="${sequence[i]}"]`);
      let origBg = targetNode.style.background;
      targetNode.style.background = '#ffffff';
      setTimeout(() => targetNode.style.background = origBg, 300);
      i++;
    }, 600);
  }

  nodes.forEach(node => {
    node.addEventListener('click', (e) => {
      const clickedId = parseInt(e.target.getAttribute('data-id'));
      if (clickedId === sequence[userStep]) {
        userStep++;
        if (userStep === sequence.length) {
          document.getElementById('reactorHint').innerText = "🛠️ Reactor Core Stabilized!";
        }
      } else {
        document.getElementById('reactorHint').innerText = "❌ Meltdown Interrupted! Try again.";
        userStep = 0;
        setTimeout(flashSequence, 1000);
      }
    });
  });

  setTimeout(flashSequence, 500);
}

function initCommsMemes(container) {
  let currentMemeIndex = 1;
  container.innerHTML = `
    <div style="text-align:center; font-family:sans-serif; color:#fff;">
      <div style="min-height:180px; display:flex; align-items:center; justify-content:center; background:#111; border-radius:6px; padding:10px;">
        <img id="commsMemeDisplay" src="Memes/1.png" style="max-width:100%; max-height:160px; object-fit:contain;" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'100\\' height=\\'40\\'><text y=\\'25\\' fill=\\'white\\'>Meme Not Found</text></svg>'"/>
      </div>
      <button id="nextMemeBtn" class="dynamic-btn" style="margin-top:12px; padding:6px 16px; background:#0057b7; border:none; border-radius:4px; color:#white;">Download Next Log Entry</button>
    </div>
  `;

  const imgDisplay = document.getElementById('commsMemeDisplay');
  const btn = document.getElementById('nextMemeBtn');

  btn.addEventListener('click', () => {
    currentMemeIndex++;
    // Seamless rollover setup loop or manual indexing up to your folder bounds
    if (currentMemeIndex > 30) currentMemeIndex = 1; 
    imgDisplay.src = `Memes/${currentMemeIndex}.png`;
  });
}
