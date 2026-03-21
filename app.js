(function () {
  "use strict";

  // ===== DOM refs =====
  const editorView = document.getElementById("editor-view");
  const prompterView = document.getElementById("prompter-view");
  const scriptSelect = document.getElementById("script-select");
  const scriptName = document.getElementById("script-name");
  const scriptText = document.getElementById("script-text");
  const btnSave = document.getElementById("btn-save");
  const btnDelete = document.getElementById("btn-delete");
  const fontSizeRange = document.getElementById("font-size-range");
  const fontSizeVal = document.getElementById("font-size-val");
  const speedRange = document.getElementById("speed-range");
  const speedVal = document.getElementById("speed-val");
  const mirrorToggle = document.getElementById("mirror-toggle");
  const countdownToggle = document.getElementById("countdown-toggle");
  const btnStart = document.getElementById("btn-start");

  const countdownOverlay = document.getElementById("countdown-overlay");
  const countdownNumber = document.getElementById("countdown-number");
  const prompterWrap = document.getElementById("prompter-wrap");
  const prompterText = document.getElementById("prompter-text");
  const progressFill = document.getElementById("progress-fill");
  const controlsOverlay = document.getElementById("controls-overlay");
  const tapZone = document.getElementById("tap-zone");
  const btnBack = document.getElementById("btn-back");
  const btnMirrorLive = document.getElementById("btn-mirror-live");
  const btnPlay = document.getElementById("btn-play");
  const iconPlay = document.getElementById("icon-play");
  const iconPause = document.getElementById("icon-pause");
  const btnSpeedDown = document.getElementById("btn-speed-down");
  const btnSpeedUp = document.getElementById("btn-speed-up");
  const speedLiveVal = document.getElementById("speed-live-val");
  const btnSizeDown = document.getElementById("btn-size-down");
  const btnSizeUp = document.getElementById("btn-size-up");
  const sizeLiveVal = document.getElementById("size-live-val");

  // ===== State =====
  let settings = {
    fontSize: 42,
    speed: 60,
    mirror: false,
    countdown: true,
  };
  let scrollPos = 0;
  let isPlaying = false;
  let lastFrameTime = 0;
  let animFrameId = null;
  let wakeLock = null;
  let controlsTimer = null;
  let maxScroll = 0;

  const STORAGE_SCRIPTS = "tp_scripts";
  const STORAGE_SETTINGS = "tp_settings";

  // ===== Guide line element =====
  const guideLine = document.createElement("div");
  guideLine.className = "guide-line";
  prompterWrap.appendChild(guideLine);

  // ===== Persistence =====

  function loadScripts() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_SCRIPTS)) || {};
    } catch {
      return {};
    }
  }

  function saveScripts(scripts) {
    localStorage.setItem(STORAGE_SCRIPTS, JSON.stringify(scripts));
  }

  function loadSettings() {
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_SETTINGS));
      if (s) Object.assign(settings, s);
    } catch {
      // use defaults
    }
  }

  function persistSettings() {
    localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(settings));
  }

  // ===== Script Management =====

  function refreshScriptList() {
    const scripts = loadScripts();
    const keys = Object.keys(scripts).sort();

    while (scriptSelect.options.length > 1) {
      scriptSelect.remove(1);
    }

    keys.forEach((name) => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      scriptSelect.appendChild(opt);
    });
  }

  function loadSelectedScript() {
    const key = scriptSelect.value;
    if (key === "__new__") {
      scriptName.value = "";
      scriptText.value = "";
    } else {
      const scripts = loadScripts();
      scriptName.value = key;
      scriptText.value = scripts[key] || "";
    }
  }

  scriptSelect.addEventListener("change", loadSelectedScript);

  btnSave.addEventListener("click", () => {
    const name = scriptName.value.trim();
    const text = scriptText.value;
    if (!name) {
      scriptName.focus();
      scriptName.style.borderColor = "var(--danger)";
      setTimeout(() => (scriptName.style.borderColor = ""), 1500);
      return;
    }
    const scripts = loadScripts();
    scripts[name] = text;
    saveScripts(scripts);
    refreshScriptList();
    scriptSelect.value = name;
  });

  btnDelete.addEventListener("click", () => {
    const key = scriptSelect.value;
    if (key === "__new__") return;
    if (!confirm(`Delete "${key}"?`)) return;
    const scripts = loadScripts();
    delete scripts[key];
    saveScripts(scripts);
    refreshScriptList();
    scriptSelect.value = "__new__";
    loadSelectedScript();
  });

  // ===== Settings Sync =====

  function syncSettingsToUI() {
    fontSizeRange.value = settings.fontSize;
    fontSizeVal.textContent = settings.fontSize + "px";
    speedRange.value = settings.speed;
    speedVal.textContent = settings.speed;
    mirrorToggle.checked = settings.mirror;
    countdownToggle.checked = settings.countdown;
  }

  fontSizeRange.addEventListener("input", () => {
    settings.fontSize = parseInt(fontSizeRange.value);
    fontSizeVal.textContent = settings.fontSize + "px";
    persistSettings();
  });

  speedRange.addEventListener("input", () => {
    settings.speed = parseInt(speedRange.value);
    speedVal.textContent = settings.speed;
    persistSettings();
  });

  mirrorToggle.addEventListener("change", () => {
    settings.mirror = mirrorToggle.checked;
    persistSettings();
  });

  countdownToggle.addEventListener("change", () => {
    settings.countdown = countdownToggle.checked;
    persistSettings();
  });

  // ===== View Switching =====

  function showView(view) {
    editorView.classList.remove("active");
    prompterView.classList.remove("active");
    view.classList.add("active");
  }

  // ===== Prompter Engine =====

  function computeMaxScroll() {
    maxScroll = Math.max(0, prompterText.scrollHeight - window.innerHeight * 0.35);
  }

  function updateProgress() {
    if (maxScroll <= 0) {
      progressFill.style.width = "0%";
      return;
    }
    const pct = Math.min(100, (scrollPos / maxScroll) * 100);
    progressFill.style.width = pct + "%";
  }

  function applyScroll() {
    prompterText.style.transform = `translateY(-${scrollPos}px)`;
    updateProgress();
  }

  function scrollLoop(timestamp) {
    if (isPlaying) {
      const dt = timestamp - lastFrameTime;
      scrollPos += settings.speed * (dt / 1000);
      if (scrollPos >= maxScroll) {
        scrollPos = maxScroll;
        pauseScroll();
      }
      applyScroll();
    }
    lastFrameTime = timestamp;
    animFrameId = requestAnimationFrame(scrollLoop);
  }

  function startScroll() {
    isPlaying = true;
    iconPlay.classList.add("hidden");
    iconPause.classList.remove("hidden");
    acquireWakeLock();
  }

  function pauseScroll() {
    isPlaying = false;
    iconPlay.classList.remove("hidden");
    iconPause.classList.add("hidden");
  }

  function togglePlay() {
    if (isPlaying) {
      pauseScroll();
    } else {
      startScroll();
    }
  }

  function resetPrompter() {
    scrollPos = 0;
    isPlaying = false;
    lastFrameTime = 0;
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
    releaseWakeLock();
    iconPlay.classList.remove("hidden");
    iconPause.classList.add("hidden");
    progressFill.style.width = "0%";
    prompterText.style.transform = "translateY(0)";
  }

  // ===== Wake Lock =====

  async function acquireWakeLock() {
    if (wakeLock) return;
    try {
      if ("wakeLock" in navigator) {
        wakeLock = await navigator.wakeLock.request("screen");
        wakeLock.addEventListener("release", () => {
          wakeLock = null;
        });
      }
    } catch {
      // wake lock not available or denied
    }
  }

  function releaseWakeLock() {
    if (wakeLock) {
      wakeLock.release();
      wakeLock = null;
    }
  }

  // Re-acquire wake lock when page becomes visible again
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && isPlaying) {
      acquireWakeLock();
    }
  });

  // ===== Countdown =====

  function runCountdown() {
    return new Promise((resolve) => {
      if (!settings.countdown) {
        resolve();
        return;
      }
      countdownOverlay.classList.remove("hidden");
      let count = 3;
      countdownNumber.textContent = count;

      const interval = setInterval(() => {
        count--;
        if (count <= 0) {
          clearInterval(interval);
          countdownOverlay.classList.add("hidden");
          resolve();
        } else {
          countdownNumber.textContent = count;
        }
      }, 1000);
    });
  }

  // ===== Controls Visibility =====

  function showControls() {
    controlsOverlay.classList.remove("hidden");
    resetControlsTimer();
  }

  function hideControls() {
    controlsOverlay.classList.add("hidden");
  }

  function resetControlsTimer() {
    clearTimeout(controlsTimer);
    controlsTimer = setTimeout(() => {
      if (isPlaying) hideControls();
    }, 3000);
  }

  // ===== Start Prompting =====

  btnStart.addEventListener("click", async () => {
    const text = scriptText.value.trim();
    if (!text) {
      scriptText.focus();
      scriptText.style.borderColor = "var(--danger)";
      setTimeout(() => (scriptText.style.borderColor = ""), 1500);
      return;
    }

    prompterText.textContent = text;
    prompterText.style.fontSize = settings.fontSize + "px";
    prompterText.classList.toggle("mirror", settings.mirror);

    speedLiveVal.textContent = settings.speed;
    sizeLiveVal.textContent = settings.fontSize;

    resetPrompter();
    showView(prompterView);

    // Let DOM settle, then compute max scroll
    await new Promise((r) => requestAnimationFrame(r));
    computeMaxScroll();
    applyScroll();

    await runCountdown();

    showControls();
    lastFrameTime = performance.now();
    animFrameId = requestAnimationFrame(scrollLoop);
    startScroll();
  });

  // ===== Prompter Controls =====

  tapZone.addEventListener("click", () => {
    togglePlay();
    showControls();
  });

  btnPlay.addEventListener("click", (e) => {
    e.stopPropagation();
    togglePlay();
    resetControlsTimer();
  });

  btnBack.addEventListener("click", (e) => {
    e.stopPropagation();
    resetPrompter();
    showView(editorView);
  });

  btnMirrorLive.addEventListener("click", (e) => {
    e.stopPropagation();
    settings.mirror = !settings.mirror;
    prompterText.classList.toggle("mirror", settings.mirror);
    mirrorToggle.checked = settings.mirror;
    persistSettings();
    resetControlsTimer();
  });

  btnSpeedDown.addEventListener("click", (e) => {
    e.stopPropagation();
    settings.speed = Math.max(10, settings.speed - 10);
    speedLiveVal.textContent = settings.speed;
    speedRange.value = settings.speed;
    speedVal.textContent = settings.speed;
    persistSettings();
    resetControlsTimer();
  });

  btnSpeedUp.addEventListener("click", (e) => {
    e.stopPropagation();
    settings.speed = Math.min(200, settings.speed + 10);
    speedLiveVal.textContent = settings.speed;
    speedRange.value = settings.speed;
    speedVal.textContent = settings.speed;
    persistSettings();
    resetControlsTimer();
  });

  btnSizeDown.addEventListener("click", (e) => {
    e.stopPropagation();
    settings.fontSize = Math.max(24, settings.fontSize - 4);
    prompterText.style.fontSize = settings.fontSize + "px";
    sizeLiveVal.textContent = settings.fontSize;
    fontSizeRange.value = settings.fontSize;
    fontSizeVal.textContent = settings.fontSize + "px";
    computeMaxScroll();
    persistSettings();
    resetControlsTimer();
  });

  btnSizeUp.addEventListener("click", (e) => {
    e.stopPropagation();
    settings.fontSize = Math.min(96, settings.fontSize + 4);
    prompterText.style.fontSize = settings.fontSize + "px";
    sizeLiveVal.textContent = settings.fontSize;
    fontSizeRange.value = settings.fontSize;
    fontSizeVal.textContent = settings.fontSize + "px";
    computeMaxScroll();
    persistSettings();
    resetControlsTimer();
  });

  // Handle window resize (e.g. orientation change)
  window.addEventListener("resize", () => {
    if (prompterView.classList.contains("active")) {
      computeMaxScroll();
    }
  });

  // Handle Android back button (popstate)
  window.addEventListener("popstate", () => {
    if (prompterView.classList.contains("active")) {
      resetPrompter();
      showView(editorView);
    }
  });

  // Push state when entering prompter to enable back-button handling
  const origStartClick = btnStart.onclick;
  btnStart.addEventListener("click", () => {
    history.pushState({ view: "prompter" }, "");
  });

  // ===== Init =====

  loadSettings();
  syncSettingsToUI();
  refreshScriptList();

  // Register service worker
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
