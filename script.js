document.addEventListener("DOMContentLoaded", () => {
  const servoGrid = document.querySelector(".servo-grid");
  const logsList = document.querySelector(".logs-list");
  const watchdogValue = document.getElementById("watchdog-value");
  const watchdogProgress = document.getElementById("watchdog-progress");
  const watchdogStatus = document.getElementById("watchdog-status");
  const watchdogStatusContainer = document.querySelector(".timer-status");
  const heartbeat = document.getElementById("heartbeat");

  const API_BASE =
    location.hostname === "127.0.0.1" || location.hostname === "localhost"
      ? "http://172.20.10.7:3000"
      : `${location.protocol}//${location.host}`;
  const API_URL = `${API_BASE}/api/data`;

  const SLEEP_ICON = "&#x1F319;"; // moon
  const ACTIVE_ICON = "&#x1F4F6;"; // wifi signal
  const STATUS_CLASSES = ["is-active", "is-sleeping", "is-unknown", "is-disconnected"];
  const VALUE_CLASSES = ["is-active", "is-sleeping", "is-unknown", "is-disconnected"];
  const servoNames = ["Servo 1", "Servo 2", "Servo 3", "Servo 4", "Servo 5", "Servo 6"];

  let lastSleepState = null;
  let waitingLogged = false;

  servoNames.forEach((name, index) => {
    const div = document.createElement("div");
    div.className = "servo-item";
    div.innerHTML = `
      <div class="servo-header">
        <span class="servo-name">${name}</span>
        <span class="servo-angle" id="angle-${index}">--</span>
      </div>
      <div class="progress-bar">
        <div class="progress-bar-fill" id="progress-${index}"></div>
      </div>
    `;
    servoGrid.appendChild(div);
  });

  function addLog(message) {
    const entry = document.createElement("li");
    entry.innerHTML = `<span class="timestamp">${new Date().toLocaleTimeString()}</span> ${message}`;
    logsList.prepend(entry);
    if (logsList.children.length > 30) {
      logsList.lastChild.remove();
    }
  }

  function setSleepDisplay(mode) {
    STATUS_CLASSES.forEach((cls) => watchdogStatusContainer.classList.remove(cls));
    VALUE_CLASSES.forEach((cls) => watchdogValue.classList.remove(cls));
    watchdogProgress.classList.remove("is-sleeping");

    switch (mode) {
      case "sleep":
        watchdogValue.innerHTML = SLEEP_ICON;
        watchdogValue.classList.add("is-sleeping");
        watchdogStatus.textContent = "sleep";
        watchdogProgress.classList.add("is-sleeping");
        watchdogProgress.style.width = "100%";
        watchdogStatusContainer.classList.add("is-sleeping");
        break;
      case "awake":
        watchdogValue.innerHTML = ACTIVE_ICON;
        watchdogValue.classList.add("is-active");
        watchdogStatus.textContent = "active";
        watchdogProgress.style.width = "0%";
        watchdogStatusContainer.classList.add("is-active");
        break;
      case "disconnected":
        watchdogValue.textContent = "--";
        watchdogValue.classList.add("is-disconnected");
        watchdogStatus.textContent = "Disconnected";
        watchdogProgress.style.width = "0%";
        watchdogStatusContainer.classList.add("is-disconnected");
        break;
      default:
        watchdogValue.textContent = "--";
        watchdogValue.classList.add("is-unknown");
        watchdogStatus.textContent = "Awaiting sleep status";
        watchdogProgress.style.width = "0%";
        watchdogStatusContainer.classList.add("is-unknown");
        break;
    }
  }

  function updateHeartbeat(state) {
    switch (state) {
      case "sleep":
        heartbeat.textContent = "Sleeping";
        heartbeat.style.color = "#f39c12";
        break;
      case "awake":
        heartbeat.textContent = "Active";
        heartbeat.style.color = "#2ecc71";
        break;
      case "pending":
        heartbeat.textContent = "Pending";
        heartbeat.style.color = "#adb5bd";
        break;
      default:
        heartbeat.textContent = "Disconnected";
        heartbeat.style.color = "#dc3545";
        break;
    }
  }

  async function updateDashboard() {
    try {
      const response = await fetch(API_URL);
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const data = await response.json();
      const hasPayload = data && Object.keys(data).length > 0;

      if (!hasPayload) {
        if (!waitingLogged) {
          addLog("Waiting for ESP32 data...");
          waitingLogged = true;
        }
        setSleepDisplay("unknown");
        updateHeartbeat("pending");
        return;
      }

      waitingLogged = false;

      for (let i = 1; i <= 6; i += 1) {
        const rawValue = Number.parseFloat(data[`servo${i}`]);
        const angle = Number.isFinite(rawValue) ? Math.max(0, Math.min(rawValue, 180)) : null;
        const angleEl = document.getElementById(`angle-${i - 1}`);
        const progressEl = document.getElementById(`progress-${i - 1}`);

        if (angleEl) {
          angleEl.textContent = angle !== null ? `${angle.toFixed(1)}\u00B0` : "--";
        }
        if (progressEl) {
          progressEl.style.width = angle !== null ? `${(angle / 180) * 100}%` : "0%";
        }
      }

      const voltageRaw = data.voltage;
      const voltageNumber = Number.isFinite(voltageRaw)
        ? voltageRaw
        : Number.parseFloat(voltageRaw);
      const firmwareLabel = Number.isFinite(voltageNumber)
        ? `${voltageNumber.toFixed(2)} V`
        : "--";
      const firmwareEl = document.getElementById("firmware");
      if (firmwareEl) {
        firmwareEl.textContent = firmwareLabel;
      }

      const ledStates = { y: null, b: null, r: null };
      let ledDataCount = 0;

      ["y", "b", "r"].forEach((color) => {
        const rawLedValue = data[`led_${color}`];
        const isOn = rawLedValue === 1 || rawLedValue === true;
        if (rawLedValue !== undefined && rawLedValue !== null) {
          ledStates[color] = isOn;
          ledDataCount += 1;
        }

        const label = document.getElementById(`led-${color}`);
        if (label) {
          label.textContent = isOn ? "ON" : "OFF";
          label.style.opacity = isOn ? "1" : "0.5";
        }
        const circle = document.querySelector(`.led.${color === "y" ? "green" : color === "b" ? "blue" : "orange"}`);
        if (circle) {
          if (isOn) {
            circle.style.opacity = "1";
            circle.style.filter = "brightness(1.3)";
            circle.style.boxShadow = `0 0 22px var(--${color === "y" ? "green" : color === "b" ? "blue" : "orange"})`;
          } else {
            circle.style.opacity = "0.35";
            circle.style.filter = "brightness(0.6)";
            circle.style.boxShadow = "none";
          }
        }
      });

      let sleepState = null;
      if (ledDataCount > 0) {
        const yellowOn = ledStates.y === true;
        const blueOn = ledStates.b === true;
        const orangeOn = ledStates.r === true;
        if (yellowOn && !blueOn && !orangeOn) {
          sleepState = true;
        } else if (!yellowOn || blueOn || orangeOn) {
          sleepState = false;
        }
      }

      if (sleepState === null) {
        const statusRaw = typeof data.status === "string" ? data.status.toLowerCase() : "";
        if (data.sleep === 1 || data.sleep === true || statusRaw === "sleep") {
          sleepState = true;
        } else if (
          data.sleep === 0 ||
          data.sleep === false ||
          statusRaw === "wake_up" ||
          statusRaw === "awake"
        ) {
          sleepState = false;
        }
      }

      if (sleepState === null) {
        setSleepDisplay("unknown");
        updateHeartbeat("pending");
      } else {
        if (lastSleepState !== sleepState) {
          addLog(sleepState ? "ESP32 entered sleep mode." : "ESP32 exited sleep mode.");
          lastSleepState = sleepState;
        }
        setSleepDisplay(sleepState ? "sleep" : "awake");
        updateHeartbeat(sleepState ? "sleep" : "awake");
      }
    } catch (error) {
      console.error("Dashboard update failed:", error);
      waitingLogged = false;
      setSleepDisplay("disconnected");
      updateHeartbeat("disconnected");
    }
  }

  addLog("Dashboard initialized.");
  addLog("Waiting for ESP32 telemetry...");
  setSleepDisplay("unknown");
  updateHeartbeat("pending");
  watchdogProgress.style.width = "0%";

  document.querySelectorAll(".card").forEach((card, index) => {
    card.style.animationDelay = `${index * 0.1}s`;
  });

  updateDashboard();
  setInterval(updateDashboard, 1000);
});
