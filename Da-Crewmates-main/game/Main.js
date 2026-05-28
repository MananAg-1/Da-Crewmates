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
      }
    }

    function enterPlatform() {
      landingView.classList.add('hidden');
      appView.classList.remove('hidden');
      isSystemActive = true;
      requestAnimationFrame(gameLoop);
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
      const offsetX = (window.innerWidth / 2) - (worldX * zoomLevel);
      const offsetY = (window.innerHeight / 2) - (worldY * zoomLevel);
      mapWrapper.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${zoomLevel})`;
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
      } else if (hexKey === "755c48") {
        initMedbayAnalytics();
      } else if (hexKey === "00ffff") {
        initCommunicationsHub();
      } else if (hexKey === "ff0000") {
        initNavigationHelpHub();
      } else if (hexKey === "ffff00") {
        initShieldsPrivacyHub();
      } else if (hexKey === "636b2f") {
        initAdminProfileHub();
      } else if (hexKey === "641c34") {
        initReactorHub();
      } else if (hexKey === "ffa420") {
        initSecurityHub();
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

const cafeteriaState = {
  selectedPostId: null,
  posts: [],
  visibleCount: 3,
  carouselStart: 0
};

function initCafeteriaBoard() {
  cafeteriaState.posts = [
    {
      id: 1,
      tag: "Space",
      title: "Which planetary mission gave the biggest science return in the last decade?",
      detail: "Consider mission duration, instrument quality, open data access, and how much each mission changed classroom-level understanding of planets and moons.",
      likes: 1242,
      comments: ["Anon: Cassini transformed Saturn science across multiple fields.", "Anon: Juno data reshaped our understanding of Jupiter's interior."]
    },
    {
      id: 2,
      tag: "Space",
      title: "What is one space fact that sounds impossible but is well established?",
      detail: "Share one verified observation and include a short explanation for why it happens physically, so new readers can follow without deep math.",
      likes: 987,
      comments: ["Anon: A day on Venus is longer than its year due to slow retrograde rotation.", "Anon: Time dilation from gravity is measurable with atomic clocks."]
    },
    {
      id: 3,
      tag: "Space",
      title: "Which unresolved question in astronomy should get priority funding?",
      detail: "Pick one major open problem and argue from impact: dark matter, early galaxy formation, exoplanet atmospheres, or something else.",
      likes: 763,
      comments: ["Anon: Exoplanet atmosphere chemistry could change the search for life.", "Anon: Dark matter constraints still affect almost every cosmology model."]
    },
    {
      id: 4,
      tag: "Space",
      title: "How should we balance human spaceflight vs robotic exploration budgets?",
      detail: "Discuss scientific output, risk, public engagement, and long-term infrastructure. Try comparing mission classes instead of absolute yes/no positions.",
      likes: 541,
      comments: ["Anon: Robots are higher cadence science tools for the same cost band.", "Anon: Human missions accelerate systems engineering breakthroughs."]
    },
    {
      id: 5,
      tag: "Space",
      title: "What are the biggest technical blockers for long-duration lunar habitats?",
      detail: "Focus on radiation shielding, dust mitigation, closed-loop life support, and maintenance logistics in low-gravity environments.",
      likes: 428,
      comments: ["Anon: Lunar regolith dust control is underestimated in many public discussions.", "Anon: Reliable water recycling and redundancy will be mission critical."]
    },
    {
      id: 6,
      tag: "Space",
      title: "Which telescope era do you think will define the next 20 years?",
      detail: "Compare near-term impact of JWST follow-ups, Roman Space Telescope surveys, and upcoming ground observatories in multi-messenger astronomy.",
      likes: 312,
      comments: ["Anon: Roman's wide-field surveys could unlock major cosmology insights.", "Anon: Ground-based spectroscopy will remain essential for interpretation."]
    }
  ];

  cafeteriaState.posts.sort((a, b) => b.likes - a.likes);
  cafeteriaState.visibleCount = 3;
  cafeteriaState.carouselStart = 0;
  cafeteriaState.selectedPostId = cafeteriaState.posts[0].id;
  renderCafeteriaFeed();
  renderCafeteriaDetail();
}

function renderCafeteriaFeed() {
  const feedEl = document.getElementById('cafeteria-feed-list');
  if (!feedEl) return;

  feedEl.innerHTML = '';
  const endIndex = cafeteriaState.carouselStart + cafeteriaState.visibleCount;
  cafeteriaState.posts.slice(cafeteriaState.carouselStart, endIndex).forEach((post) => {
    const item = document.createElement('article');
    item.className = 'cafeteria-feed-item';
    if (post.id === cafeteriaState.selectedPostId) item.classList.add('selected');
    item.onclick = () => selectCafeteriaPost(post.id);

    item.innerHTML = `
      <p class="cafeteria-meta">${post.tag} | ${post.likes} likes</p>
      <p>${post.title}</p>
    `;
    feedEl.appendChild(item);
  });
}

function renderCafeteriaDetail() {
  const detailEl = document.getElementById('cafeteria-thread-detail');
  const metaEl = document.getElementById('cafeteria-selected-meta');
  if (!detailEl || !metaEl) return;

  const post = cafeteriaState.posts.find((item) => item.id === cafeteriaState.selectedPostId);
  if (!post) return;

  metaEl.textContent = `Selected: ${post.likes} likes | ${post.comments.length} comments`;
  detailEl.innerHTML = `
    <div class="cafeteria-thread-card">
      <p class="cafeteria-section-label">Post</p>
      <p><strong>${post.title}</strong></p>
      <p style="margin-top:8px;">${post.detail}</p>
    </div>
    <div class="cafeteria-comment-list">
      <p class="cafeteria-section-label">Comments</p>
      ${post.comments.map((comment) => `<div class="cafeteria-comment-item"><p>${comment}</p></div>`).join('')}
    </div>
  `;
}

function selectCafeteriaPost(postId) {
  cafeteriaState.selectedPostId = postId;
  renderCafeteriaFeed();
  renderCafeteriaDetail();

  const threadSection = document.getElementById('cafeteria-thread-section');
  if (threadSection) {
    threadSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function voteOnCafeteriaPost(direction) {
  const post = cafeteriaState.posts.find((item) => item.id === cafeteriaState.selectedPostId);
  if (!post) return;
  post.likes += direction === 'up' ? 1 : -1;
  if (post.likes < 0) post.likes = 0;
  cafeteriaState.posts.sort((a, b) => b.likes - a.likes);
  renderCafeteriaFeed();
  renderCafeteriaDetail();
}

function addCafeteriaComment() {
  const inputEl = document.getElementById('cafeteria-comment-input');
  const post = cafeteriaState.posts.find((item) => item.id === cafeteriaState.selectedPostId);
  if (!inputEl || !post) return;

  const text = inputEl.value.trim();
  if (!text) return;
  post.comments.push(`Anon: ${text}`);
  inputEl.value = '';
  renderCafeteriaDetail();
}

function shuffleCafeteriaFeed() {
  cafeteriaState.posts.sort(() => Math.random() - 0.5);
  cafeteriaState.carouselStart = 0;
  renderCafeteriaFeed();
}

function moveCafeteriaCarousel(direction) {
  const maxStart = Math.max(0, cafeteriaState.posts.length - cafeteriaState.visibleCount);
  let nextStart = cafeteriaState.carouselStart + (direction * cafeteriaState.visibleCount);

  if (nextStart < 0) nextStart = 0;
  if (nextStart > maxStart) nextStart = maxStart;

  cafeteriaState.carouselStart = nextStart;
  renderCafeteriaFeed();
}

const medbayState = {
  activeRange: "day",
  ranges: {
    day: {
      focus: 78,
      stats: [
        { label: "Usage Time", value: "1h 42m", trend: "+18m from last visit" },
        { label: "Posts Viewed", value: "34", trend: "12 in Cafeteria" },
        { label: "Messages", value: "7", trend: "3 unread cleared" },
        { label: "Zones Visited", value: "5", trend: "Admin most recent" }
      ],
      zones: [
        { name: "Cafeteria", percent: 34, color: "#00d4ff" },
        { name: "Communications", percent: 24, color: "#0f766e" },
        { name: "Admin", percent: 18, color: "#ef3340" },
        { name: "Navigation", percent: 14, color: "#8338ec" },
        { name: "Shields", percent: 10, color: "#f6c243" }
      ],
      signals: [
        { label: "Scroll Pace", value: "Steady", percent: 72 },
        { label: "Reply Speed", value: "Fast", percent: 84 },
        { label: "Explore Balance", value: "Healthy", percent: 68 }
      ],
      notes: ["Peak activity near Communications.", "Profile settings updated this session.", "Usage pattern is balanced across social and utility zones."]
    },
    week: {
      focus: 84,
      stats: [
        { label: "Usage Time", value: "8h 15m", trend: "+11% this week" },
        { label: "Posts Viewed", value: "221", trend: "48 liked threads" },
        { label: "Messages", value: "63", trend: "18 replies sent" },
        { label: "Zones Visited", value: "9", trend: "Shields newly active" }
      ],
      zones: [
        { name: "Cafeteria", percent: 29, color: "#00d4ff" },
        { name: "Communications", percent: 26, color: "#0f766e" },
        { name: "Navigation", percent: 17, color: "#8338ec" },
        { name: "Admin", percent: 16, color: "#ef3340" },
        { name: "Shields", percent: 12, color: "#f6c243" }
      ],
      signals: [
        { label: "Scroll Pace", value: "Focused", percent: 80 },
        { label: "Reply Speed", value: "Reliable", percent: 76 },
        { label: "Explore Balance", value: "Strong", percent: 88 }
      ],
      notes: ["Best focus score came after shorter sessions.", "Most interactions came from message replies.", "Privacy check completed in Shields."]
    },
    month: {
      focus: 81,
      stats: [
        { label: "Usage Time", value: "31h 08m", trend: "11 active days" },
        { label: "Posts Viewed", value: "914", trend: "Top topic: space" },
        { label: "Messages", value: "248", trend: "92% response rate" },
        { label: "Zones Visited", value: "12", trend: "Full station coverage" }
      ],
      zones: [
        { name: "Cafeteria", percent: 31, color: "#00d4ff" },
        { name: "Communications", percent: 22, color: "#0f766e" },
        { name: "Admin", percent: 15, color: "#ef3340" },
        { name: "Navigation", percent: 14, color: "#8338ec" },
        { name: "Other Zones", percent: 18, color: "#6c757d" }
      ],
      signals: [
        { label: "Scroll Pace", value: "Stable", percent: 74 },
        { label: "Reply Speed", value: "Consistent", percent: 79 },
        { label: "Explore Balance", value: "Complete", percent: 91 }
      ],
      notes: ["Cafeteria remains the strongest engagement zone.", "Message activity is consistent across the month.", "Exploration coverage improved after Navigation upgrades."]
    }
  }
};

function initMedbayAnalytics() {
  renderMedbayAnalytics();
}

function setMedbayRange(range) {
  if (!medbayState.ranges[range]) return;
  medbayState.activeRange = range;
  renderMedbayAnalytics();
}

function renderMedbayAnalytics() {
  const data = medbayState.ranges[medbayState.activeRange];
  const score = document.getElementById("medbay-focus-score");
  const statGrid = document.getElementById("medbay-stat-grid");
  const zoneList = document.getElementById("medbay-zone-list");
  const signalList = document.getElementById("medbay-signal-list");
  const noteList = document.getElementById("medbay-note-list");
  if (!data || !score || !statGrid || !zoneList || !signalList || !noteList) return;

  score.textContent = data.focus;

  document.querySelectorAll(".medbay-tab").forEach((tab) => {
    tab.classList.toggle("selected", tab.dataset.range === medbayState.activeRange);
  });

  statGrid.innerHTML = data.stats
    .map((stat) => `<article class="medbay-stat-card"><p>${stat.label}</p><strong>${stat.value}</strong><span>${stat.trend}</span></article>`)
    .join("");

  zoneList.innerHTML = data.zones
    .map((zone) => `
      <div class="medbay-zone-item">
        <div><strong>${zone.name}</strong><span>${zone.percent}%</span></div>
        <div class="dynamic-progress-bar"><div class="dynamic-progress-fill" style="width:${zone.percent}%; background:${zone.color};"></div></div>
      </div>
    `)
    .join("");

  signalList.innerHTML = data.signals
    .map((signal) => `
      <div class="medbay-signal-item">
        <div><strong>${signal.label}</strong><span>${signal.value}</span></div>
        <div class="dynamic-progress-bar"><div class="dynamic-progress-fill" style="width:${signal.percent}%; background:#0f766e;"></div></div>
      </div>
    `)
    .join("");

  noteList.innerHTML = data.notes
    .map((note) => `<div class="medbay-note-item">${note}</div>`)
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
  profileSaved: false
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
async function loadCafeteriaApod() {
  const imageEl = document.getElementById('cafeteria-apod-image');
  const titleEl = document.getElementById('cafeteria-apod-title');
  const metaEl = document.getElementById('cafeteria-apod-meta');
  const linkEl = document.getElementById('cafeteria-apod-link');
  if (!imageEl || !titleEl || !metaEl || !linkEl) return;

  try {
    const localRes = await fetch('http://localhost:4000/api/space/apod');
    if (!localRes.ok) throw new Error(`Local backend unavailable: ${localRes.status}`);
    const payload = await localRes.json();
    const apod = payload && payload.data ? payload.data : null;
    applyApodToCard(apod, imageEl, titleEl, metaEl, linkEl);
  } catch (err) {
    try {
      const fallbackRes = await fetch('https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY');
      if (!fallbackRes.ok) throw new Error(`NASA fallback failed: ${fallbackRes.status}`);
      const apod = await fallbackRes.json();
      applyApodToCard(apod, imageEl, titleEl, metaEl, linkEl);
    } catch (fallbackErr) {
      metaEl.textContent = 'APOD feed unavailable right now.';
      console.error('APOD load error:', err, fallbackErr);
    }
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



// =========================
// REACTOR HUB
// =========================

const reactorState = {
  zoneActivity: [
    { name: "Cafeteria", visits: 142, color: "#00d4ff" },
    { name: "Communications", visits: 98, color: "#0f766e" },
    { name: "Admin", visits: 74, color: "#ef3340" },
    { name: "Navigation", visits: 61, color: "#8338ec" },
    { name: "Shields", visits: 43, color: "#f6c243" },
    { name: "MedBay", visits: 38, color: "#10b981" }
  ],
  events: [
    { type: "ok", text: "All zone terminals loaded successfully." },
    { type: "ok", text: "APOD feed integration refreshed." },
    { type: "warn", text: "Backend API response time elevated briefly." },
    { type: "ok", text: "Auth session verified for active crew." },
    { type: "ok", text: "Navigation zoning canvas rendered without fault." },
    { type: "warn", text: "Cafeteria carousel index reset after shuffle." }
  ]
};

function initReactorHub() {
  renderReactorStats();
  renderReactorZoneActivity();
  renderReactorEventLog();
}

function renderReactorStats() {
  const visitors = document.getElementById("reactor-visitors");
  const active = document.getElementById("reactor-active");
  if (visitors) visitors.textContent = reactorState.zoneActivity.reduce((sum, z) => sum + z.visits, 0);
  if (active) active.textContent = Math.floor(Math.random() * 12) + 4;
}

function renderReactorZoneActivity() {
  const list = document.getElementById("reactor-zone-activity");
  if (!list) return;

  const max = Math.max(...reactorState.zoneActivity.map(z => z.visits));

  list.innerHTML = reactorState.zoneActivity.map(zone => `
    <div class="reactor-item">
      <strong>${zone.name}</strong>
      <div style="flex:1; margin: 0 10px;">
        <div class="dynamic-progress-bar">
          <div class="dynamic-progress-fill" style="width:${Math.round((zone.visits / max) * 100)}%; background:${zone.color};"></div>
        </div>
      </div>
      <span>${zone.visits} visits</span>
    </div>
  `).join("");
}

function renderReactorEventLog() {
  const log = document.getElementById("reactor-event-log");
  if (!log) return;

  log.innerHTML = reactorState.events.map(ev => `
    <div class="reactor-event-item ${ev.type === "ok" ? "ok" : ""}">
      <span>${ev.type === "ok" ? "OK" : "!"}</span>
      <p>${ev.text}</p>
    </div>
  `).join("");
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