const mockData = {
  metrics: {
    healingSuccess: 78,
    breakerStatus: "steady",
    pendingReviews: 3,
  },
  timeline: [
    {
      summary: "Envelope #4315 (python)",
      status: "PROMOTED",
      timestamp: "2025-09-25T02:12:49Z",
      confidence: 0.82,
      breaker: "trend-aware: ok",
      payload: {
        envelope_id: "4315",
        outcome: "PROMOTED",
        attempts: 3,
        stable_hash: "abc123",
      },
    },
    {
      summary: "Envelope #4314 (ts)",
      status: "RETRY",
      timestamp: "2025-09-25T01:47:02Z",
      confidence: 0.46,
      breaker: "breaker hold",
      payload: {
        envelope_id: "4314",
        outcome: "RETRY",
        reason: "integration tests failing",
      },
    },
  ],
  extensions: [
    { id: "eslint-enhanced-runner", enabled: true },
    { id: "npm-audit-runner", enabled: false },
    { id: "stylelint-runner", enabled: true },
  ],
  heartbeat: {
    status: "mock",
    timestamp: "2025-09-25T00:00:00Z",
    history: [
      "2025-09-25T00:00:00Z • heartbeat acknowledged (mock)",
    ],
  },
};

const defaultConfig = {
  endpoints: {
    "refresh-metrics": { path: "/status/metrics", method: "GET" },
    "pull-envelope": { path: "/envelopes/latest", method: "GET" },
    "trigger-heal": {
      path: "/debug/run",
      method: "POST",
      body: { mode: "AUTO", reason: "operator-dashboard" },
    },
    "heartbeat-ping": ({ timestamp }) => ({
      path: "/status/heartbeat",
      method: "POST",
      body: { timestamp },
    }),
    "extension-toggle": ({ id, enabled }) => ({
      path: `/extensions/${id}/${enabled ? "enable" : "disable"}`,
      method: "POST",
      body: { enabled },
    }),
  },
  extensions: [
    {
      id: "eslint-enhanced-runner",
      name: "ESLint Enhanced Runner",
      description: "Runs ESLint with self-healing remediation hints.",
      enabled: true,
    },
    {
      id: "npm-audit-runner",
      name: "npm Audit Runner",
      description: "Checks dependencies as part of the healing cycle.",
      enabled: false,
    },
    {
      id: "stylelint-runner",
      name: "Stylelint Runner",
      description: "Keeps CSS patches aligned with house style.",
      enabled: true,
    },
  ],
};

const dom = {
  metrics: {
    healingSuccess: document.querySelector('[data-metric="healing-success"]'),
    breakerStatus: document.querySelector('[data-metric="breaker-status"]'),
    pendingReviews: document.querySelector('[data-metric="pending-reviews"]'),
  },
  timeline: document.getElementById("timeline"),
  payloadViewer: document.getElementById("payload-viewer"),
  controlLog: document.getElementById("control-log"),
  baseUrl: document.getElementById("base-url"),
  template: document.getElementById("timeline-row"),
  nav: document.getElementById("nav"),
  views: document.querySelectorAll(".view"),
  extensionsList: document.getElementById("extensions-list"),
  extensionTemplate: document.getElementById("extension-item"),
  heartbeatStatus: document.querySelector("[data-heartbeat-status]"),
  heartbeatTimestamp: document.querySelector("[data-heartbeat-timestamp]"),
  heartbeatLog: document.getElementById("heartbeat-log"),
  heartbeatButton: document.getElementById("heartbeat-ping"),
  controlForm: document.getElementById("control-form"),
};

const appState = {
  extensions: new Map(),
  heartbeatHistory: [],
};

dom.navLinks = dom.nav ? dom.nav.querySelectorAll(".nav-link") : [];

const log = (message) => {
  const now = new Date().toISOString();
  dom.controlLog.textContent = `${now}: ${message}`;
  dom.controlLog.classList.remove('error');
}

const logError = (message) => {
  const now = new Date().toISOString();
  dom.controlLog.textContent = `${now}: ${message}`;
  dom.controlLog.classList.add('error');
};

const setBusy = (isBusy) => {
  document.body.classList.toggle("is-busy", isBusy);
};

const setActiveView = (viewName) => {
  dom.views.forEach((view) => {
    view.classList.toggle("is-active", view.dataset.view === viewName);
  });
  dom.navLinks.forEach((link) => {
    link.classList.toggle("is-active", link.dataset.viewTarget === viewName);
  });
};

const renderExtensions = (extensionConfigs = [], states = []) => {
  const stateMap = new Map(states.map((item) => [item.id, item]));
  dom.extensionsList.innerHTML = "";
  appState.extensions.clear();

  extensionConfigs.forEach((config) => {
    const merged = {
      ...config,
      enabled:
        stateMap.has(config.id)
          ? Boolean(stateMap.get(config.id)?.enabled)
          : Boolean(config.enabled),
    };

    const node = createExtensionItem(merged);
    dom.extensionsList.appendChild(node);
    appState.extensions.set(merged.id, merged.enabled);
  });

  if (!extensionConfigs.length) {
    const empty = document.createElement("li");
    empty.className = "hint";
    empty.textContent = "No extensions registered.";
    dom.extensionsList.appendChild(empty);
  }
};

const createExtensionItem = (extension) => {
  const clone = dom.extensionTemplate.content.cloneNode(true);
  const node = clone.firstElementChild;
  node.dataset.extensionId = extension.id;
  node.querySelector('[data-field="name"]').textContent =
    extension.name ?? extension.id;
  node.querySelector('[data-field="description"]').textContent =
    extension.description ?? "";

  const input = node.querySelector('[data-field="input"]');
  input.checked = Boolean(extension.enabled);
  input.setAttribute(
    "aria-label",
    `Toggle ${extension.name ?? extension.id}`
  );

  input.addEventListener("change", (event) => {
    const target = event.currentTarget;
    toggleExtension(extension.id, target.checked, target);
  });

  return node;
};

const renderHeartbeat = (heartbeat) => {
  if (!heartbeat) return;
  if (heartbeat.status) {
    dom.heartbeatStatus.textContent = heartbeat.status;
  }
  if (heartbeat.timestamp) {
    dom.heartbeatTimestamp.textContent = heartbeat.timestamp;
  }
  if (Array.isArray(heartbeat.history)) {
    appState.heartbeatHistory = [...heartbeat.history];
    renderHeartbeatLog();
  }
};

const renderHeartbeatLog = () => {
  dom.heartbeatLog.innerHTML = "";
  if (!appState.heartbeatHistory.length) {
    const empty = document.createElement("li");
    empty.className = "hint";
    empty.textContent = "No heartbeat events yet.";
    dom.heartbeatLog.appendChild(empty);
    return;
  }

  appState.heartbeatHistory.slice(0, 20).forEach((entry) => {
    const li = document.createElement("li");
    li.textContent = entry;
    dom.heartbeatLog.appendChild(li);
  });
};

const appendHeartbeatLog = (entry) => {
  if (!entry) return;
  appState.heartbeatHistory.unshift(entry);
  if (appState.heartbeatHistory.length > 50) {
    appState.heartbeatHistory.length = 50;
  }
  renderHeartbeatLog();
};

const toggleExtension = async (id, enabled, control) => {
  setBusy(true);
  if (control) {
    control.disabled = true;
  }
  try {
    const result = await withFallback(
      () => callEndpoint("extension-toggle", { id, enabled }),
      { acknowledged: true, fallback: true },
      `Unable to reach API for ${id}`
    );

    appState.extensions.set(id, enabled);
    if (result?.fallback) {
      log(
        `Extension ${id} toggled locally (${enabled ? "enabled" : "disabled"}).`
      );
    } else {
      log(`Extension ${id} ${enabled ? "enabled" : "disabled"}.`);
    }
  } catch (error) {
    console.error(error);
    if (control) {
      control.checked = !enabled;
    }
    log(error.message ?? `Failed to toggle ${id}.`);
  } finally {
    if (control) {
      control.disabled = false;
    }
    setBusy(false);
  }
};

const handleNav = (event) => {
  const target = event.target.closest("[data-view-target]");
  if (!target) return;
  const viewName = target.dataset.viewTarget;
  if (!viewName) return;
  setActiveView(viewName);
};

const renderMetrics = (metrics) => {
  dom.metrics.healingSuccess.textContent =
    metrics?.healingSuccess != null ? `${metrics.healingSuccess}%` : "--%";
  dom.metrics.breakerStatus.textContent = metrics?.breakerStatus ?? "unknown";
  dom.metrics.pendingReviews.textContent =
    metrics?.pendingReviews != null ? metrics.pendingReviews : "--";
};

const renderTimeline = (entries = []) => {
  dom.timeline.innerHTML = "";
  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "hint";
    empty.textContent = "No envelope activity yet.";
    dom.timeline.appendChild(empty);
    return;
  }

  entries.forEach((entry) => {
    const clone = dom.template.content.cloneNode(true);
    clone.querySelector('[data-field="summary"]').textContent =
      entry.summary ?? "Envelope";
    clone.querySelector('[data-field="status"]').textContent =
      entry.status ?? "--";
    clone.querySelector('[data-field="timestamp"]').textContent =
      entry.timestamp ?? "--";
    clone.querySelector('[data-field="confidence"]').textContent =
      entry.confidence != null ? `${Math.round(entry.confidence * 100)}%` : "--";
    clone.querySelector('[data-field="breaker"]').textContent =
      entry.breaker ?? "--";

    const node = clone.firstElementChild;
    node.addEventListener("click", () => showPayload(entry.payload));
    dom.timeline.appendChild(node);
  });
};

const showPayload = (payload) => {
  if (!payload) {
    dom.payloadViewer.textContent = "No envelope loaded yet.";
    return;
  }
  dom.payloadViewer.textContent = JSON.stringify(payload, null, 2);
};

const resolveBaseUrl = () => {
  const value = dom.baseUrl?.value?.trim();
  return value ? value.replace(/\/$/, "") : "";
};

const withFallback = async (operation, fallback, message) => {
  try {
    return await operation();
  } catch (error) {
    console.warn(message, error);
    log(`${message}; using fallback.`);
    return fallback;
  }
};

const callEndpoint = async (action, payload = {}) => {
  const resolver = defaultConfig.endpoints[action];
  if (!resolver) {
    throw new Error(`No endpoint configured for action: ${action}`);
  }

  const config =
    typeof resolver === "function" ? resolver(payload) : { ...resolver };

  return executeRequest(config);
};

const executeRequest = async (config) => {
  const base = resolveBaseUrl();
  if (!base) {
    throw new Error("Set an API base URL first.");
  }

  const url = new URL(config.path, base);
  const options = {
    method: config.method,
    headers: { ...(config.headers ?? {}) },
  };
  if (config.body) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(config.body);
  }

  const response = await fetch(url.toString(), options);
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  if (config.expect === "text") {
    return response.text();
  }
  if (config.expect === "void") {
    return undefined;
  }
  return response.json();
};

const actions = {
  "refresh-metrics": async () => {
    const data = await withFallback(
      () => callEndpoint("refresh-metrics"),
      mockData.metrics,
      "Unable to refresh metrics"
    );
    renderMetrics(data);
    log("Metrics refreshed.");
  },
  "pull-envelope": async () => {
    const data = await withFallback(
      () => callEndpoint("pull-envelope"),
      mockData.timeline[0],
      "Unable to load envelope"
    );
    const entries = Array.isArray(data) ? data : [data];
    renderTimeline(entries);
    showPayload(entries[0]?.payload ?? entries[0]);
    log("Envelope loaded.");
  },
  "trigger-heal": async () => {
    await withFallback(
      () => callEndpoint("trigger-heal"),
      { acknowledged: true },
      "Unable to trigger heal"
    );
    log("Heal cycle request sent.");
  },
  "heartbeat-ping": async () => {
    const timestamp = new Date().toISOString();
    const result = await withFallback(
      () => callEndpoint("heartbeat-ping", { timestamp }),
      { status: "offline", timestamp, fallback: true },
      "Unable to send heartbeat"
    );

    const status = result?.status ?? (result?.fallback ? "offline" : "ok");
    const effectiveTimestamp = result?.timestamp ?? timestamp;

    renderHeartbeat({ status, timestamp: effectiveTimestamp });
    appendHeartbeatLog(
      `${effectiveTimestamp} • heartbeat ${status}${
        result?.fallback ? " (fallback)" : ""
      }`
    );
    log("Heartbeat dispatched.");
  },
};

const handleAction = async (event) => {
  const action = event.target?.dataset?.action;
  if (!action || !actions[action]) return;

  setBusy(true);
  try {
    await actions[action]();
  } catch (error) {
    console.error(error);
    logError(error.message || 'An error occurred while fetching data.');
  } finally {
    setBusy(false);
  }
};

document.addEventListener("DOMContentLoaded", () => {

  // Show mock data by default
  renderMetrics(mockData.metrics);
  renderTimeline(mockData.timeline);
  showPayload(mockData.timeline[0]?.payload);
  renderExtensions(defaultConfig.extensions, mockData.extensions);
  renderHeartbeat(mockData.heartbeat);

  // Ensure live data loading is prioritized and mock data is only a fallback.
  actions["refresh-metrics"]().catch((e) => logError("Could not load live metrics: " + (e?.message || e)));
  actions["pull-envelope"]().catch((e) => logError("Could not load live envelope: " + (e?.message || e)));
  actions["heartbeat-ping"]().catch((e) => logError("Could not ping heartbeat: " + (e?.message || e)));

  if (dom.controlForm) {
    dom.controlForm.addEventListener("click", handleAction);
  }

  if (dom.nav) {
    dom.nav.addEventListener("click", handleNav);
  }

  if (dom.heartbeatButton) {
    dom.heartbeatButton.addEventListener("click", () =>
      actions["heartbeat-ping"]?.()
    );
  }

  setActiveView("overview");
});
