import React, { useState, useEffect, useCallback, useRef } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, useMap } from "react-leaflet";
import axios from "axios";
import "leaflet/dist/leaflet.css";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8000";

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const ROUTE_STYLES = {
  sea: { dashArray: "6 4", weight: 3 },
  road: { dashArray: null, weight: 2.5 },
  rail: { dashArray: "2 6", weight: 2 },
};

const STATUS_CONFIG = {
  PROCEED: { color: "#22c55e", bg: "rgba(34,197,94,.12)", border: "rgba(34,197,94,.3)", label: "PROCEED" },
  MONITOR: { color: "#eab308", bg: "rgba(234,179,8,.12)", border: "rgba(234,179,8,.3)", label: "MONITOR" },
  REROUTE: { color: "#f97316", bg: "rgba(249,115,22,.12)", border: "rgba(249,115,22,.3)", label: "REROUTE" },
  HOLD:    { color: "#ef4444", bg: "rgba(239,68,68,.12)",  border: "rgba(239,68,68,.3)",  label: "HOLD" },
};

const DEMO_SCENARIOS = [
  { id: "cyclone_bob",  label: "Bay of Bengal Cyclone", icon: "🌀", color: "#3b82f6" },
  { id: "red_sea",      label: "Red Sea Alert",         icon: "⚠️", color: "#8b5cf6" },
  { id: "monsoon_flood",label: "North India Monsoon",   icon: "🌧️", color: "#06b6d4" },
];

const TYPE_ICONS = { sea: "🚢", road: "🚛", rail: "🚂" };

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function riskBar(risk) {
  const pct = Math.round(risk * 100);
  let color;
  if (risk >= 0.80) color = "#ef4444";
  else if (risk >= 0.65) color = "#f97316";
  else if (risk >= 0.35) color = "#eab308";
  else color = "#22c55e";
  return { pct, color };
}

// ─── SUB-COMPONENTS ──────────────────────────────────────────────────────────

function MapFlyTo({ center }) {
  const map = useMap();
  useEffect(() => { map.flyTo(center, 4, { duration: 1.2 }); }, [center]);
  return null;
}

function RouteCard({ route, selected, onClick }) {
  const st = STATUS_CONFIG[route.status] || STATUS_CONFIG.PROCEED;
  const { pct, color } = riskBar(route.overall_risk);
  return (
    <div
      onClick={() => onClick(route.route_id)}
      style={{
        background: selected ? "rgba(255,255,255,.04)" : "transparent",
        border: `1px solid ${selected ? st.border : "rgba(255,255,255,.06)"}`,
        borderRadius: 6,
        padding: "12px 14px",
        marginBottom: 8,
        cursor: "pointer",
        transition: "all .15s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 13 }}>{TYPE_ICONS[route.type]}</span>
        <span style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: 13, color: "#e2e6f0", flex: 1 }}>
          {route.short}
        </span>
        <span style={{
          fontFamily: "JetBrains Mono, monospace",
          fontSize: 9, letterSpacing: "0.12em",
          padding: "2px 7px", borderRadius: 3,
          color: st.color, background: st.bg, border: `1px solid ${st.border}`,
        }}>
          {route.status_label}
        </span>
      </div>
      {/* Risk bar */}
      <div style={{ height: 4, background: "rgba(255,255,255,.06)", borderRadius: 2, overflow: "hidden", marginBottom: 6 }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 2, transition: "width .5s ease" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "#4a5166" }}>
          Risk driver: {route.top_factor}
        </span>
        <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color }}>
          {pct}%
        </span>
      </div>
    </div>
  );
}

function AlertBanner({ alerts }) {
  if (!alerts || alerts.length === 0) return null;
  const typeStyle = {
    critical:       { color: "#ef4444", bg: "rgba(239,68,68,.08)",  border: "rgba(239,68,68,.25)",  icon: "🔴" },
    warning:        { color: "#eab308", bg: "rgba(234,179,8,.08)",  border: "rgba(234,179,8,.25)",  icon: "🟡" },
    recommendation: { color: "#22c55e", bg: "rgba(34,197,94,.08)",  border: "rgba(34,197,94,.25)",  icon: "✅" },
    info:           { color: "#3b82f6", bg: "rgba(59,130,246,.08)", border: "rgba(59,130,246,.25)", icon: "ℹ️" },
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {alerts.map((a, i) => {
        const s = typeStyle[a.type] || typeStyle.info;
        return (
          <div key={i} style={{
            background: s.bg, border: `1px solid ${s.border}`,
            borderRadius: 5, padding: "9px 12px",
            display: "flex", gap: 8, alignItems: "flex-start",
          }}>
            <span style={{ fontSize: 12, flexShrink: 0 }}>{s.icon}</span>
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: s.color, lineHeight: 1.5 }}>
              {a.message}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function SystemStatusBadge({ status }) {
  const config = {
    NORMAL:           { color: "#22c55e", label: "ALL CLEAR",        bg: "rgba(34,197,94,.08)" },
    ADVISORY:         { color: "#eab308", label: "ADVISORY",         bg: "rgba(234,179,8,.08)" },
    ELEVATED:         { color: "#f97316", label: "ELEVATED RISK",    bg: "rgba(249,115,22,.08)" },
    CRITICAL:         { color: "#ef4444", label: "CRITICAL",         bg: "rgba(239,68,68,.08)" },
    MARITIME_HOLD_ALL:{ color: "#ef4444", label: "MARITIME HOLD ALL",bg: "rgba(239,68,68,.12)" },
  };
  const c = config[status] || config.NORMAL;
  return (
    <div style={{ background: c.bg, border: `1px solid ${c.color}33`, borderRadius: 5, padding: "8px 14px", marginBottom: 16 }}>
      <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, letterSpacing: "0.2em", color: "#4a5166", marginBottom: 2 }}>
        SYSTEM STATUS
      </div>
      <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: 16, color: c.color }}>
        {c.label}
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

export default function App() {
  const [routes, setRoutes] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [systemStatus, setSystemStatus] = useState("NORMAL");
  const [loading, setLoading] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [activeScenario, setActiveScenario] = useState(null);
  const [scenarioName, setScenarioName] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("routes");
  const [mapCenter] = useState([22, 82]);
  const [apiStatus, setApiStatus] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // ── Fetch live data ───────────────────────────────────────────────────────

  const fetchLiveData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setActiveScenario(null);
    setScenarioName(null);
    try {
      const resp = await axios.post(`${API_BASE}/route-risk`, { route_ids: null });
      const data = resp.data;
      setRoutes(data.routes || []);
      setSystemStatus(data.system_status || "NORMAL");
      setRecommendations(data.recommendations || []);
      setAlerts([]);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (e) {
      setError("Cannot reach backend. Is the FastAPI server running on port 8000?");
      // Load fallback static data for demo
      loadFallbackData();
    } finally {
      setLoading(false);
    }
  }, []);

  const runDemo = useCallback(async (scenarioId) => {
    setLoading(true);
    setError(null);
    try {
      const resp = await axios.post(`${API_BASE}/demo-scenario`, { scenario: scenarioId });
      const data = resp.data;
      setRoutes(data.routes || []);
      setAlerts(data.alerts || []);
      setSystemStatus(data.system_status || "NORMAL");
      setRecommendations(data.recommendations || []);
      setActiveScenario(scenarioId);
      setScenarioName(data.scenario_name);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (e) {
      setError("Demo scenario failed. Check backend connection.");
      // Run demo scenario locally as fallback
      runLocalScenario(scenarioId);
    } finally {
      setLoading(false);
    }
  }, []);

  const checkApiHealth = useCallback(async () => {
    try {
      const resp = await axios.get(`${API_BASE}/health`, { timeout: 3000 });
      setApiStatus(resp.data.apis);
    } catch {
      setApiStatus(null);
    }
  }, []);

  useEffect(() => {
    loadFallbackData();
    checkApiHealth();
  }, []);

  // ── Fallback / local scenario (works without backend) ────────────────────

  function loadFallbackData() {
    // Minimal static route data when backend is unavailable
    setRoutes(FALLBACK_ROUTES);
    setSystemStatus("NORMAL");
    setAlerts([]);
    setRecommendations([]);
    setLastUpdated(new Date().toLocaleTimeString() + " (static)");
  }

  function runLocalScenario(id) {
    const s = LOCAL_SCENARIOS[id];
    if (!s) return;
    const updated = FALLBACK_ROUTES.map(r => ({
      ...r,
      ...(s.overrides[r.route_id] || {}),
      color: riskToColor((s.overrides[r.route_id] || {}).overall_risk || r.overall_risk),
    }));
    updated.sort((a, b) => b.overall_risk - a.overall_risk);
    setRoutes(updated);
    setAlerts(s.alerts);
    setSystemStatus(s.systemStatus);
    setActiveScenario(id);
    setScenarioName(s.name);
    setLastUpdated(new Date().toLocaleTimeString() + " (local demo)");
  }

  function riskToColor(risk) {
    if (risk >= 0.80) return "#ef4444";
    if (risk >= 0.65) return "#f97316";
    if (risk >= 0.35) return "#eab308";
    return "#22c55e";
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const seaRoutes  = routes.filter(r => r.type === "sea");
  const landRoutes = routes.filter(r => r.type !== "sea");

  return (
    <div style={{ display: "flex", height: "100vh", background: "#0d0f14", fontFamily: "Inter, sans-serif", overflow: "hidden" }}>

      {/* ── LEFT SIDEBAR ─────────────────────────────────────────────── */}
      <div style={{
        width: 340, minWidth: 340, height: "100vh", background: "#13161e",
        borderRight: "1px solid #252935", display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid #252935" }}>
          <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, letterSpacing: "0.25em", color: "#a78bfa", marginBottom: 6 }}>
            ▸ SUPPLY CHAIN INTELLIGENCE
          </div>
          <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: 20, color: "#e2e6f0", lineHeight: 1.2 }}>
            India Multi-Modal<br />Risk Monitor
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
            {["🚛 Road", "🚂 Rail", "🚢 Sea"].map(t => (
              <span key={t} style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, padding: "2px 8px", borderRadius: 3, background: "rgba(167,139,250,.08)", border: "1px solid rgba(167,139,250,.2)", color: "#a78bfa" }}>
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Demo Scenarios */}
        <div style={{ padding: "14px 16px", borderBottom: "1px solid #252935" }}>
          <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, letterSpacing: "0.2em", color: "#4a5166", marginBottom: 8 }}>
            DEMO SCENARIOS
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {DEMO_SCENARIOS.map(s => (
              <button
                key={s.id}
                onClick={() => runDemo(s.id)}
                style={{
                  background: activeScenario === s.id ? `${s.color}18` : "rgba(255,255,255,.03)",
                  border: `1px solid ${activeScenario === s.id ? s.color + "50" : "rgba(255,255,255,.08)"}`,
                  borderRadius: 5, padding: "8px 12px", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 8,
                  color: activeScenario === s.id ? s.color : "#8b93a8",
                  fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 500,
                  transition: "all .15s",
                }}
              >
                <span>{s.icon}</span>
                <span>{s.label}</span>
                {activeScenario === s.id && (
                  <span style={{ marginLeft: "auto", fontFamily: "JetBrains Mono, monospace", fontSize: 8, letterSpacing: "0.1em", color: s.color }}>
                    ACTIVE
                  </span>
                )}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button
              onClick={fetchLiveData}
              disabled={loading}
              style={{
                flex: 1, background: "rgba(34,197,94,.08)", border: "1px solid rgba(34,197,94,.25)",
                borderRadius: 5, padding: "7px 10px", cursor: "pointer",
                color: "#22c55e", fontFamily: "JetBrains Mono, monospace", fontSize: 10,
                letterSpacing: "0.12em",
              }}
            >
              {loading ? "LOADING…" : "⟳ LIVE DATA"}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid #252935" }}>
          {["routes", "alerts", "recs"].map(t => (
            <button key={t}
              onClick={() => setActiveTab(t)}
              style={{
                flex: 1, padding: "10px 0",
                background: activeTab === t ? "rgba(167,139,250,.06)" : "transparent",
                border: "none", borderBottom: activeTab === t ? "2px solid #a78bfa" : "2px solid transparent",
                cursor: "pointer", color: activeTab === t ? "#a78bfa" : "#4a5166",
                fontFamily: "JetBrains Mono, monospace", fontSize: 9, letterSpacing: "0.15em",
                transition: "all .15s",
              }}
            >
              {t === "routes" ? "ROUTES" : t === "alerts" ? `ALERTS${alerts.length ? ` (${alerts.length})` : ""}` : "RECS"}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={{ flex: 1, overflow: "auto", padding: "12px 12px" }}>

          {activeTab === "routes" && (
            <>
              <SystemStatusBadge status={systemStatus} />
              {scenarioName && (
                <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: 13, color: "#e2e6f0", marginBottom: 10 }}>
                  {scenarioName}
                </div>
              )}
              {routes.length === 0 && !loading && (
                <div style={{ color: "#4a5166", fontFamily: "JetBrains Mono, monospace", fontSize: 11, textAlign: "center", marginTop: 24 }}>
                  No route data. Click LIVE DATA or a demo scenario.
                </div>
              )}
              {/* Sea routes group */}
              {seaRoutes.length > 0 && (
                <>
                  <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, letterSpacing: "0.2em", color: "#4a5166", marginBottom: 6, marginTop: 4 }}>
                    🚢 MARITIME
                  </div>
                  {seaRoutes.map(r => (
                    <RouteCard key={r.route_id} route={r} selected={selectedRoute === r.route_id}
                      onClick={id => setSelectedRoute(id === selectedRoute ? null : id)} />
                  ))}
                </>
              )}
              {/* Land routes group */}
              {landRoutes.length > 0 && (
                <>
                  <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, letterSpacing: "0.2em", color: "#4a5166", marginBottom: 6, marginTop: 12 }}>
                    🚛 LAND NETWORK
                  </div>
                  {landRoutes.map(r => (
                    <RouteCard key={r.route_id} route={r} selected={selectedRoute === r.route_id}
                      onClick={id => setSelectedRoute(id === selectedRoute ? null : id)} />
                  ))}
                </>
              )}
            </>
          )}

          {activeTab === "alerts" && (
            alerts.length > 0
              ? <AlertBanner alerts={alerts} />
              : <div style={{ color: "#4a5166", fontFamily: "JetBrains Mono, monospace", fontSize: 11, textAlign: "center", marginTop: 24 }}>
                  No active alerts. Run a demo scenario or fetch live data.
                </div>
          )}

          {activeTab === "recs" && (
            recommendations.length > 0
              ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {recommendations.map((r, i) => (
                    <div key={i} style={{
                      background: r.priority === "critical" ? "rgba(239,68,68,.06)" : "rgba(34,197,94,.06)",
                      border: `1px solid ${r.priority === "critical" ? "rgba(239,68,68,.25)" : "rgba(34,197,94,.25)"}`,
                      borderRadius: 5, padding: "10px 12px",
                    }}>
                      <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: r.from ? "#f97316" : "#ef4444", marginBottom: 4 }}>
                        {r.from} {r.to ? `→ ${r.to}` : "→ HOLD"}
                      </div>
                      <div style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: "#8b93a8" }}>{r.reason}</div>
                    </div>
                  ))}
                </div>
              )
              : <div style={{ color: "#4a5166", fontFamily: "JetBrains Mono, monospace", fontSize: 11, textAlign: "center", marginTop: 24 }}>
                  No reroute recommendations active.
                </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "10px 16px", borderTop: "1px solid #252935", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 8, letterSpacing: "0.12em", color: "#4a5166" }}>
            {lastUpdated ? `Updated ${lastUpdated}` : "—"}
          </span>
          {apiStatus && (
            <div style={{ display: "flex", gap: 4 }}>
              {Object.entries(apiStatus).map(([k, v]) => (
                <span key={k} style={{
                  fontFamily: "JetBrains Mono, monospace", fontSize: 7, letterSpacing: "0.08em",
                  padding: "1px 5px", borderRadius: 2,
                  background: v === "ok" ? "rgba(34,197,94,.1)" : "rgba(239,68,68,.1)",
                  color: v === "ok" ? "#22c55e" : "#ef4444",
                  border: `1px solid ${v === "ok" ? "rgba(34,197,94,.3)" : "rgba(239,68,68,.3)"}`,
                }}>
                  {k === "tomorrow_io" ? "T.IO" : "OWM"} {v === "ok" ? "●" : "○"}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── MAP ──────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, position: "relative" }}>

        {/* Error banner */}
        {error && (
          <div style={{
            position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)",
            zIndex: 1000, background: "rgba(239,68,68,.12)", border: "1px solid rgba(239,68,68,.35)",
            borderRadius: 6, padding: "10px 18px", fontFamily: "Inter, sans-serif",
            fontSize: 12, color: "#ef4444", whiteSpace: "nowrap",
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Loading overlay */}
        {loading && (
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(13,15,20,.6)", backdropFilter: "blur(2px)",
          }}>
            <div style={{
              fontFamily: "Syne, sans-serif", fontSize: 16, fontWeight: 700, color: "#a78bfa",
              animation: "pulse 1.2s ease-in-out infinite",
            }}>
              Fetching route risk data…
            </div>
          </div>
        )}

        {/* Map Legend */}
        <div style={{
          position: "absolute", top: 16, right: 16, zIndex: 998,
          background: "rgba(13,15,20,.92)", border: "1px solid #252935",
          borderRadius: 8, padding: "12px 16px", minWidth: 160,
        }}>
          <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 8, letterSpacing: "0.2em", color: "#4a5166", marginBottom: 8 }}>LEGEND</div>
          {[
            { color: "#22c55e", label: "PROCEED  < 35%" },
            { color: "#eab308", label: "MONITOR  35–65%" },
            { color: "#f97316", label: "REROUTE  65–80%" },
            { color: "#ef4444", label: "HOLD     > 80%" },
          ].map(l => (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
              <div style={{ width: 24, height: 3, background: l.color, borderRadius: 1 }} />
              <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, color: "#8b93a8" }}>{l.label}</span>
            </div>
          ))}
          <div style={{ borderTop: "1px solid #252935", marginTop: 8, paddingTop: 8 }}>
            {[
              { dash: "solid", label: "Road" },
              { dash: "dashed", label: "Rail" },
              { dash: "dotted", label: "Sea" },
            ].map(l => (
              <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <div style={{ width: 24, height: 2, background: "#8b93a8", borderTop: `2px ${l.dash} #8b93a8` }} />
                <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, color: "#4a5166" }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Leaflet Map */}
        <MapContainer
          center={mapCenter}
          zoom={4}
          style={{ width: "100%", height: "100%" }}
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; OpenStreetMap contributors &copy; CARTO'
          />

          {routes.map(route => {
            const style = ROUTE_STYLES[route.type] || ROUTE_STYLES.road;
            const isSelected = selectedRoute === route.route_id;
            const positions = route.waypoints.map(w => [w[0], w[1]]);

            return (
              <React.Fragment key={route.route_id}>
                <Polyline
                  positions={positions}
                  pathOptions={{
                    color: route.color || "#22c55e",
                    weight: isSelected ? style.weight + 2 : style.weight,
                    dashArray: style.dashArray,
                    opacity: isSelected ? 1 : 0.7,
                  }}
                  eventHandlers={{
                    click: () => setSelectedRoute(route.route_id === selectedRoute ? null : route.route_id),
                  }}
                >
                  <Tooltip sticky direction="top">
                    <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11 }}>
                      <strong>{route.short}</strong><br />
                      Risk: {Math.round(route.overall_risk * 100)}% — {route.status_label}
                    </div>
                  </Tooltip>
                </Polyline>

                {/* Endpoint dot */}
                {positions.length > 0 && (
                  <CircleMarker
                    center={positions[0]}
                    radius={isSelected ? 6 : 4}
                    pathOptions={{ color: route.color, fillColor: route.color, fillOpacity: 0.8, weight: 1 }}
                  >
                    <Tooltip>{route.name}</Tooltip>
                  </CircleMarker>
                )}
              </React.Fragment>
            );
          })}
        </MapContainer>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
        .leaflet-tooltip { background: #13161e !important; border: 1px solid #252935 !important; color: #e2e6f0 !important; font-family: JetBrains Mono, monospace !important; font-size: 11px !important; }
        .leaflet-tooltip-bottom::before { border-bottom-color: #252935 !important; }
        .leaflet-container { background: #0d0f14; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: #252935; border-radius: 2px; }
      `}</style>
    </div>
  );
}

// ─── FALLBACK DATA (when backend is offline) ─────────────────────────────────

const FALLBACK_ROUTES = [
  { route_id:"M1_CVMC",   name:"CVMC — Chennai to Vladivostok Maritime Corridor", short:"M1 CVMC",   type:"sea",  overall_risk:0.18, status:"PROCEED", status_label:"PROCEED", top_factor:"seasonal", color:"#22c55e",
    waypoints:[[13.08,80.28],[10.5,82.5],[5.5,87.0],[3.0,95.0],[1.26,103.82],[5.0,108.0],[12.0,113.0],[18.0,117.0],[22.5,120.5],[25.0,122.0],[30.0,128.0],[35.0,131.0],[38.0,134.0],[43.1,131.9]],
    factors:{weather:0.1,geopolitical:0.05,seasonal:0.15} },
  { route_id:"M2_SUEZ",   name:"Suez — Kandla to Europe via Red Sea", short:"M2 Suez",   type:"sea",  overall_risk:0.48, status:"MONITOR", status_label:"MONITOR", top_factor:"geopolitical", color:"#eab308",
    waypoints:[[23.03,70.22],[22.0,66.0],[17.0,59.0],[12.5,53.0],[11.5,43.5],[15.0,42.0],[20.0,38.5],[27.0,35.5],[29.9,32.5],[31.3,32.3],[36.5,28.0],[38.0,15.0],[43.1,5.5]],
    factors:{weather:0.15,geopolitical:0.45,seasonal:0.1} },
  { route_id:"M3_HORMUZ", name:"Hormuz — Ras Tanura to Vadinar/Kandla (Crude Import)", short:"M3 Hormuz", type:"sea",  overall_risk:0.12, status:"PROCEED", status_label:"PROCEED", top_factor:"seasonal", color:"#22c55e",
    waypoints:[[27.5,49.5],[26.6,51.0],[26.0,54.0],[26.5,56.5],[24.5,58.5],[22.5,62.0],[22.5,67.0],[22.48,69.63],[23.03,70.22]],
    factors:{weather:0.05,geopolitical:0.25,seasonal:0.08} },
  { route_id:"M4_KANDLA_VADINAR", name:"Kandla — Vadinar Gulf of Kutch Coastal Shuttle", short:"M4 Kandla–Vadinar", type:"sea", overall_risk:0.10, status:"PROCEED", status_label:"PROCEED", top_factor:"seasonal", color:"#22c55e",
    waypoints:[[23.03,70.22],[22.85,70.05],[22.70,69.85],[22.48,69.63]],
    factors:{weather:0.05,geopolitical:0.02,seasonal:0.10} },
  { route_id:"NH44_NS",   name:"NH 44 — Srinagar to Kanyakumari",              short:"NH-44",     type:"road", overall_risk:0.22, status:"PROCEED", status_label:"PROCEED", top_factor:"seasonal", color:"#22c55e", waypoints:[[34.07,74.79],[32.08,76.17],[30.73,76.78],[28.63,77.21],[27.17,78.01],[25.45,78.57],[23.18,79.95],[21.14,79.08],[17.38,78.48],[15.33,75.13],[13.08,77.59],[10.53,76.21],[8.08,77.55]], factors:{weather:0.1,geopolitical:0.02,seasonal:0.2} },
  { route_id:"NH48_WE",   name:"NH 48 — Delhi–Mumbai Expressway Corridor",     short:"NH-48",     type:"road", overall_risk:0.15, status:"PROCEED", status_label:"PROCEED", top_factor:"seasonal", color:"#22c55e", waypoints:[[28.63,77.21],[27.49,76.59],[26.92,75.82],[25.74,73.02],[24.57,72.97],[23,72.57],[22.31,72.96],[21.19,72.83],[20.23,72.97],[19.07,72.87]], factors:{weather:0.05,geopolitical:0.02,seasonal:0.15} },
  { route_id:"NH16_EC",   name:"NH 16 — East Coast Chennai–Kolkata",           short:"NH-16 EC",  type:"road", overall_risk:0.28, status:"PROCEED", status_label:"PROCEED", top_factor:"seasonal", color:"#22c55e", waypoints:[[13.08,80.28],[14.46,79.98],[15.83,80.04],[16.30,80.45],[17.68,83.22],[19.31,84.79],[20.29,85.84],[22.57,88.36]], factors:{weather:0.12,geopolitical:0.02,seasonal:0.25} },
  { route_id:"DFC_WESTERN",name:"Western Dedicated Freight Corridor",          short:"W-DFC",     type:"rail", overall_risk:0.12, status:"PROCEED", status_label:"PROCEED", top_factor:"seasonal", color:"#22c55e", waypoints:[[18.96,72.83],[19.22,72.98],[20.99,73.77],[22.31,72.96],[23,72.57],[24.57,73.68],[25.74,73.02],[26.91,75.81],[28.63,77.21],[30.90,75.85]], factors:{weather:0.05,geopolitical:0.02,seasonal:0.12} },
  { route_id:"DFC_EASTERN",name:"Eastern Dedicated Freight Corridor",          short:"E-DFC",     type:"rail", overall_risk:0.18, status:"PROCEED", status_label:"PROCEED", top_factor:"seasonal", color:"#22c55e", waypoints:[[30.87,75.90],[29.39,79.45],[28.63,77.21],[27.17,78.01],[25.44,81.84],[25.35,83],[23.18,85.32],[22.57,88.36]], factors:{weather:0.08,geopolitical:0.02,seasonal:0.18} },
  { route_id:"COASTAL_RAIL",name:"Coastal Rail — Chennai to Visakhapatnam",   short:"Coastal Rail",type:"rail",overall_risk:0.22, status:"PROCEED", status_label:"PROCEED", top_factor:"seasonal", color:"#22c55e", waypoints:[[13.08,80.28],[13.63,80.18],[14.46,79.98],[16.30,80.45],[17.68,83.22]], factors:{weather:0.1,geopolitical:0.02,seasonal:0.22} },
];

// Local demo scenario fallbacks
const LOCAL_SCENARIOS = {
  cyclone_bob: {
    name: "Bay of Bengal Cyclone",
    systemStatus: "CRITICAL",
    alerts: [
      {type:"critical",    message:"M1 CVMC: HOLD AT PORT — wave height 7.5m exceeds safety threshold"},
      {type:"critical",    message:"NH-16 East Coast: REROUTE — severe wind and flooding"},
      {type:"warning",     message:"Coastal Rail: MONITOR — service disruptions likely"},
      {type:"recommendation", message:"Use M3 Hormuz for urgent sea cargo. Switch road freight to NH44 inland."},
    ],
    overrides: {
      M1_CVMC:          {overall_risk:0.92,status:"HOLD",   status_label:"HOLD AT PORT", top_factor:"weather"},
      NH16_EC:          {overall_risk:0.85,status:"HOLD",   status_label:"CLOSED",       top_factor:"weather"},
      COASTAL_RAIL:     {overall_risk:0.72,status:"REROUTE",status_label:"REROUTE",      top_factor:"weather"},
      M4_KANDLA_VADINAR:{overall_risk:0.55,status:"MONITOR",status_label:"MONITOR",      top_factor:"weather"},
      M2_SUEZ:          {overall_risk:0.45,status:"MONITOR",status_label:"MONITOR",      top_factor:"geopolitical"},
      NH44_NS:          {overall_risk:0.28,status:"PROCEED",status_label:"PROCEED",      top_factor:"seasonal"},
      NH48_WE:          {overall_risk:0.12,status:"PROCEED",status_label:"PROCEED",      top_factor:"seasonal"},
      DFC_WESTERN:      {overall_risk:0.10,status:"PROCEED",status_label:"PROCEED",      top_factor:"seasonal"},
      DFC_EASTERN:      {overall_risk:0.22,status:"PROCEED",status_label:"PROCEED",      top_factor:"seasonal"},
      M3_HORMUZ:        {overall_risk:0.08,status:"PROCEED",status_label:"PROCEED",      top_factor:"seasonal"},
    }
  },
  red_sea: {
    name: "Red Sea Alert",
    systemStatus: "ELEVATED",
    alerts: [
      {type:"critical",       message:"M2 Suez: HOLD — Red Sea geopolitical risk at 0.92"},
      {type:"recommendation", message:"Redirect Russia cargo via M1 CVMC (eastern corridor)"},
      {type:"recommendation", message:"M3 Hormuz available for Middle East crude — normal operations"},
      {type:"info",           message:"Land routes unaffected. Port Kandla and Chennai operating normally."},
    ],
    overrides: {
      M2_SUEZ:          {overall_risk:0.93,status:"HOLD",   status_label:"HOLD AT PORT",top_factor:"geopolitical"},
      M1_CVMC:          {overall_risk:0.18,status:"PROCEED",status_label:"PROCEED",     top_factor:"seasonal"},
      M3_HORMUZ:        {overall_risk:0.22,status:"PROCEED",status_label:"PROCEED",     top_factor:"geopolitical"},
      M4_KANDLA_VADINAR:{overall_risk:0.08,status:"PROCEED",status_label:"PROCEED",     top_factor:"seasonal"},
      NH44_NS:          {overall_risk:0.08,status:"PROCEED",status_label:"PROCEED",     top_factor:"seasonal"},
      NH48_WE:          {overall_risk:0.06,status:"PROCEED",status_label:"PROCEED",     top_factor:"seasonal"},
      NH16_EC:          {overall_risk:0.10,status:"PROCEED",status_label:"PROCEED",     top_factor:"seasonal"},
      DFC_WESTERN:      {overall_risk:0.05,status:"PROCEED",status_label:"PROCEED",     top_factor:"seasonal"},
      DFC_EASTERN:      {overall_risk:0.08,status:"PROCEED",status_label:"PROCEED",     top_factor:"seasonal"},
      COASTAL_RAIL:     {overall_risk:0.09,status:"PROCEED",status_label:"PROCEED",     top_factor:"seasonal"},
    }
  },
  monsoon_flood: {
    name: "North India Monsoon Flood",
    systemStatus: "CRITICAL",
    alerts: [
      {type:"critical",       message:"NH-44: CLOSED — extreme flooding. 0.95 risk score."},
      {type:"critical",       message:"W-DFC: HOLD — railway embankment waterlogged."},
      {type:"warning",        message:"NH-48 Delhi-Mumbai: CAUTION — partial flooding in Gujarat"},
      {type:"recommendation", message:"MODE SWITCH: Reroute N→S freight via E-DFC (Eastern corridor)"},
      {type:"recommendation", message:"Maritime alternatives: M3 Hormuz and M1 CVMC both clear"},
    ],
    overrides: {
      NH44_NS:          {overall_risk:0.95,status:"HOLD",   status_label:"CLOSED",  top_factor:"weather"},
      DFC_WESTERN:      {overall_risk:0.88,status:"HOLD",   status_label:"CLOSED",  top_factor:"weather"},
      NH48_WE:          {overall_risk:0.72,status:"REROUTE",status_label:"REROUTE", top_factor:"weather"},
      DFC_EASTERN:      {overall_risk:0.48,status:"MONITOR",status_label:"MONITOR", top_factor:"weather"},
      M4_KANDLA_VADINAR:{overall_risk:0.35,status:"MONITOR",status_label:"MONITOR", top_factor:"weather"},
      NH16_EC:          {overall_risk:0.20,status:"PROCEED",status_label:"PROCEED", top_factor:"seasonal"},
      COASTAL_RAIL:     {overall_risk:0.15,status:"PROCEED",status_label:"PROCEED", top_factor:"seasonal"},
      M1_CVMC:          {overall_risk:0.22,status:"PROCEED",status_label:"PROCEED", top_factor:"weather"},
      M2_SUEZ:          {overall_risk:0.48,status:"MONITOR",status_label:"MONITOR", top_factor:"geopolitical"},
      M3_HORMUZ:        {overall_risk:0.12,status:"PROCEED",status_label:"PROCEED", top_factor:"seasonal"},
    }
  }
};