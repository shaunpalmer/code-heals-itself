# Operator Dashboard

A lightweight HTML interface that surfaces key signals from the self-healing platform and provides quick operator controls without relying on external frameworks.

## Getting Started

1. Open `index.html` directly in your browser or serve the `dashboard/` folder with any static web server (for example `npx serve dashboard`).
2. Enter the base API URL for your deployment in the **Control Center** panel. The dashboard will call the endpoints relative to this base.
3. Use the sidebar to switch between **Overview**, **Envelopes**, **Extensions**, and **Heartbeat** views:
  - Overview: metrics cards, quick controls, and activity log
  - Envelopes: timeline of attempts plus the raw payload viewer
  - Extensions: toggle individual observers/post-processors on or off
  - Heartbeat: send or monitor a timestamped heartbeat call

Buttons and toggles will use the configured base URL; results appear in the log panels for quick confirmation.

## Customizing Endpoints

All endpoint definitions live in `assets/app.js` inside the `defaultConfig` object. Adjust the `path`, `method`, or `body` fields to match your API. For authenticated environments, extend the `executeRequest` helper to inject headers or tokens.

```js
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
    // ...add or remove runtime extensions here
  ],
};
```

## Mock Data & Offline Mode

If the dashboard cannot reach your API (or you have not provided a base URL), it falls back to the mock data bundled in `assets/app.js`. This keeps the UI responsive and demonstrates the layout even when running offline. Replace the `mockData` object with your own samples or remove it once your endpoints are available.

## Extending the Dashboard

- Add new `<details>` sections in `index.html` for additional telemetry streams.
- Draw charts by wiring the fetch results into your preferred charting library (D3, Chart.js, etc.).
- Extend the sidebar by adding new buttons with `data-view-target` attributes and a matching `.view` section in the markup.
- Configure additional switches by expanding the `defaultConfig.extensions` array or adding new handlers in `app.js`.
- Wire in WebSocket or Server-Sent Events for live updates by extending `app.js`.

The folder is intentionally self-contained so it can be bundled as an "extras" package, deployed as a static site, or embedded inside existing ops tooling.
