console.log('='.repeat(80));
console.log('DASHBOARD APP.JS LOADED');
console.log('='.repeat(80));

// ============================================================================
// API LAYER - All backend calls in one place
// ============================================================================
const API = {
  BASE_URL: 'http://127.0.0.1:5000',

  // Simple fetch wrapper with error handling
  async fetch(endpoint, options = {}) {
    const url = `${this.BASE_URL}${endpoint}`;
    console.log(`[API] ${options.method || 'GET'} ${url}`);

    try {
      const response = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        ...options
      });

      if (!response.ok) {
        console.warn(`[API] ${endpoint} returned ${response.status}`);
        return null;
      }

      const data = await response.json();
      console.log(`[API] ${endpoint} succeeded`, data);
      return data;
    } catch (error) {
      console.error(`[API] ${endpoint} failed:`, error);
      return null;
    }
  },

  // All API endpoints
  getMetrics() {
    return this.fetch('/status/metrics');
  },

  getEnvelopes() {
    return this.fetch('/envelopes/latest');
  },

  triggerHeal() {
    return this.fetch('/debug/run', { method: 'POST' });
  },

  sendHeartbeat(timestamp) {
    return this.fetch('/status/heartbeat', {
      method: 'POST',
      body: JSON.stringify({ timestamp })
    });
  },

  toggleExtension(id, enabled) {
    return this.fetch(`/extensions/${id}/${enabled ? 'enable' : 'disable'}`, {
      method: 'POST'
    });
  },

  // LLM Settings endpoints
  getLLMSettings() {
    return this.fetch('/api/llm/settings');
  },

  saveLLMSettings(settings) {
    return this.fetch('/api/llm/settings', {
      method: 'POST',
      body: JSON.stringify(settings)
    });
  },

  testLLMConnection() {
    return this.fetch('/api/llm/test');
  },

  getLLMModels() {
    return this.fetch('/api/llm/models');
  },

  getLLMPresets() {
    return this.fetch('/api/llm/presets');
  },

  // Keep-Alive Control endpoints
  startKeepAlive() {
    return this.fetch('/api/keepalive/start', { method: 'POST' });
  },

  stopKeepAlive() {
    return this.fetch('/api/keepalive/stop', { method: 'POST' });
  },

  getKeepAliveStatus() {
    return this.fetch('/api/keepalive/status');
  },

  getKeepAliveLogs() {
    return this.fetch('/api/keepalive/logs');
  }
};

// ============================================================================
// MOCK DATA - Fallback when API unavailable
// ============================================================================
// App state
const appState = {
  extensions: new Map(),
  heartbeatHistory: [],
  initialized: false,
  failedDomElements: [],
  currentEndpointType: null,
  endpointDetectionAttempts: 0,
  maxDetectionAttempts: 3,
};

// Smart endpoint detection with fallback chain
const detectEndpointType = async () => {
  console.log('[Endpoint] Detecting backend type...');

  // Try each endpoint type in order of likelihood
  const detectionOrder = [
    ENDPOINT_TYPES.PYTHON_STUB,
    ENDPOINT_TYPES.NODE_API,
  ];

  for (const type of detectionOrder) {
    const config = ENDPOINT_CONFIGS[type];

    if (!config.healthCheck || !config.defaultBase) {
      console.log(`[Endpoint] Skipping ${config.name} (no health check available)`);
      continue;
    }

    try {
      console.log(`[Endpoint] Trying ${config.name} at ${config.defaultBase}${config.healthCheck}...`);

      const url = `${config.defaultBase}${config.healthCheck}`;
      const response = await withTimeout(
        fetch(url, { method: 'GET' }),
        2000,
        null
      );

      if (response && response.ok) {
        console.log(`[Endpoint] ✓ Connected to ${config.name}`);
        log(`Connected to ${config.name}`);
        return type;
      }

      console.log(`[Endpoint] ✗ ${config.name} not available (${response?.status || 'timeout'})`);
    } catch (error) {
      console.log(`[Endpoint] ✗ ${config.name} failed:`, error.message);
    }
  }

  // Fallback to Python stub
  console.log('[Endpoint] Using Python stub as fallback');
  log('Using Python stub endpoints (fallback)');
  return ENDPOINT_TYPES.PYTHON_STUB;
};

// Get current endpoint configuration
const getCurrentEndpointConfig = () => {
  const type = appState.currentEndpointType || ENDPOINT_TYPES.PYTHON_STUB;
  return ENDPOINT_CONFIGS[type];
};

// Resolve path using current endpoint configuration
const resolvePath = (pathKey, ...args) => {
  const config = getCurrentEndpointConfig();
  const pathResolver = config.paths[pathKey];

  if (!pathResolver) {
    console.warn(`[Endpoint] Path '${pathKey}' not available for ${config.name}`);
    throw new Error(`Endpoint ${config.name} does not support ${pathKey}`);
  }

  const path = typeof pathResolver === 'function' ? pathResolver(...args) : pathResolver;
  console.log(`[Endpoint] Resolved ${pathKey} → ${path} (${config.name})`);

  return path;
};

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

// Smart JSON parsing with fallback
const safeParse = (data, fallback = null) => {
  if (!data) return fallback;

  // Already an object
  if (typeof data === 'object' && data !== null) {
    return data;
  }

  // Try parsing as JSON string
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch (error) {
      console.warn('Failed to parse JSON string:', error);
      return fallback;
    }
  }

  return fallback;
};

// Smart number parsing with bounds
const parseNumber = (value, defaultValue = 0, min = -Infinity, max = Infinity) => {
  if (value == null) return defaultValue;

  const parsed = typeof value === 'number' ? value : parseFloat(value);

  if (isNaN(parsed)) return defaultValue;

  return Math.max(min, Math.min(max, parsed));
};

// Smart percentage formatter
const formatPercentage = (value, decimals = 0) => {
  const num = parseNumber(value, 0, 0, 1);
  return `${(num * 100).toFixed(decimals)}%`;
};

// Promise-based safe operation wrapper with timeout
const withTimeout = (promise, timeoutMs = 5000, fallback = null) => {
  return Promise.race([
    promise,
    new Promise((resolve) =>
      setTimeout(() => {
        console.warn(`Operation timed out after ${timeoutMs}ms`);
        resolve(fallback);
      }, timeoutMs)
    )
  ]);
};

// Batch Promise operations with error isolation
const promiseAllSettled = async (promises) => {
  try {
    const results = await Promise.allSettled(promises);
    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return { success: true, data: result.value, index };
      } else {
        console.warn(`Promise ${index} rejected:`, result.reason);
        return { success: false, error: result.reason, index };
      }
    });
  } catch (error) {
    console.error('Failed to execute promiseAllSettled:', error);
    return [];
  }
};

const defaultConfig = {
  endpoints: {
    "refresh-metrics": {
      path: () => resolvePath('metrics'),
      method: "GET"
    },
    "pull-envelope": {
      path: () => resolvePath('envelope'),
      method: "GET"
    },
    "trigger-heal": {
      path: () => resolvePath('debugRun'),
      method: "POST",
      body: { mode: "AUTO", reason: "operator-dashboard" },
    },
    "heartbeat-ping": ({ timestamp }) => ({
      path: resolvePath('heartbeat'),
      method: "POST",
      body: { timestamp },
    }),
    "extension-toggle": ({ id, enabled }) => ({
      path: resolvePath('extensionToggle', id, enabled ? 'enable' : 'disable'),
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

// Safe DOM element retrieval with null protection
const safeQuerySelector = (selector, parent = document) => {
  try {
    return parent.querySelector(selector);
  } catch (error) {
    console.warn(`Failed to query selector: ${selector}`, error);
    return null;
  }
};

const safeQuerySelectorAll = (selector, parent = document) => {
  try {
    return parent.querySelectorAll(selector);
  } catch (error) {
    console.warn(`Failed to query selector all: ${selector}`, error);
    return [];
  }
};

const safeGetElementById = (id) => {
  try {
    return document.getElementById(id);
  } catch (error) {
    console.warn(`Failed to get element by id: ${id}`, error);
    return null;
  }
};

const dom = {
  metrics: {
    healingSuccess: safeQuerySelector('[data-metric="healing-success"]'),
    breakerStatus: safeQuerySelector('[data-metric="breaker-status"]'),
    pendingReviews: safeQuerySelector('[data-metric="pending-reviews"]'),
  },
  timeline: safeGetElementById("timeline"),
  payloadViewer: safeGetElementById("payload-viewer"),
  controlLog: safeGetElementById("control-log"),
  baseUrl: safeGetElementById("base-url"),
  template: safeGetElementById("timeline-row"),
  nav: safeGetElementById("nav"),
  views: safeQuerySelectorAll(".view"),
  extensionsList: safeGetElementById("extensions-list"),
  extensionTemplate: safeGetElementById("extension-item"),
  heartbeatStatus: safeQuerySelector("[data-heartbeat-status]"),
  heartbeatTimestamp: safeQuerySelector("[data-heartbeat-timestamp]"),
  heartbeatLog: safeGetElementById("heartbeat-log"),
  heartbeatButton: safeGetElementById("heartbeat-ping"),
  controlForm: safeGetElementById("control-form"),
};

// Validate critical DOM elements and track failures
const validateDom = () => {
  const critical = [
    { name: 'controlLog', element: dom.controlLog },
    { name: 'baseUrl', element: dom.baseUrl },
  ];

  critical.forEach(({ name, element }) => {
    if (!element) {
      console.warn(`Critical DOM element missing: ${name}`);
      appState.failedDomElements.push(name);
    }
  });

  return appState.failedDomElements.length === 0;
};

dom.navLinks = dom.nav ? safeQuerySelectorAll(".nav-link", dom.nav) : [];

const log = (message) => {
  try {
    if (!dom.controlLog) {
      console.warn('Control log element not available, logging to console:', message);
      return;
    }
    const now = new Date().toISOString();
    dom.controlLog.textContent = `${now}: ${message}`;
  } catch (error) {
    console.error('Failed to log message:', error);
  }
};

const setBusy = (isBusy) => {
  try {
    document.body.classList.toggle("is-busy", isBusy);
  } catch (error) {
    console.warn('Failed to set busy state:', error);
  }
};

const setActiveView = (viewName) => {
  try {
    if (!viewName) {
      console.warn('No view name provided to setActiveView');
      return;
    }

    dom.views.forEach((view) => {
      if (view && view.dataset) {
        view.classList.toggle("is-active", view.dataset.view === viewName);
      }
    });

    dom.navLinks.forEach((link) => {
      if (link && link.dataset) {
        link.classList.toggle("is-active", link.dataset.viewTarget === viewName);
      }
    });
  } catch (error) {
    console.error('Failed to set active view:', error);
  }
};

const renderExtensions = (extensionConfigs = [], states = []) => {
  try {
    if (!dom.extensionsList) {
      console.warn('Extensions list element not found, skipping render');
      return;
    }

    const stateMap = new Map((states || []).map((item) => [item?.id, item]));
    dom.extensionsList.innerHTML = "";
    appState.extensions.clear();

    if (!extensionConfigs || !Array.isArray(extensionConfigs)) {
      console.warn('Invalid extension configs provided');
      extensionConfigs = [];
    }

    extensionConfigs.forEach((config) => {
      try {
        if (!config || !config.id) {
          console.warn('Invalid extension config:', config);
          return;
        }

        const merged = {
          ...config,
          enabled:
            stateMap.has(config.id)
              ? Boolean(stateMap.get(config.id)?.enabled)
              : Boolean(config.enabled),
        };

        const node = createExtensionItem(merged);
        if (node) {
          dom.extensionsList.appendChild(node);
          appState.extensions.set(merged.id, merged.enabled);
        }
      } catch (error) {
        console.error(`Failed to render extension ${config?.id}:`, error);
      }
    });

    if (!extensionConfigs.length) {
      const empty = document.createElement("li");
      empty.className = "hint";
      empty.textContent = "No extensions registered.";
      dom.extensionsList.appendChild(empty);
    }
  } catch (error) {
    console.error('Failed to render extensions:', error);
    log('Failed to render extensions, using fallback UI');
  }
};

const createExtensionItem = (extension) => {
  try {
    if (!dom.extensionTemplate) {
      console.warn('Extension template not found');
      return null;
    }

    if (!extension || !extension.id) {
      console.warn('Invalid extension data:', extension);
      return null;
    }

    const clone = dom.extensionTemplate.content.cloneNode(true);
    const node = clone.firstElementChild;

    if (!node) {
      console.warn('Failed to clone extension template');
      return null;
    }

    node.dataset.extensionId = extension.id;

    const nameEl = node.querySelector('[data-field="name"]');
    if (nameEl) {
      nameEl.textContent = extension.name ?? extension.id;
    }

    const descEl = node.querySelector('[data-field="description"]');
    if (descEl) {
      descEl.textContent = extension.description ?? "";
    }

    const input = node.querySelector('[data-field="input"]');
    if (input) {
      input.checked = Boolean(extension.enabled);
      input.setAttribute(
        "aria-label",
        `Toggle ${extension.name ?? extension.id}`
      );

      input.addEventListener("change", (event) => {
        const target = event.currentTarget;
        toggleExtension(extension.id, target.checked, target);
      });
    }

    return node;
  } catch (error) {
    console.error('Failed to create extension item:', error);
    return null;
  }
};

const renderHeartbeat = (heartbeat) => {
  try {
    if (!heartbeat) {
      console.warn('No heartbeat data provided');
      return;
    }

    if (heartbeat.status && dom.heartbeatStatus) {
      dom.heartbeatStatus.textContent = heartbeat.status;
    }

    if (heartbeat.timestamp && dom.heartbeatTimestamp) {
      dom.heartbeatTimestamp.textContent = heartbeat.timestamp;
    }

    if (Array.isArray(heartbeat.history)) {
      appState.heartbeatHistory = [...heartbeat.history];
      renderHeartbeatLog();
    }
  } catch (error) {
    console.error('Failed to render heartbeat:', error);
  }
};

const renderHeartbeatLog = () => {
  try {
    if (!dom.heartbeatLog) {
      console.warn('Heartbeat log element not found');
      return;
    }

    dom.heartbeatLog.innerHTML = "";

    if (!appState.heartbeatHistory || !appState.heartbeatHistory.length) {
      const empty = document.createElement("li");
      empty.className = "hint";
      empty.textContent = "No heartbeat events yet.";
      dom.heartbeatLog.appendChild(empty);
      return;
    }

    appState.heartbeatHistory.slice(0, 20).forEach((entry) => {
      try {
        if (!entry) return;
        const li = document.createElement("li");
        li.textContent = entry;
        dom.heartbeatLog.appendChild(li);
      } catch (error) {
        console.warn('Failed to render heartbeat log entry:', error);
      }
    });
  } catch (error) {
    console.error('Failed to render heartbeat log:', error);
  }
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
  try {
    if (!metrics) {
      console.warn('No metrics data provided, using defaults');
      metrics = {};
    }

    if (dom.metrics.healingSuccess) {
      dom.metrics.healingSuccess.textContent =
        metrics?.healingSuccess != null ? `${metrics.healingSuccess}%` : "--%";
    }

    if (dom.metrics.breakerStatus) {
      dom.metrics.breakerStatus.textContent = metrics?.breakerStatus ?? "unknown";
    }

    if (dom.metrics.pendingReviews) {
      dom.metrics.pendingReviews.textContent =
        metrics?.pendingReviews != null ? metrics.pendingReviews : "--";
    }
  } catch (error) {
    console.error('Failed to render metrics:', error);
    log('Failed to update metrics display');
  }
};

const renderTimeline = (entries = []) => {
  try {
    if (!dom.timeline) {
      console.warn('Timeline element not found');
      return;
    }

    dom.timeline.innerHTML = "";

    if (!entries || !Array.isArray(entries) || !entries.length) {
      const empty = document.createElement("p");
      empty.className = "hint";
      empty.textContent = "No envelope activity yet.";
      dom.timeline.appendChild(empty);
      return;
    }

    // Use map + filter to process entries with error isolation
    const nodes = entries
      .map((entry, index) => {
        try {
          if (!entry || !dom.template) return null;

          const clone = dom.template.content.cloneNode(true);

          const summaryEl = clone.querySelector('[data-field="summary"]');
          if (summaryEl) summaryEl.textContent = entry.summary ?? "Envelope";

          const statusEl = clone.querySelector('[data-field="status"]');
          if (statusEl) statusEl.textContent = entry.status ?? "--";

          const timestampEl = clone.querySelector('[data-field="timestamp"]');
          if (timestampEl) timestampEl.textContent = entry.timestamp ?? "--";

          const confidenceEl = clone.querySelector('[data-field="confidence"]');
          if (confidenceEl) {
            confidenceEl.textContent = entry.confidence != null
              ? formatPercentage(entry.confidence, 0)
              : "--";
          }

          const breakerEl = clone.querySelector('[data-field="breaker"]');
          if (breakerEl) breakerEl.textContent = entry.breaker ?? "--";

          const node = clone.firstElementChild;
          if (node && entry.payload) {
            node.addEventListener("click", () => showPayload(entry.payload));
          }

          return node;
        } catch (error) {
          console.warn(`Failed to render timeline entry ${index}:`, error);
          return null;
        }
      })
      .filter(node => node !== null);

    // Append all valid nodes
    nodes.forEach(node => dom.timeline.appendChild(node));

    if (nodes.length === 0) {
      const empty = document.createElement("p");
      empty.className = "hint";
      empty.textContent = "Failed to render timeline entries.";
      dom.timeline.appendChild(empty);
    }
  } catch (error) {
    console.error('Failed to render timeline:', error);
  }
};

const showPayload = (payload) => {
  try {
    if (!dom.payloadViewer) {
      console.warn('Payload viewer element not found');
      return;
    }

    if (!payload) {
      dom.payloadViewer.textContent = "No envelope loaded yet.";
      return;
    }

    // Smart parsing - handle string or object
    const parsed = safeParse(payload, payload);
    dom.payloadViewer.textContent = JSON.stringify(parsed, null, 2);
  } catch (error) {
    console.error('Failed to show payload:', error);
    if (dom.payloadViewer) {
      dom.payloadViewer.textContent = "Error displaying payload.";
    }
  }
};

const resolveBaseUrl = () => {
  const value = dom.baseUrl?.value?.trim();
  console.log('[resolveBaseUrl] Input field value:', value);
  console.log('[resolveBaseUrl] dom.baseUrl element:', dom.baseUrl);
  const result = value ? value.replace(/\/$/, "") : "";
  console.log('[resolveBaseUrl] Returning:', result);
  return result;
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
  console.log('[callEndpoint] Called with action:', action, 'payload:', payload);
  const resolver = defaultConfig.endpoints[action];
  if (!resolver) {
    console.error('[callEndpoint] No resolver found for action:', action);
    throw new Error(`No endpoint configured for action: ${action}`);
  }
  console.log('[callEndpoint] Resolver found:', resolver);

  const config =
    typeof resolver === "function" ? resolver(payload) : { ...resolver };
  console.log('[callEndpoint] Config:', config);

  return executeRequest(config);
};

const executeRequest = async (config) => {
  console.log('[executeRequest] Called with config:', config);
  const base = resolveBaseUrl();
  console.log('[executeRequest] Base URL:', base);

  if (!base) {
    console.error('[executeRequest] No base URL! Throwing error...');
    throw new Error("Set an API base URL first.");
  }

  try {
    // Resolve path if it's a function
    const path = typeof config.path === 'function' ? config.path() : config.path;
    console.log('[executeRequest] Resolved path:', path);

    const url = new URL(path, base);
    console.log('[executeRequest] Full URL:', url.toString());

    const options = {
      method: config.method,
      headers: { ...(config.headers ?? {}) },
    };

    if (config.body) {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(config.body);
    }

    // Add timeout to fetch with Promise.race
    const fetchPromise = fetch(url.toString(), options);
    const response = await withTimeout(fetchPromise, 10000, null);

    if (!response) {
      throw new Error('Request timed out');
    }

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    // Smart response parsing based on content-type
    const contentType = response.headers.get('content-type');

    if (config.expect === "text" || contentType?.includes('text/')) {
      return await response.text();
    }

    if (config.expect === "void") {
      return undefined;
    }

    // Try JSON parsing with fallback
    if (contentType?.includes('application/json')) {
      try {
        return await response.json();
      } catch (error) {
        console.warn('Failed to parse JSON response, trying text:', error);
        const text = await response.text();
        return safeParse(text, { raw: text });
      }
    }

    // Default: attempt JSON parse
    try {
      return await response.json();
    } catch (error) {
      // Fallback to text if JSON parsing fails
      const text = await response.text();
      return safeParse(text, { raw: text });
    }
  } catch (error) {
    console.error('Execute request failed:', error);
    throw error;
  }
};

// Batch refresh all dashboard data with Promise.all for parallel loading
const refreshAllData = async () => {
  console.log('[refreshAllData] === START ===');
  console.log('[refreshAllData] Base URL value:', dom.baseUrl?.value);
  console.log('[refreshAllData] Current endpoint type:', appState.currentEndpointType);

  setBusy(true);
  log('Refreshing all dashboard data...');

  try {
    console.log('[refreshAllData] Creating promises...');

    // Use Promise.allSettled to run all fetches in parallel
    const results = await promiseAllSettled([
      withFallback(
        () => {
          console.log('[refreshAllData] Executing refresh-metrics...');
          return callEndpoint("refresh-metrics");
        },
        mockData.metrics,
        "Unable to refresh metrics"
      ),
      withFallback(
        () => {
          console.log('[refreshAllData] Executing pull-envelope...');
          return callEndpoint("pull-envelope");
        },
        mockData.timeline,
        "Unable to load envelopes"
      ),
    ]);

    console.log('[refreshAllData] Results received:', results);

    // Process results with error isolation
    results.forEach((result, index) => {
      try {
        if (result.success) {
          if (index === 0) {
            // Metrics
            renderMetrics(result.data);
          } else if (index === 1) {
            // Envelopes
            const entries = Array.isArray(result.data) ? result.data : [result.data];
            renderTimeline(entries);
            showPayload(entries[0]?.payload ?? entries[0]);
          }
        } else {
          console.warn(`Data refresh ${index} failed:`, result.error);
        }
      } catch (error) {
        console.error(`Failed to process result ${index}:`, error);
      }
    });

    log('Dashboard data refreshed');
  } catch (error) {
    console.error('Batch refresh failed:', error);
    log('Failed to refresh dashboard data');
  } finally {
    setBusy(false);
  }
};

const actions = {
  "refresh-metrics": async () => {
    const data = await API.getMetrics();
    if (data) {
      renderMetrics(data);
      log("Metrics refreshed.");
    } else {
      log("Unable to refresh metrics");
    }
  },

  "pull-envelope": async () => {
    const data = await API.getEnvelopes();
    if (data && data.envelopes) {
      renderTimeline(data.envelopes);
      showPayload(data.envelopes[0]?.payload);
      log("Envelope loaded.");
    } else {
      log("Unable to load envelope");
    }
  },

  "trigger-heal": async () => {
    const result = await API.triggerHeal();
    if (result) {
      log("Heal cycle request sent.");
    } else {
      log("Unable to trigger heal");
    }
  },

  "heartbeat-ping": async () => {
    const timestamp = new Date().toISOString();
    const result = await API.sendHeartbeat(timestamp);

    if (result) {
      const status = result?.status ?? "ok";
      renderHeartbeat({ status, timestamp });
      appendHeartbeatLog(`${timestamp} • heartbeat ${status}`);
      log("Heartbeat dispatched.");
    } else {
      renderHeartbeat({ status: "offline", timestamp });
      appendHeartbeatLog(`${timestamp} • heartbeat offline`);
      log("Heartbeat failed");
    }
  },

  "refresh-all": async () => {
    await loadLiveData();
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
    log(error.message);
  } finally {
    setBusy(false);
  }
};

document.addEventListener("DOMContentLoaded", async () => {
  console.log('='.repeat(80));
  console.log('DOM CONTENT LOADED EVENT FIRED');
  console.log('='.repeat(80));

  // SIMPLE DIRECT DATA LOADING - No complex abstractions
  const BASE_URL = 'http://127.0.0.1:5000';

  // Load live data using the API layer
  async function loadLiveData() {
    console.log('[Load] Loading live data from backend...');

    // Fetch metrics
    const metricsData = await API.getMetrics();
    if (metricsData) {
      renderMetrics(metricsData);
    }

    // Fetch envelopes
    const envelopesData = await API.getEnvelopes();
    if (envelopesData && envelopesData.envelopes) {
      renderTimeline(envelopesData.envelopes);
      showPayload(envelopesData.envelopes[0]?.payload);
    }

    console.log('[Load] Live data loading complete');
  }

  try {
    console.log('Initializing dashboard...');

    // Validate DOM first
    const domValid = validateDom();
    if (!domValid) {
      console.warn('Some DOM elements are missing:', appState.failedDomElements);
      log('Dashboard initialized with limited functionality');
    }

    // Render initial mock data FIRST (so page is never blank)
    console.log('Rendering initial mock data...');
    const initTasks = [
      () => renderMetrics(mockData.metrics),
      () => renderTimeline(mockData.timeline),
      () => showPayload(mockData.timeline[0]?.payload),
      () => renderExtensions(defaultConfig.extensions, mockData.extensions),
      () => renderHeartbeat(mockData.heartbeat),
    ];

    initTasks.forEach((task, index) => {
      try {
        task();
      } catch (error) {
        console.error(`Init task ${index} failed:`, error);
      }
    });

    // Set base URL
    if (dom.baseUrl) {
      dom.baseUrl.value = 'http://127.0.0.1:5000';
    }

    // Wire up event listeners with error boundaries
    if (dom.controlForm) {
      dom.controlForm.addEventListener("click", handleAction);
    } else {
      console.warn('Control form not found, buttons may not work');
    }

    if (dom.nav) {
      dom.nav.addEventListener("click", handleNav);
    } else {
      console.warn('Navigation not found, view switching may not work');
    }

    if (dom.heartbeatButton) {
      dom.heartbeatButton.addEventListener("click", () => {
        if (actions["heartbeat-ping"]) {
          actions["heartbeat-ping"]().catch(error => {
            console.error('Heartbeat action failed:', error);
          });
        }
      });
    } else {
      console.warn('Heartbeat button not found');
    }

    // Wire up restart server button
    const restartServerButton = safeGetElementById('restart-server');
    if (restartServerButton) {
      restartServerButton.addEventListener("click", async () => {
        try {
          log("🔄 Checking server status...");

          // Try to ping the server
          const response = await fetch(`${API.BASE_URL}/keepalive`);

          if (response.ok) {
            log("✅ Server is running! No restart needed.");
            appendHeartbeatLog(`${new Date().toISOString()} • Server check: healthy ✓`);
          } else {
            log("⚠️ Server responded but may be unhealthy");
            appendHeartbeatLog(`${new Date().toISOString()} • Server check: degraded`);
          }
        } catch (error) {
          log("❌ Server is not responding - may be down");
          log("💡 Please restart manually: python dashboard_dev_server.py");
          appendHeartbeatLog(`${new Date().toISOString()} • Server check: offline ✗`);
        }
      });
    } else {
      console.warn('Restart server button not found');
    }

    // Wire up testing controls
    const testEndpointSelect = safeGetElementById('test-endpoint');
    const customUrlGroup = safeGetElementById('custom-url-group');
    const customEndpointInput = safeGetElementById('custom-endpoint');
    const testMethodSelect = safeGetElementById('test-method');
    const testBodyTextarea = safeGetElementById('test-body');
    const runTestButton = safeGetElementById('run-test');
    const clearTestButton = safeGetElementById('clear-test');
    const testResults = safeGetElementById('test-results');
    const testHistory = safeGetElementById('test-history');

    let testHistoryData = [];

    // Show/hide custom URL input
    if (testEndpointSelect && customUrlGroup) {
      testEndpointSelect.addEventListener('change', (e) => {
        if (e.target.value === 'custom') {
          customUrlGroup.style.display = 'flex';
        } else {
          customUrlGroup.style.display = 'none';
        }
      });
    }

    // Run test button
    if (runTestButton) {
      runTestButton.addEventListener('click', async () => {
        try {
          setBusy(true);

          const endpoint = testEndpointSelect?.value === 'custom'
            ? customEndpointInput?.value
            : testEndpointSelect?.value;

          if (!endpoint) {
            log('Please select or enter an endpoint');
            return;
          }

          const method = testMethodSelect?.value || 'GET';
          let body = null;

          if (method !== 'GET' && testBodyTextarea?.value.trim()) {
            try {
              body = JSON.parse(testBodyTextarea.value);
            } catch (e) {
              log('Invalid JSON in request body');
              return;
            }
          }

          const startTime = performance.now();

          // Build full URL
          let fullUrl;
          if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
            fullUrl = endpoint;
          } else {
            fullUrl = API.BASE_URL + (endpoint.startsWith('/') ? endpoint : '/' + endpoint);
          }

          console.log(`[Test] ${method} ${fullUrl}`);

          const options = {
            method: method,
            headers: { 'Content-Type': 'application/json' }
          };

          if (body && method !== 'GET') {
            options.body = JSON.stringify(body);
          }

          try {
            const response = await fetch(fullUrl, options);
            const endTime = performance.now();
            const duration = (endTime - startTime).toFixed(2);

            let responseData;
            const contentType = response.headers.get('content-type');

            if (contentType?.includes('application/json')) {
              responseData = await response.json();
            } else {
              responseData = await response.text();
            }

            // Display result
            displayTestResult({
              success: response.ok,
              status: response.status,
              statusText: response.statusText,
              method,
              endpoint,
              duration,
              request: body,
              response: responseData,
              timestamp: new Date().toISOString()
            });

            // Add to history
            addToTestHistory({
              method,
              endpoint,
              status: response.status,
              success: response.ok,
              timestamp: new Date().toISOString()
            });

            log(`Test completed: ${method} ${endpoint} - ${response.status}`);
          } catch (error) {
            const endTime = performance.now();
            const duration = (endTime - startTime).toFixed(2);

            displayTestResult({
              success: false,
              status: 0,
              statusText: 'Network Error',
              method,
              endpoint,
              duration,
              request: body,
              error: error.message,
              timestamp: new Date().toISOString()
            });

            addToTestHistory({
              method,
              endpoint,
              status: 0,
              success: false,
              timestamp: new Date().toISOString()
            });

            log(`Test failed: ${error.message}`);
          }
        } catch (error) {
          console.error('Test execution error:', error);
          log('Failed to run test');
        } finally {
          setBusy(false);
        }
      });
    }

    // Clear test results
    if (clearTestButton && testResults) {
      clearTestButton.addEventListener('click', () => {
        testResults.innerHTML = '<p class="hint">Run a test to see results here...</p>';
        log('Test results cleared');
      });
    }

    // Display test result function
    function displayTestResult(result) {
      if (!testResults) return;

      const resultHtml = `
        <div class="test-result-item">
          <div class="test-result-header">
            <span class="test-result-status ${result.success ? 'success' : 'error'}">
              ${result.status} ${result.statusText}
            </span>
            <span class="test-result-timing">${result.duration}ms</span>
          </div>
          <div class="test-result-data">
            <strong>${result.method}</strong> ${result.endpoint}
            <br><small style="color: var(--muted);">${result.timestamp}</small>
            ${result.request ? `
              <details style="margin-top: 0.75rem;">
                <summary style="cursor: pointer; color: var(--accent);">Request Body</summary>
                <pre>${JSON.stringify(result.request, null, 2)}</pre>
              </details>
            ` : ''}
            ${result.response ? `
              <details open style="margin-top: 0.75rem;">
                <summary style="cursor: pointer; color: var(--accent);">Response</summary>
                <pre>${typeof result.response === 'string' ? result.response : JSON.stringify(result.response, null, 2)}</pre>
              </details>
            ` : ''}
            ${result.error ? `
              <details open style="margin-top: 0.75rem;">
                <summary style="cursor: pointer; color: #e57373;">Error</summary>
                <pre style="color: #e57373;">${result.error}</pre>
              </details>
            ` : ''}
          </div>
        </div>
      `;

      if (testResults.querySelector('.hint')) {
        testResults.innerHTML = resultHtml;
      } else {
        testResults.insertAdjacentHTML('afterbegin', resultHtml);
      }
    }

    // Add to test history
    function addToTestHistory(item) {
      if (!testHistory) return;

      testHistoryData.unshift(item);

      if (testHistoryData.length > 20) {
        testHistoryData = testHistoryData.slice(0, 20);
      }

      if (testHistory.querySelector('.hint')) {
        testHistory.innerHTML = '';
      }

      testHistory.innerHTML = testHistoryData.map((item, index) => `
        <li onclick="alert('History item clicked. Could restore this test configuration.')">
          <span class="test-history-method ${item.method}">${item.method}</span>
          ${item.endpoint}
          <span style="color: ${item.success ? '#81c784' : '#e57373'}; margin-left: 0.5rem;">
            ${item.status}
          </span>
          <br>
          <small style="color: var(--muted);">${item.timestamp}</small>
        </li>
      `).join('');
    }

    setActiveView("overview");
    appState.initialized = true;
    console.log('Dashboard initialized successfully');
    log('Dashboard ready');

    // ========================================================================
    // SETTINGS TAB INITIALIZATION
    // ========================================================================

    // Settings form elements
    const settingsForm = document.getElementById('settings-form');
    const providerSelect = document.getElementById('provider');
    const apiKeyInput = document.getElementById('api_key');
    const apiKeyGroup = document.getElementById('api-key-group');
    const toggleApiKeyBtn = document.getElementById('toggle-api-key');
    const baseUrlInput = document.getElementById('base_url');
    const modelSelect = document.getElementById('model_name');
    const temperatureInput = document.getElementById('temperature');
    const temperatureValue = document.getElementById('temperature-value');
    const maxTokensInput = document.getElementById('max_tokens');
    const timeoutInput = document.getElementById('timeout');
    const keepAliveCheck = document.getElementById('keep_alive');
    const keepAliveIntervalInput = document.getElementById('keep_alive_interval');
    const keepAliveIntervalValue = document.getElementById('keep-alive-interval-value');
    const keepAliveIntervalGroup = document.getElementById('keep-alive-interval-group');
    const enabledCheck = document.getElementById('enabled');
    const testConnectionBtn = document.getElementById('test-connection-btn');
    const fetchModelsBtn = document.getElementById('fetch-models-btn');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const settingsFeedback = document.getElementById('settings-feedback');
    const connectionTestResults = document.getElementById('connection-test-results');

    // Provider configurations
    const providerConfigs = {
      lmstudio: {
        baseUrl: 'http://127.0.0.1:1234/v1',
        requiresKey: false,
        defaultModel: 'qwen3-32b'
      },
      openai: {
        baseUrl: 'https://api.openai.com/v1',
        requiresKey: true,
        defaultModel: 'gpt-3.5-turbo'
      },
      anthropic: {
        baseUrl: 'https://api.anthropic.com/v1',
        requiresKey: true,
        defaultModel: 'claude-3-sonnet-20240229'
      },
      ollama: {
        baseUrl: 'http://127.0.0.1:11434',
        requiresKey: false,
        defaultModel: 'llama2'
      },
      llama: {
        baseUrl: 'http://127.0.0.1:8080',
        requiresKey: false,
        defaultModel: 'llama-7b'
      },
      azure: {
        baseUrl: '',
        requiresKey: true,
        defaultModel: 'gpt-35-turbo'
      },
      gemini: {
        baseUrl: 'https://generativelanguage.googleapis.com/v1',
        requiresKey: true,
        defaultModel: 'gemini-pro'
      },
      custom: {
        baseUrl: '',
        requiresKey: false,
        defaultModel: 'model-name'
      }
    };

    // Show/hide API key field based on provider
    function updateProviderUI() {
      const provider = providerSelect.value;
      const config = providerConfigs[provider];

      if (config.requiresKey) {
        apiKeyGroup.classList.remove('hidden');
      } else {
        apiKeyGroup.classList.add('hidden');
      }

      // Update base URL if not already set
      if (!baseUrlInput.value || baseUrlInput.value === providerConfigs[providerSelect.dataset.lastProvider]?.baseUrl) {
        baseUrlInput.value = config.baseUrl;
      }

      providerSelect.dataset.lastProvider = provider;
    }

    // Toggle API key visibility
    if (toggleApiKeyBtn) {
      toggleApiKeyBtn.addEventListener('click', () => {
        if (apiKeyInput.type === 'password') {
          apiKeyInput.type = 'text';
          toggleApiKeyBtn.textContent = '🙈';
        } else {
          apiKeyInput.type = 'password';
          toggleApiKeyBtn.textContent = '👁️';
        }
      });
    }

    // Update temperature display
    if (temperatureInput) {
      temperatureInput.addEventListener('input', () => {
        temperatureValue.textContent = temperatureInput.value;
      });
    }

    // Update keep-alive interval display
    if (keepAliveIntervalInput) {
      keepAliveIntervalInput.addEventListener('input', () => {
        keepAliveIntervalValue.textContent = keepAliveIntervalInput.value;
      });
    }

    // Enable/disable keep-alive interval based on checkbox
    if (keepAliveCheck) {
      keepAliveCheck.addEventListener('change', () => {
        if (keepAliveCheck.checked) {
          keepAliveIntervalGroup.classList.remove('disabled');
        } else {
          keepAliveIntervalGroup.classList.add('disabled');
        }
      });
    }

    // Provider change handler
    if (providerSelect) {
      providerSelect.addEventListener('change', updateProviderUI);
    }

    // Show feedback message
    function showFeedback(message, type = 'info') {
      settingsFeedback.textContent = message;
      settingsFeedback.className = `settings-feedback ${type} show`;
    }

    // Load settings from backend
    async function loadSettings() {
      try {
        const settings = await API.getLLMSettings();
        if (!settings) {
          console.warn('[Settings] Failed to load settings, using defaults');
          return;
        }

        console.log('[Settings] Loaded:', settings);

        // Populate form
        if (settings.provider) providerSelect.value = settings.provider;
        if (settings.base_url) baseUrlInput.value = settings.base_url;
        if (settings.model_name) modelSelect.value = settings.model_name;
        if (settings.temperature !== undefined) {
          temperatureInput.value = settings.temperature;
          temperatureValue.textContent = settings.temperature;
        }
        if (settings.max_tokens) maxTokensInput.value = settings.max_tokens;
        if (settings.timeout) timeoutInput.value = settings.timeout;
        if (settings.keep_alive !== undefined) keepAliveCheck.checked = settings.keep_alive;
        if (settings.keep_alive_interval) {
          // Convert seconds to minutes for display
          const minutes = Math.round(settings.keep_alive_interval / 60);
          keepAliveIntervalInput.value = minutes;
          keepAliveIntervalValue.textContent = minutes;
        }
        if (settings.enabled !== undefined) enabledCheck.checked = settings.enabled;

        // Update UI based on provider
        updateProviderUI();

        showFeedback('Settings loaded successfully', 'success');
      } catch (error) {
        console.error('[Settings] Load error:', error);
        showFeedback('Failed to load settings', 'error');
      }
    }

    // Save settings to backend
    if (saveSettingsBtn) {
      saveSettingsBtn.addEventListener('click', async () => {
        try {
          const settings = {
            provider: providerSelect.value,
            api_key: apiKeyInput.value,
            base_url: baseUrlInput.value,
            model_name: modelSelect.value,
            temperature: parseFloat(temperatureInput.value),
            max_tokens: parseInt(maxTokensInput.value),
            timeout: parseInt(timeoutInput.value),
            keep_alive: keepAliveCheck.checked,
            keep_alive_interval: parseInt(keepAliveIntervalInput.value) * 60, // Convert minutes to seconds
            enabled: enabledCheck.checked
          };

          console.log('[Settings] Saving:', settings);
          showFeedback('Saving settings...', 'info');

          const result = await API.saveLLMSettings(settings);

          if (result && result.success) {
            showFeedback('✅ Settings saved successfully!', 'success');
            console.log('[Settings] Save succeeded');
          } else {
            const errorMsg = result?.error || 'Unknown error';
            showFeedback(`❌ Failed to save: ${errorMsg}`, 'error');
            console.error('[Settings] Save failed:', errorMsg);
          }
        } catch (error) {
          console.error('[Settings] Save error:', error);
          showFeedback('❌ Failed to save settings', 'error');
        }
      });
    }

    // Test connection
    if (testConnectionBtn) {
      testConnectionBtn.addEventListener('click', async () => {
        try {
          showFeedback('Testing connection...', 'info');
          connectionTestResults.innerHTML = '<p class="hint">⏳ Testing connection...</p>';

          const result = await API.testLLMConnection();

          if (!result) {
            connectionTestResults.innerHTML = `
              <div class="status-badge error">❌ Connection Failed</div>
              <p style="margin-top: 1rem; color: var(--muted);">
                Unable to reach the backend server. Make sure the Flask server is running.
              </p>
            `;
            showFeedback('❌ Connection test failed', 'error');
            return;
          }

          const ping = result.ping || {};
          const models = result.models || [];

          if (ping.ok) {
            const latency = ping.latency_ms ? ` (${ping.latency_ms}ms)` : '';
            connectionTestResults.innerHTML = `
              <div class="status-badge success">✅ Connection Successful${latency}</div>
              <p style="margin-top: 1rem; color: var(--muted);">
                Provider: <strong style="color: var(--text);">${ping.provider}</strong><br>
                ${models.length > 0 ? `Available models: <strong style="color: var(--text);">${models.length}</strong>` : ''}
              </p>
              ${models.length > 0 ? `
                <details style="margin-top: 1rem;">
                  <summary style="cursor: pointer; color: var(--accent);">Available Models (${models.length})</summary>
                  <ul style="margin-top: 0.5rem; padding-left: 1.5rem; color: var(--muted);">
                    ${models.map(m => `<li>${m}</li>`).join('')}
                  </ul>
                </details>
              ` : ''}
            `;
            showFeedback('✅ Connection successful!', 'success');
          } else {
            connectionTestResults.innerHTML = `
              <div class="status-badge error">❌ Connection Failed</div>
              <p style="margin-top: 1rem; color: #e57373;">
                ${ping.error || 'Unknown error'}
              </p>
            `;
            showFeedback('❌ Connection test failed', 'error');
          }
        } catch (error) {
          console.error('[Settings] Test connection error:', error);
          connectionTestResults.innerHTML = `
            <div class="status-badge error">❌ Connection Failed</div>
            <p style="margin-top: 1rem; color: #e57373;">${error.message}</p>
          `;
          showFeedback('❌ Connection test failed', 'error');
        }
      });
    }

    // Fetch models button
    if (fetchModelsBtn) {
      fetchModelsBtn.addEventListener('click', async () => {
        try {
          showFeedback('Fetching models...', 'info');

          const result = await API.getLLMModels();

          if (result && result.models && result.models.length > 0) {
            // Update model dropdown
            modelSelect.innerHTML = result.models
              .map(m => `<option value="${m}">${m}</option>`)
              .join('');
            showFeedback(`✅ Loaded ${result.models.length} models`, 'success');
          } else {
            showFeedback('❌ No models found or fetch failed', 'error');
          }
        } catch (error) {
          console.error('[Settings] Fetch models error:', error);
          showFeedback('❌ Failed to fetch models', 'error');
        }
      });
    }

    // Load settings when Settings tab is opened
    const originalSetActiveView = setActiveView;
    setActiveView = function (viewName) {
      originalSetActiveView(viewName);
      if (viewName === 'settings') {
        console.log('[Settings] Tab activated, loading settings...');
        loadSettings();
        refreshKeepAliveStatus();  // Also refresh keep-alive status
      }
    };

    // ========================================================================
    // KEEP-ALIVE CONTROL HANDLERS
    // ========================================================================

    const startKeepAliveBtn = document.getElementById('start-keepalive-btn');
    const stopKeepAliveBtn = document.getElementById('stop-keepalive-btn');
    const refreshKeepAliveBtn = document.getElementById('refresh-keepalive-btn');
    const keepAliveStatusIndicator = document.getElementById('keepalive-status-indicator');
    const keepAliveStatusText = document.getElementById('keepalive-status-text');
    const keepAliveUptime = document.getElementById('keepalive-uptime');
    const keepAliveLastPing = document.getElementById('keepalive-last-ping');
    const keepAliveLogs = document.getElementById('keepalive-logs');
    const globalStatusIndicator = document.getElementById('global-status-indicator');

    // Update status display
    function updateKeepAliveStatus(status) {
      if (!keepAliveStatusIndicator || !keepAliveStatusText) return;

      const statusMap = {
        running: { indicator: '🟢', text: 'Running', global: '🟢 Connected' },
        starting: { indicator: '🟡', text: 'Starting...', global: '🟡 Connecting' },
        stopped: { indicator: '🔴', text: 'Not Running', global: '🔴 Disconnected' },
        error: { indicator: '🔴', text: 'Error', global: '🔴 Error' }
      };

      const config = statusMap[status.status] || statusMap.stopped;
      keepAliveStatusIndicator.textContent = config.indicator;
      keepAliveStatusText.textContent = config.text;

      // Update global indicator
      if (globalStatusIndicator) {
        const [dot, text] = config.global.split(' ');
        globalStatusIndicator.querySelector('.status-dot').textContent = dot;
        globalStatusIndicator.querySelector('.status-text').textContent = text;
      }

      // Update uptime
      if (keepAliveUptime) {
        keepAliveUptime.textContent = status.uptime || '';
      }

      // Update last ping
      if (keepAliveLastPing && status.last_ping) {
        const ping = status.last_ping;
        const statusIcon = ping.status === 'ok' ? '✅' : ping.status === 'error' ? '❌' : '⚠️';
        keepAliveLastPing.innerHTML = `
          <strong>Last Ping:</strong> ${statusIcon} 
          ${ping.provider || 'unknown'} 
          ${ping.latency_ms ? `(${ping.latency_ms}ms)` : ''} 
          at ${new Date(ping.timestamp).toLocaleTimeString()}
          ${ping.error ? `<br><span style="color: #e57373;">${ping.error}</span>` : ''}
        `;
      }

      // Update button states
      if (startKeepAliveBtn) startKeepAliveBtn.disabled = status.running;
      if (stopKeepAliveBtn) stopKeepAliveBtn.disabled = !status.running;
    }

    // Update logs display
    function updateKeepAliveLogs(logs) {
      if (!keepAliveLogs || !logs || logs.length === 0) return;

      keepAliveLogs.innerHTML = logs.reverse().map(log => {
        const statusClass = log.status === 'ok' ? 'success' : log.status === 'error' ? 'error' : 'skipped';
        const statusIcon = log.status === 'ok' ? '✅' : log.status === 'error' ? '❌' : '⚠️';

        return `
          <div class="log-entry ${statusClass}">
            <div class="log-timestamp">${new Date(log.timestamp).toLocaleTimeString()}</div>
            <div class="log-details">
              ${statusIcon} ${log.provider || 'unknown'} 
              ${log.model ? `• ${log.model}` : ''}
              ${log.latency_ms ? `• ${log.latency_ms}ms` : ''}
              ${log.http_status ? `• HTTP ${log.http_status}` : ''}
              ${log.error ? `• <span style="color: #e57373;">${log.error}</span>` : ''}
              ${log.message ? `• ${log.message}` : ''}
            </div>
          </div>
        `;
      }).join('');
    }

    // Refresh status from server
    async function refreshKeepAliveStatus() {
      try {
        const status = await API.getKeepAliveStatus();
        if (status) {
          updateKeepAliveStatus(status);
          if (status.logs && status.logs.length > 0) {
            updateKeepAliveLogs(status.logs);
          }
        }
      } catch (error) {
        console.error('[Keep-Alive] Failed to refresh status:', error);
      }
    }

    // Start keep-alive
    if (startKeepAliveBtn) {
      startKeepAliveBtn.addEventListener('click', async () => {
        try {
          const result = await API.startKeepAlive();
          if (result && result.ok) {
            showFeedback(`✅ ${result.message}`, 'success');
            await refreshKeepAliveStatus();

            // Start auto-refresh every 10 seconds
            if (window.keepAliveRefreshInterval) {
              clearInterval(window.keepAliveRefreshInterval);
            }
            window.keepAliveRefreshInterval = setInterval(refreshKeepAliveStatus, 10000);
          } else {
            showFeedback(`❌ Failed to start: ${result?.error || 'Unknown error'}`, 'error');
          }
        } catch (error) {
          showFeedback(`❌ Error: ${error.message}`, 'error');
        }
      });
    }

    // Stop keep-alive
    if (stopKeepAliveBtn) {
      stopKeepAliveBtn.addEventListener('click', async () => {
        try {
          const result = await API.stopKeepAlive();
          if (result && result.ok) {
            showFeedback(`✅ ${result.message}`, 'success');
            await refreshKeepAliveStatus();

            // Stop auto-refresh
            if (window.keepAliveRefreshInterval) {
              clearInterval(window.keepAliveRefreshInterval);
              window.keepAliveRefreshInterval = null;
            }
          } else {
            showFeedback(`❌ Failed to stop: ${result?.error || 'Unknown error'}`, 'error');
          }
        } catch (error) {
          showFeedback(`❌ Error: ${error.message}`, 'error');
        }
      });
    }

    // Refresh status manually
    if (refreshKeepAliveBtn) {
      refreshKeepAliveBtn.addEventListener('click', refreshKeepAliveStatus);
    }

    // Initial status check
    refreshKeepAliveStatus();

    // END SETTINGS TAB INITIALIZATION

    // Load live data after a brief delay
    console.log('[INIT] Starting live data load in 500ms...');
    setTimeout(() => {
      console.log('[INIT] Loading live data now...');
      loadLiveData().catch(error => {
        console.error('[INIT] Live data load failed:', error);
      });
    }, 500);

    // Keepalive ping every 5 minutes to prevent server timeout
    setInterval(async () => {
      try {
        await fetch(`${API.BASE_URL}/keepalive`);
        console.log('[Keepalive] Server pinged - staying alive');
      } catch (error) {
        console.warn('[Keepalive] Ping failed - server may be down', error);
      }
    }, 5 * 60 * 1000); // 5 minutes

  } catch (error) {
    console.error('Dashboard initialization failed:', error);
    log('Dashboard initialization failed - check console for details');
  }
});
