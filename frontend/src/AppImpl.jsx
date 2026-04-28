import React, { useState, useEffect, useCallback, useRef } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, useMap } from "react-leaflet";
import axios from "axios";
import "leaflet/dist/leaflet.css";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8000";
const GEMINI_KEY = process.env.REACT_APP_GEMINI_API_KEY || "";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

async function callGemini(prompt) {
  const response = await fetch(`${GEMINI_URL}?key=${GEMINI_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 512 },
    }),
  });
  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

// ─── ROUTE NAMED WAYPOINTS ────────────────────────────────────────────────────
const ROUTE_NODES = {
  M1_CVMC: [
    { name: "Chennai Port", lat: 13.08, lng: 80.28, type: "port" },
    { name: "Sri Lanka Pass", lat: 5.50, lng: 87.00, type: "waypoint" },
    { name: "Malacca Strait", lat: 1.26, lng: 103.82, type: "chokepoint", risk: "medium" },
    { name: "South China Sea", lat: 12.00, lng: 113.00, type: "chokepoint", risk: "high" },
    { name: "Taiwan Strait", lat: 25.00, lng: 122.00, type: "chokepoint", risk: "medium" },
    { name: "East China Sea", lat: 35.00, lng: 131.00, type: "waypoint" },
    { name: "Vladivostok", lat: 43.10, lng: 131.90, type: "port" },
  ],
  M2_SUEZ: [
    { name: "Kandla Port", lat: 23.03, lng: 70.22, type: "port" },
    { name: "Arabian Sea", lat: 17.00, lng: 59.00, type: "waypoint" },
    { name: "Gulf of Aden", lat: 11.50, lng: 43.50, type: "chokepoint", risk: "critical" },
    { name: "Bab-el-Mandeb", lat: 12.50, lng: 43.50, type: "chokepoint", risk: "critical" },
    { name: "Red Sea", lat: 20.00, lng: 38.50, type: "chokepoint", risk: "high" },
    { name: "Suez Canal", lat: 29.90, lng: 32.50, type: "chokepoint", risk: "medium" },
    { name: "Mediterranean", lat: 36.50, lng: 28.00, type: "waypoint" },
    { name: "Europe Hub", lat: 43.10, lng: 5.50, type: "port" },
  ],
  M3_HORMUZ: [
    { name: "Ras Tanura", lat: 27.50, lng: 49.50, type: "port" },
    { name: "Persian Gulf", lat: 26.60, lng: 51.00, type: "waypoint" },
    { name: "Strait of Hormuz", lat: 26.50, lng: 56.50, type: "chokepoint", risk: "high" },
    { name: "Gulf of Oman", lat: 22.50, lng: 62.00, type: "waypoint" },
    { name: "Kandla / Vadinar", lat: 23.03, lng: 70.22, type: "port" },
  ],
  M4_KANDLA_VADINAR: [
    { name: "Kandla Port", lat: 23.03, lng: 70.22, type: "port" },
    { name: "Gulf of Kutch", lat: 22.70, lng: 69.85, type: "waypoint" },
    { name: "Vadinar Terminal", lat: 22.48, lng: 69.63, type: "port" },
  ],
  NH44_NS: [
    { name: "Srinagar", lat: 34.07, lng: 74.79, type: "city" },
    { name: "Jammu", lat: 32.73, lng: 75.12, type: "city", risk: "medium" },
    { name: "Pathankot", lat: 32.08, lng: 76.17, type: "city" },
    { name: "Ambala", lat: 30.37, lng: 76.78, type: "city" },
    { name: "Delhi", lat: 28.63, lng: 77.21, type: "hub" },
    { name: "Agra", lat: 27.17, lng: 78.01, type: "city" },
    { name: "Jhansi", lat: 25.45, lng: 78.57, type: "city" },
    { name: "Nagpur", lat: 21.14, lng: 79.08, type: "hub" },
    { name: "Hyderabad", lat: 17.38, lng: 78.48, type: "hub" },
    { name: "Bengaluru", lat: 13.08, lng: 77.59, type: "hub" },
    { name: "Madurai", lat: 9.93, lng: 78.12, type: "city" },
    { name: "Kanyakumari", lat: 8.08, lng: 77.55, type: "city" },
  ],
  NH48_WE: [
    { name: "Delhi", lat: 28.63, lng: 77.21, type: "hub" },
    { name: "Gurugram", lat: 28.46, lng: 77.03, type: "city" },
    { name: "Jaipur", lat: 26.92, lng: 75.82, type: "hub" },
    { name: "Ajmer", lat: 26.45, lng: 74.64, type: "city" },
    { name: "Udaipur", lat: 24.58, lng: 73.68, type: "city" },
    { name: "Ahmedabad", lat: 23.00, lng: 72.57, type: "hub" },
    { name: "Vadodara", lat: 22.31, lng: 72.96, type: "city" },
    { name: "Surat", lat: 21.19, lng: 72.83, type: "city" },
    { name: "Mumbai", lat: 19.07, lng: 72.87, type: "port" },
  ],
  NH16_EC: [
    { name: "Chennai", lat: 13.08, lng: 80.28, type: "hub" },
    { name: "Nellore", lat: 14.46, lng: 79.98, type: "city" },
    { name: "Ongole", lat: 15.50, lng: 80.05, type: "city" },
    { name: "Vijayawada", lat: 16.51, lng: 80.62, type: "hub" },
    { name: "Rajahmundry", lat: 17.00, lng: 81.80, type: "city" },
    { name: "Visakhapatnam", lat: 17.68, lng: 83.22, type: "port" },
    { name: "Bhubaneswar", lat: 20.29, lng: 85.84, type: "hub" },
    { name: "Kolkata", lat: 22.57, lng: 88.36, type: "port" },
  ],
  NH66_WC: [
    { name: "Mumbai", lat: 19.07, lng: 72.87, type: "port" },
    { name: "Pune Bypass", lat: 18.40, lng: 73.08, type: "city" },
    { name: "Kolhapur", lat: 16.70, lng: 73.81, type: "city" },
    { name: "Goa (Panaji)", lat: 15.49, lng: 73.83, type: "city" },
    { name: "Mangaluru", lat: 12.87, lng: 74.84, type: "port" },
    { name: "Kozhikode", lat: 11.25, lng: 75.78, type: "city" },
    { name: "Kochi", lat: 9.93, lng: 76.27, type: "port" },
    { name: "Trivandrum", lat: 8.52, lng: 76.94, type: "city" },
    { name: "Kanyakumari", lat: 8.08, lng: 77.55, type: "city" },
  ],
  NH27_EW: [
    { name: "Porbandar", lat: 21.64, lng: 69.61, type: "port" },
    { name: "Rajkot", lat: 22.31, lng: 70.80, type: "city" },
    { name: "Ahmedabad", lat: 22.31, lng: 72.96, type: "hub" },
    { name: "Vadodara", lat: 22.31, lng: 73.20, type: "city" },
    { name: "Bhopal", lat: 23.18, lng: 79.95, type: "hub" },
    { name: "Jabalpur", lat: 23.18, lng: 79.95, type: "city" },
    { name: "Kolkata", lat: 22.57, lng: 88.36, type: "port" },
    { name: "Silchar", lat: 24.82, lng: 92.80, type: "city" },
  ],
  NH58_CD: [
    { name: "Rishikesh", lat: 29.95, lng: 78.16, type: "city" },
    { name: "Devprayag", lat: 30.15, lng: 78.60, type: "waypoint" },
    { name: "Srinagar (G.)", lat: 30.22, lng: 78.78, type: "city" },
    { name: "Rudraprayag", lat: 30.28, lng: 78.98, type: "waypoint" },
    { name: "Joshimath", lat: 30.56, lng: 79.56, type: "waypoint", risk: "high" },
    { name: "Mana Pass", lat: 31.10, lng: 79.97, type: "chokepoint", risk: "high" },
  ],
  NH_NE: [
    { name: "Siliguri", lat: 26.72, lng: 88.43, type: "hub" },
    { name: "Jalpaiguri", lat: 26.54, lng: 88.73, type: "city" },
    { name: "Guwahati", lat: 26.17, lng: 91.74, type: "hub" },
    { name: "Shillong", lat: 25.58, lng: 91.88, type: "city" },
    { name: "Dimapur", lat: 25.91, lng: 93.73, type: "city" },
    { name: "Kohima", lat: 25.67, lng: 94.11, type: "city", risk: "medium" },
    { name: "Imphal", lat: 24.82, lng: 93.95, type: "city", risk: "high" },
  ],
  DFC_WESTERN: [
    { name: "JNPT Mumbai", lat: 18.96, lng: 72.83, type: "port" },
    { name: "Vapi", lat: 20.37, lng: 72.91, type: "city" },
    { name: "Surat", lat: 21.19, lng: 72.83, type: "city" },
    { name: "Vadodara", lat: 22.31, lng: 72.96, type: "hub" },
    { name: "Ahmedabad", lat: 23.00, lng: 72.57, type: "hub" },
    { name: "Palanpur", lat: 24.17, lng: 72.43, type: "city" },
    { name: "Ajmer", lat: 26.45, lng: 74.64, type: "hub" },
    { name: "Phulera", lat: 26.87, lng: 75.23, type: "city" },
    { name: "Rewari", lat: 28.20, lng: 76.62, type: "city" },
    { name: "Delhi NCR", lat: 28.63, lng: 77.21, type: "hub" },
    { name: "Ludhiana", lat: 30.90, lng: 75.85, type: "hub" },
  ],
  DFC_EASTERN: [
    { name: "Ludhiana", lat: 30.87, lng: 75.90, type: "hub" },
    { name: "Ambala", lat: 30.35, lng: 76.77, type: "city" },
    { name: "Delhi NCR", lat: 28.63, lng: 77.21, type: "hub" },
    { name: "Aligarh", lat: 27.88, lng: 78.07, type: "city" },
    { name: "Kanpur", lat: 26.45, lng: 80.35, type: "hub" },
    { name: "Allahabad", lat: 25.44, lng: 81.84, type: "city" },
    { name: "Varanasi", lat: 25.35, lng: 83.00, type: "hub" },
    { name: "Gaya / Dhanbad", lat: 23.18, lng: 85.32, type: "city" },
    { name: "Kolkata", lat: 22.57, lng: 88.36, type: "port" },
  ],
  COASTAL_RAIL: [
    { name: "Chennai Central", lat: 13.08, lng: 80.28, type: "hub" },
    { name: "Nellore", lat: 13.63, lng: 80.18, type: "city" },
    { name: "Ongole", lat: 15.50, lng: 80.05, type: "city" },
    { name: "Vijayawada Jn.", lat: 16.51, lng: 80.62, type: "hub" },
    { name: "Visakhapatnam", lat: 17.68, lng: 83.22, type: "port" },
  ],
  KONKAN_RAIL: [
    { name: "Mumbai CSMT", lat: 19.07, lng: 72.87, type: "hub" },
    { name: "Thane", lat: 19.22, lng: 72.98, type: "city" },
    { name: "Ratnagiri", lat: 17.00, lng: 73.30, type: "city", risk: "medium" },
    { name: "Goa (Madgaon)", lat: 15.35, lng: 73.95, type: "city" },
    { name: "Karwar", lat: 14.81, lng: 74.13, type: "city" },
    { name: "Udupi", lat: 13.33, lng: 74.75, type: "city" },
    { name: "Mangaluru Jn.", lat: 12.87, lng: 74.84, type: "port" },
  ],
  TRANS_RAJDHANI: [
    { name: "Ahmedabad", lat: 23.00, lng: 72.57, type: "hub" },
    { name: "Udaipur", lat: 24.59, lng: 73.71, type: "city" },
    { name: "Jaipur Jn.", lat: 26.92, lng: 75.82, type: "hub" },
    { name: "Kanpur", lat: 26.45, lng: 80.35, type: "hub" },
    { name: "Allahabad Jn.", lat: 25.44, lng: 81.84, type: "city" },
    { name: "Patna Jn.", lat: 25.61, lng: 85.13, type: "hub" },
  ],
};

const NODE_RISK_COLORS = {
  critical: "#ef4444",
  high:     "#f97316",
  medium:   "#eab308",
  low:      "#22c55e",
};

const NODE_TYPE_ICONS = {
  port:       "⚓",
  hub:        "🏭",
  city:       "●",
  chokepoint: "⚠",
  waypoint:   "·",
};

// ─── MANMADE THREAT ZONES ─────────────────────────────────────────────────────
const MANMADE_THREATS = [
  { id: "hormuz_tension", lat: 26.5, lng: 56.5, type: "military", severity: 0.72, icon: "⚔️", label: "Strait of Hormuz — Iran Tension", desc: "Iranian naval exercises + tanker seizures. 21M bbl/day chokepoint. US carrier group deployed.", affectsRoutes: ["M3_HORMUZ"] },
  { id: "red_sea_houthi", lat: 13.5, lng: 43.5, type: "conflict", severity: 0.88, icon: "🚀", label: "Bab-el-Mandeb — Houthi Attacks", desc: "Active Houthi missile/drone attacks on commercial shipping. Red Sea transit DANGEROUS. IMO alerts active.", affectsRoutes: ["M2_SUEZ"] },
  { id: "south_china_sea_dispute", lat: 12.0, lng: 113.0, type: "territorial", severity: 0.55, icon: "🛳️", label: "South China Sea — Territorial Dispute", desc: "PRC Coast Guard harassment of cargo vessels near Spratly Islands. Transit advisories from US, India, EU.", affectsRoutes: ["M1_CVMC"] },
  { id: "somalia_pirates", lat: 11.0, lng: 51.0, type: "piracy", severity: 0.45, icon: "🏴‍☠️", label: "Gulf of Aden — Piracy Zone", desc: "Renewed Somali piracy activity. Armed escorts recommended. IMB Piracy Reporting Centre: HIGH RISK.", affectsRoutes: ["M2_SUEZ"] },
  { id: "malacca_congestion", lat: 1.26, lng: 103.82, type: "congestion", severity: 0.35, icon: "⚓", label: "Malacca Strait — Port Congestion", desc: "Singapore port congestion averaging +3.5 days delay for cargo vessels. AIS spoofing reported.", affectsRoutes: ["M1_CVMC"] },
  { id: "kashmir_nh44", lat: 33.5, lng: 75.5, type: "protest", severity: 0.42, icon: "🚧", label: "J&K — Road Blockades / Unrest", desc: "Frequent NH-44 shutdowns near Jammu-Srinagar corridor due to security operations. Truck movement restricted.", affectsRoutes: ["NH44_NS"] },
  { id: "manipur_protest", lat: 24.8, lng: 93.9, type: "protest", severity: 0.38, icon: "🚧", label: "Northeast — Ethnic Conflict / Road Blocks", desc: "Ethnic tensions in Manipur affecting NH-2/NH-37 connectivity. Freight convoys require security escort.", affectsRoutes: ["NH_NE"] },
  { id: "taiwan_strait", lat: 24.5, lng: 121.0, type: "military", severity: 0.62, icon: "⚔️", label: "Taiwan Strait — Military Drills", desc: "PLA military exercises restrict cargo transit windows. US carrier patrols active. Risk of vessel detention.", affectsRoutes: ["M1_CVMC"] },
];

const THREAT_COLORS = {
  conflict:    "#ef4444",
  military:    "#f97316",
  piracy:      "#8b5cf6",
  territorial: "#eab308",
  protest:     "#06b6d4",
  congestion:  "#64748b",
};

const ROUTE_STYLES = {
  sea:  { dashArray: "8 5",  weight: 3 },
  road: { dashArray: null,   weight: 2.5 },
  rail: { dashArray: "3 7",  weight: 2 },
};

const STATUS_CONFIG = {
  PROCEED: { color: "#22c55e", bg: "rgba(34,197,94,.12)",   border: "rgba(34,197,94,.3)",   label: "PROCEED" },
  MONITOR: { color: "#eab308", bg: "rgba(234,179,8,.12)",   border: "rgba(234,179,8,.3)",   label: "MONITOR" },
  REROUTE: { color: "#f97316", bg: "rgba(249,115,22,.12)",  border: "rgba(249,115,22,.3)",  label: "REROUTE" },
  HOLD:    { color: "#ef4444", bg: "rgba(239,68,68,.12)",   border: "rgba(239,68,68,.3)",   label: "HOLD"    },
};

const DEMO_SCENARIOS = [
  { id: "cyclone_bob",   label: "Bay of Bengal Cyclone", icon: "🌀", color: "#3b82f6" },
  { id: "red_sea",       label: "Red Sea / Houthi Alert", icon: "🚀", color: "#8b5cf6" },
  { id: "hormuz_crisis", label: "Strait of Hormuz Crisis", icon: "⚔️", color: "#ef4444" },
  { id: "monsoon_flood", label: "North India Monsoon",   icon: "🌧️", color: "#06b6d4" },
  { id: "piracy_surge",  label: "Somalia Piracy Surge",  icon: "🏴‍☠️", color: "#f59e0b" },
];

const TYPE_ICONS = { sea: "🚢", road: "🚛", rail: "🚂" };

const ROUTE_ECONOMICS = {
  M1_CVMC:           { baseCost: 1200, km: 14500, days: 24, fuelPerKm: 0.018, type: "sea"  },
  M2_SUEZ:           { baseCost: 1800, km: 11800, days: 35, fuelPerKm: 0.018, type: "sea"  },
  M3_HORMUZ:         { baseCost: 280,  km: 1400,  days: 4,  fuelPerKm: 0.018, type: "sea"  },
  M4_KANDLA_VADINAR: { baseCost: 40,   km: 65,    days: 0.2,fuelPerKm: 0.018, type: "sea"  },
  NH44_NS:           { baseCost: 3200, km: 3745,  days: 5,  fuelPerKm: 0.055, type: "road" },
  NH48_WE:           { baseCost: 2100, km: 1415,  days: 2,  fuelPerKm: 0.055, type: "road" },
  NH16_EC:           { baseCost: 1800, km: 1650,  days: 2.5,fuelPerKm: 0.055, type: "road" },
  NH66_WC:           { baseCost: 2600, km: 2500,  days: 3.5,fuelPerKm: 0.055, type: "road" },
  NH27_EW:           { baseCost: 2800, km: 2700,  days: 3.8,fuelPerKm: 0.055, type: "road" },
  NH58_CD:           { baseCost: 1400, km: 280,   days: 1,  fuelPerKm: 0.065, type: "road" },
  NH_NE:             { baseCost: 1900, km: 1200,  days: 2.5,fuelPerKm: 0.060, type: "road" },
  DFC_WESTERN:       { baseCost: 680,  km: 1504,  days: 2.5,fuelPerKm: 0.012, type: "rail" },
  DFC_EASTERN:       { baseCost: 720,  km: 1856,  days: 3,  fuelPerKm: 0.012, type: "rail" },
  COASTAL_RAIL:      { baseCost: 520,  km: 840,   days: 1.5,fuelPerKm: 0.012, type: "rail" },
  KONKAN_RAIL:       { baseCost: 580,  km: 760,   days: 1.5,fuelPerKm: 0.012, type: "rail" },
  TRANS_RAJDHANI:    { baseCost: 640,  km: 1440,  days: 2.2,fuelPerKm: 0.012, type: "rail" },
};

const REROUTE_ALTERNATIVES = {
  M2_SUEZ:    ["M1_CVMC"],
  M3_HORMUZ:  ["M1_CVMC"],
  NH44_NS:    ["DFC_EASTERN", "DFC_WESTERN"],
  NH48_WE:    ["DFC_WESTERN", "NH44_NS"],
  NH16_EC:    ["COASTAL_RAIL", "DFC_EASTERN"],
  NH66_WC:    ["KONKAN_RAIL", "NH48_WE"],
  NH27_EW:    ["DFC_EASTERN", "NH44_NS"],
  DFC_WESTERN:["NH48_WE", "NH44_NS"],
};

function calcRerouteCost(fromId, toId) {
  const from = ROUTE_ECONOMICS[fromId];
  const to = ROUTE_ECONOMICS[toId];
  if (!from || !to) return null;
  const extraKm = Math.max(0, to.km - from.km);
  const extraDays = Math.max(0, to.days - from.days);
  const extraFuel = to.km * to.fuelPerKm * 3785 * 0.9;
  const baseCostDiff = to.baseCost - from.baseCost;
  const holdingCost = extraDays * 850;
  const totalExtra = baseCostDiff + holdingCost + (extraKm > 0 ? extraFuel * 0.12 : 0);
  return { extraKm: Math.round(extraKm), extraDays: parseFloat(extraDays.toFixed(1)), holdingCost: Math.round(holdingCost), totalExtra: Math.round(totalExtra), totalCost: Math.round(to.baseCost + holdingCost) };
}

function riskBar(risk) {
  const pct = Math.round(risk * 100);
  let color;
  if (risk >= 0.8)       color = "#ef4444";
  else if (risk >= 0.65) color = "#f97316";
  else if (risk >= 0.35) color = "#eab308";
  else                   color = "#22c55e";
  return { pct, color };
}

function MapFlyTo({ center, zoom }) {
  const map = useMap();
  useEffect(() => { map.flyTo(center, zoom || 5, { duration: 1.0 }); }, [center, zoom]);
  return null;
}

// ─── ROUTE NODE TIMELINE ──────────────────────────────────────────────────────
function RouteNodeTimeline({ routeId, routeStatus }) {
  const nodes = ROUTE_NODES[routeId];
  if (!nodes || nodes.length === 0) return null;
  const st = STATUS_CONFIG[routeStatus] || STATUS_CONFIG.PROCEED;
  const origin = nodes[0];
  const dest = nodes[nodes.length - 1];
  const intermediate = nodes.slice(1, -1);

  return (
    <div style={{ marginTop: 10, background: "rgba(0,0,0,.25)", border: "1px solid #1e2130", borderRadius: 8, padding: "12px 14px" }}>
      <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 8, letterSpacing: "0.2em", color: "#4a5166", marginBottom: 10 }}>
        📍 ROUTE WAYPOINTS — {nodes.length} NODES
      </div>

      {/* Origin */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 0 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: st.color, boxShadow: `0 0 6px ${st.color}80`, flexShrink: 0 }} />
          <div style={{ width: 1, background: "rgba(255,255,255,.08)", flex: 1, minHeight: 16 }} />
        </div>
        <div style={{ paddingBottom: 8 }}>
          <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: 12, color: "#e2e6f0" }}>
            {NODE_TYPE_ICONS[origin.type] || "●"} {origin.name}
          </div>
          <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 8, color: "#4a5166" }}>ORIGIN</div>
        </div>
      </div>

      {/* Intermediate nodes */}
      {intermediate.map((node, i) => {
        const nodeColor = node.risk ? NODE_RISK_COLORS[node.risk] : "#4a5166";
        const isLast = i === intermediate.length - 1;
        const isChokepoint = node.type === "chokepoint";
        return (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
              {isChokepoint ? (
                <div style={{ width: 8, height: 8, borderRadius: 2, background: nodeColor, boxShadow: node.risk ? `0 0 5px ${nodeColor}70` : "none", flexShrink: 0, transform: "rotate(45deg)" }} />
              ) : node.risk ? (
                <div style={{ width: 7, height: 7, borderRadius: "50%", border: `1.5px solid ${nodeColor}`, background: `${nodeColor}20`, flexShrink: 0 }} />
              ) : (
                <div style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(255,255,255,.12)", flexShrink: 0, margin: "3px 0" }} />
              )}
              <div style={{ width: 1, background: node.risk ? `${nodeColor}30` : "rgba(255,255,255,.06)", flex: 1, minHeight: 12 }} />
            </div>
            <div style={{ paddingBottom: isChokepoint || node.risk ? 8 : 5, flex: 1 }}>
              <div style={{ fontFamily: node.risk || isChokepoint ? "JetBrains Mono, monospace" : "Inter, sans-serif", fontSize: isChokepoint ? 11 : (node.risk ? 11 : 10), color: node.risk ? nodeColor : (isChokepoint ? "#e2e6f0" : "#8b93a8"), fontWeight: node.risk ? 700 : 400 }}>
                {NODE_TYPE_ICONS[node.type] || "●"} {node.name}
              </div>
              {isChokepoint && (
                <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 8, color: "#4a5166", marginTop: 1 }}>CHOKEPOINT</div>
              )}
              {node.risk && !isChokepoint && (
                <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 8, color: nodeColor, marginTop: 1 }}>{node.risk.toUpperCase()} RISK</div>
              )}
            </div>
          </div>
        );
      })}

      {/* Destination */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#a78bfa", boxShadow: "0 0 6px #a78bfa80", flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: 12, color: "#e2e6f0" }}>
            {NODE_TYPE_ICONS[dest.type] || "●"} {dest.name}
          </div>
          <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 8, color: "#4a5166" }}>DESTINATION</div>
        </div>
      </div>
    </div>
  );
}

// ─── AI ROUTE BRIEF ────────────────────────────────────────────────────────────
function AIRouteBrief({ route }) {
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const lastRouteId = useRef(null);

  useEffect(() => {
    if (!route || route.route_id === lastRouteId.current) return;
    lastRouteId.current = route.route_id;
    setBrief(null);
    setExpanded(false);
  }, [route?.route_id]);

  const generateBrief = async () => {
    if (!route) return;
    setLoading(true);
    setExpanded(true);
    try {
      const eco = ROUTE_ECONOMICS[route.route_id];
      const threats = MANMADE_THREATS.filter(t => t.affectsRoutes.includes(route.route_id));
      const nodes = ROUTE_NODES[route.route_id] || [];
      const chokepoints = nodes.filter(n => n.type === "chokepoint").map(n => n.name).join(", ") || "None";
      const riskNodes = nodes.filter(n => n.risk).map(n => `${n.name} (${n.risk})`).join(", ") || "None";

      const prompt = `You are a supply chain intelligence analyst. Provide a concise 4-sentence operational brief for this freight route.

Route: ${route.name}
Type: ${route.type} | Risk: ${Math.round(route.overall_risk * 100)}% | Status: ${route.status}
Distance: ${eco?.km?.toLocaleString()} km | Transit: ${eco?.days} days | Cargo Cost: $${eco?.baseCost?.toLocaleString()}
Risk Factors: Weather ${Math.round((route.factors?.weather || 0) * 100)}%, Geopolitical ${Math.round((route.factors?.geopolitical || 0) * 100)}%, Manmade ${Math.round((route.factors?.manmade || 0) * 100)}%, Seasonal ${Math.round((route.factors?.seasonal || 0) * 100)}%
Active Threats: ${threats.map(t => `${t.label} (${Math.round(t.severity * 100)}%)`).join("; ") || "None"}
Chokepoints: ${chokepoints}
High-risk nodes: ${riskNodes}
Description: ${route.description}

Write 4 sentences: (1) current operational status and primary risk driver, (2) key chokepoints or critical nodes to watch, (3) freight cost and timeline impact, (4) recommended action for logistics planners. Be direct, use specific data. No headers.`;

      const text = await callGemini(prompt);
      setBrief(text || "Unable to generate brief.");
    } catch (e) {
      setBrief("Brief generation failed. Check API connectivity.");
    } finally {
      setLoading(false);
    }
  };

  if (!route) return null;

  return (
    <div style={{ marginTop: 8, background: "rgba(167,139,250,.04)", border: "1px solid rgba(167,139,250,.15)", borderRadius: 8, overflow: "hidden" }}>
      <button
        onClick={brief || loading ? () => setExpanded(v => !v) : generateBrief}
        style={{ width: "100%", background: "transparent", border: "none", cursor: "pointer", padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12 }}>🤖</span>
          <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, letterSpacing: "0.15em", color: "#a78bfa" }}>AI SITUATIONAL BRIEF</span>
        </div>
        <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, color: "#4a5166" }}>
          {loading ? "ANALYZING…" : brief ? (expanded ? "▲ CLOSE" : "▼ OPEN") : "GENERATE ▶"}
        </span>
      </button>
      {expanded && (
        <div style={{ padding: "0 12px 12px" }}>
          {loading ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#a78bfa", animation: "pulse 1s infinite" }} />
              <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "#4a5166" }}>Generating intelligence brief…</span>
            </div>
          ) : brief ? (
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: "#8b93a8", lineHeight: 1.7, borderTop: "1px solid rgba(167,139,250,.1)", paddingTop: 10 }}>
              {brief}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ─── FACTOR BARS ──────────────────────────────────────────────────────────────
function FactorBars({ factors }) {
  if (!factors) return null;
  const items = [
    { key: "weather",      label: "Weather",    color: "#3b82f6" },
    { key: "geopolitical", label: "Geopolit.",  color: "#8b5cf6" },
    { key: "manmade",      label: "Manmade",    color: "#ef4444" },
    { key: "seasonal",     label: "Seasonal",   color: "#06b6d4" },
  ].filter(i => factors[i.key] !== undefined);
  return (
    <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 3 }}>
      {items.map(({ key, label, color }) => {
        const pct = Math.round((factors[key] || 0) * 100);
        return (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 8, color: "#4a5166", width: 50, flexShrink: 0 }}>{label}</span>
            <div style={{ flex: 1, height: 3, background: "rgba(255,255,255,.06)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 2 }} />
            </div>
            <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 8, color, width: 24, textAlign: "right" }}>{pct}%</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── COST PANEL ───────────────────────────────────────────────────────────────
function CostPanel({ route }) {
  if (!route) return null;
  const alts = REROUTE_ALTERNATIVES[route.route_id];
  const economics = ROUTE_ECONOMICS[route.route_id];
  const needsReroute = route.status === "REROUTE" || route.status === "HOLD";
  return (
    <div style={{ marginTop: 8, background: "rgba(0,0,0,.3)", border: "1px solid #252935", borderRadius: 6, padding: "10px 12px" }}>
      <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 8, letterSpacing: "0.18em", color: "#4a5166", marginBottom: 8 }}>💰 FREIGHT COST IMPACT</div>
      {economics && (
        <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
          {[
            { label: "BASE COST", val: `$${economics.baseCost.toLocaleString()}` },
            { label: "DISTANCE",  val: `${economics.km.toLocaleString()} km` },
            { label: "TRANSIT",   val: `${economics.days}d` },
          ].map(item => (
            <div key={item.label} style={{ background: "rgba(255,255,255,.03)", borderRadius: 4, padding: "5px 8px", flex: "1 1 auto" }}>
              <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 7, color: "#4a5166" }}>{item.label}</div>
              <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: 12, color: "#e2e6f0" }}>{item.val}</div>
            </div>
          ))}
        </div>
      )}
      {needsReroute && alts && alts.length > 0 ? (
        <>
          <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 8, color: "#f97316", marginBottom: 6 }}>⚠ REROUTE OPTIONS & EXTRA FREIGHT COST</div>
          {alts.map(altId => {
            const cost = calcRerouteCost(route.route_id, altId);
            if (!cost) return null;
            const altEco = ROUTE_ECONOMICS[altId];
            return (
              <div key={altId} style={{ background: "rgba(249,115,22,.06)", border: "1px solid rgba(249,115,22,.2)", borderRadius: 5, padding: "8px 10px", marginBottom: 6 }}>
                <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: 11, color: "#f97316", marginBottom: 5 }}>→ {altId} {altEco ? `(${altEco.days}d transit)` : ""}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 8px" }}>
                  {[
                    { label: "Extra KM",    val: cost.extraKm > 0 ? `+${cost.extraKm} km` : "Shorter",  col: cost.extraKm > 0 ? "#ef4444" : "#22c55e" },
                    { label: "Extra Days",  val: cost.extraDays > 0 ? `+${cost.extraDays}d` : "Faster",  col: cost.extraDays > 0 ? "#ef4444" : "#22c55e" },
                    { label: "Holding Cost",val: `$${cost.holdingCost.toLocaleString()}`, col: "#eab308" },
                    { label: "Total Extra", val: `$${Math.abs(cost.totalExtra).toLocaleString()}`, col: cost.totalExtra > 0 ? "#ef4444" : "#22c55e" },
                  ].map(item => (
                    <div key={item.label}>
                      <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 7, color: "#4a5166" }}>{item.label}</div>
                      <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: item.col, fontWeight: 700 }}>{item.val}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </>
      ) : !needsReroute ? (
        <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "#22c55e" }}>✓ Freight corridor operating normally.</div>
      ) : (
        <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "#4a5166" }}>No direct alternative route mapped.</div>
      )}
    </div>
  );
}

// ─── THREAT PANEL (in route card) ─────────────────────────────────────────────
function ThreatPanel({ routeId }) {
  const threats = MANMADE_THREATS.filter(t => t.affectsRoutes.includes(routeId));
  if (threats.length === 0) return null;
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 8, letterSpacing: "0.18em", color: "#4a5166", marginBottom: 6 }}>⚠ MANMADE THREATS ON ROUTE</div>
      {threats.map(t => (
        <div key={t.id} style={{ background: `${THREAT_COLORS[t.type]}0d`, border: `1px solid ${THREAT_COLORS[t.type]}40`, borderRadius: 5, padding: "7px 10px", marginBottom: 5 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
            <span style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: 11, color: THREAT_COLORS[t.type] }}>{t.icon} {t.label}</span>
            <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 8, background: `${THREAT_COLORS[t.type]}25`, border: `1px solid ${THREAT_COLORS[t.type]}40`, borderRadius: 3, padding: "1px 5px", color: THREAT_COLORS[t.type] }}>{Math.round(t.severity * 100)}%</span>
          </div>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: 11, color: "#8b93a8", lineHeight: 1.4 }}>{t.desc}</div>
        </div>
      ))}
    </div>
  );
}

// ─── ROUTE CARD ───────────────────────────────────────────────────────────────
function RouteCard({ route, selected, onClick }) {
  const st = STATUS_CONFIG[route.status] || STATUS_CONFIG.PROCEED;
  const { pct, color } = riskBar(route.overall_risk);
  const hasThreats = MANMADE_THREATS.some(t => t.affectsRoutes.includes(route.route_id));
  return (
    <div onClick={() => onClick(route.route_id)} style={{
      background: selected ? "rgba(255,255,255,.04)" : "transparent",
      border: `1px solid ${selected ? st.border : "rgba(255,255,255,.06)"}`,
      borderRadius: 6, padding: "12px 14px", marginBottom: 8, cursor: "pointer", transition: "all .15s ease",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 13 }}>{TYPE_ICONS[route.type]}</span>
        <span style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: 13, color: "#e2e6f0", flex: 1 }}>{route.short}</span>
        {hasThreats && <span title="Manmade threats active" style={{ fontSize: 10 }}>⚠️</span>}
        <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, letterSpacing: "0.12em", padding: "2px 7px", borderRadius: 3, color: st.color, background: st.bg, border: `1px solid ${st.border}` }}>{route.status_label || route.status}</span>
      </div>
      <div style={{ height: 4, background: "rgba(255,255,255,.06)", borderRadius: 2, overflow: "hidden", marginBottom: 4 }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 2, transition: "width .5s ease" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "#4a5166" }}>Top: {route.top_factor}</span>
        <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color }}>{pct}%</span>
      </div>
      {selected && (
        <>
          <FactorBars factors={route.factors} />
          <RouteNodeTimeline routeId={route.route_id} routeStatus={route.status} />
          <ThreatPanel routeId={route.route_id} />
          <CostPanel route={route} />
          <AIRouteBrief route={route} />
        </>
      )}
    </div>
  );
}

// ─── ALERT BANNER ─────────────────────────────────────────────────────────────
function AlertBanner({ alerts }) {
  if (!alerts || alerts.length === 0) return null;
  const typeStyle = {
    critical:       { color: "#ef4444", bg: "rgba(239,68,68,.08)",  border: "rgba(239,68,68,.25)",  icon: "🔴" },
    warning:        { color: "#eab308", bg: "rgba(234,179,8,.08)",  border: "rgba(234,179,8,.25)",  icon: "🟡" },
    recommendation: { color: "#22c55e", bg: "rgba(34,197,94,.08)", border: "rgba(34,197,94,.25)", icon: "✅" },
    info:           { color: "#3b82f6", bg: "rgba(59,130,246,.08)", border: "rgba(59,130,246,.25)", icon: "ℹ️" },
    manmade:        { color: "#f97316", bg: "rgba(249,115,22,.08)", border: "rgba(249,115,22,.25)", icon: "⚔️" },
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {alerts.map((a, i) => {
        const s = typeStyle[a.type] || typeStyle.info;
        return (
          <div key={i} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 5, padding: "9px 12px", display: "flex", gap: 8, alignItems: "flex-start" }}>
            <span style={{ fontSize: 12, flexShrink: 0 }}>{s.icon}</span>
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: s.color, lineHeight: 1.5 }}>{a.message}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── SYSTEM STATUS BADGE ──────────────────────────────────────────────────────
function SystemStatusBadge({ status }) {
  const config = {
    NORMAL:            { color: "#22c55e", label: "ALL CLEAR",         bg: "rgba(34,197,94,.08)"  },
    ADVISORY:          { color: "#eab308", label: "ADVISORY",          bg: "rgba(234,179,8,.08)"  },
    ELEVATED:          { color: "#f97316", label: "ELEVATED RISK",     bg: "rgba(249,115,22,.08)" },
    CRITICAL:          { color: "#ef4444", label: "CRITICAL",          bg: "rgba(239,68,68,.08)"  },
    MARITIME_HOLD_ALL: { color: "#ef4444", label: "MARITIME HOLD ALL", bg: "rgba(239,68,68,.12)"  },
  };
  const c = config[status] || config.NORMAL;
  return (
    <div style={{ background: c.bg, border: `1px solid ${c.color}33`, borderRadius: 5, padding: "8px 14px", marginBottom: 16 }}>
      <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, letterSpacing: "0.2em", color: "#4a5166", marginBottom: 2 }}>FREIGHT SYSTEM STATUS</div>
      <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: 16, color: c.color }}>{c.label}</div>
    </div>
  );
}

// ─── THREAT SEVERITY RING ─────────────────────────────────────────────────────
function SeverityRing({ severity, color, size = 40 }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * severity;
  const gap = circ - dash;
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth={3} />
      <circle
        cx={size/2} cy={size/2} r={r}
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeDasharray={`${dash} ${gap}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ filter: `drop-shadow(0 0 3px ${color}80)` }}
      />
      <text x={size/2} y={size/2 + 4} textAnchor="middle" fill={color} fontSize={9} fontFamily="JetBrains Mono, monospace" fontWeight="700">
        {Math.round(severity * 100)}
      </text>
    </svg>
  );
}

// ─── ENHANCED THREATS TAB ─────────────────────────────────────────────────────
function ThreatsTab({ routes }) {
  const [sortBy, setSortBy] = useState("severity");
  const [filterType, setFilterType] = useState("all");
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  const types = ["all", ...Array.from(new Set(MANMADE_THREATS.map(t => t.type)))];
  const sorted = [...MANMADE_THREATS]
    .filter(t => filterType === "all" || t.type === filterType)
    .sort((a, b) => sortBy === "severity" ? b.severity - a.severity : a.type.localeCompare(b.type));

  const getRouteRisk = (routeId) => {
    const r = routes?.find(x => x.route_id === routeId);
    return r ? { risk: r.overall_risk, status: r.status } : null;
  };

  const generateThreatIntel = async () => {
    setAiLoading(true);
    try {
      const threatSummary = MANMADE_THREATS.map(t =>
        `${t.label} (${t.type}, severity ${Math.round(t.severity * 100)}%): ${t.desc}`
      ).join("\n");

      const prompt = `You are a freight intelligence analyst. Given these active manmade threat zones affecting Indian supply chains:\n\n${threatSummary}\n\nWrite a 3-sentence executive summary: (1) most critical threats requiring immediate action, (2) which trade corridors are most impacted, (3) recommended strategic posture. Be direct and specific. No headers.`;

      const text = await callGemini(prompt);
      setAiSummary(text || "Unable to generate.");
    } catch {
      setAiSummary("Threat intel generation failed.");
    }
    setAiLoading(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Header controls */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 8, color: "#4a5166", alignSelf: "center", flexShrink: 0 }}>SORT:</div>
        {["severity", "type"].map(s => (
          <button key={s} onClick={() => setSortBy(s)} style={{
            fontFamily: "JetBrains Mono, monospace", fontSize: 8, padding: "3px 8px", borderRadius: 3, cursor: "pointer",
            background: sortBy === s ? "rgba(167,139,250,.12)" : "transparent",
            border: `1px solid ${sortBy === s ? "rgba(167,139,250,.3)" : "rgba(255,255,255,.08)"}`,
            color: sortBy === s ? "#a78bfa" : "#4a5166",
          }}>{s.toUpperCase()}</button>
        ))}
        <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 8, color: "#4a5166", alignSelf: "center", marginLeft: 4, flexShrink: 0 }}>TYPE:</div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{
          fontFamily: "JetBrains Mono, monospace", fontSize: 8, padding: "3px 6px", borderRadius: 3,
          background: "#13161e", border: "1px solid #252935", color: "#8b93a8", cursor: "pointer",
          maxWidth: 90,
       }}>
          {types.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
        </select>
      </div>

      {/* AI Threat Intel */}
      <div style={{ background: "rgba(239,68,68,.04)", border: "1px solid rgba(239,68,68,.15)", borderRadius: 7, overflow: "hidden" }}>
        <button onClick={aiSummary || aiLoading ? undefined : generateThreatIntel} style={{
          width: "100%", background: "transparent", border: "none", cursor: aiSummary ? "default" : "pointer",
          padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12 }}>🛡️</span>
            <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, letterSpacing: "0.15em", color: "#ef4444" }}>SIGINT THREAT SUMMARY</span>
          </div>
          {!aiSummary && !aiLoading && <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 8, color: "#ef4444" }}>GENERATE ▶</span>}
          {aiLoading && <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 8, color: "#4a5166" }}>ANALYZING…</span>}
        </button>
        {(aiSummary || aiLoading) && (
          <div style={{ padding: "0 12px 12px", borderTop: "1px solid rgba(239,68,68,.1)" }}>
            {aiLoading ? (
              <div style={{ display: "flex", gap: 8, alignItems: "center", paddingTop: 10 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444", animation: "pulse 1s infinite" }} />
                <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "#4a5166" }}>Processing threat data…</span>
              </div>
            ) : (
              <div style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: "#8b93a8", lineHeight: 1.7, paddingTop: 10 }}>{aiSummary}</div>
            )}
          </div>
        )}
      </div>

      {/* Threat cards */}
      {sorted.map(t => {
        const affectedRouteData = t.affectsRoutes.map(rid => ({ rid, data: getRouteRisk(rid) }));
        return (
          <div key={t.id} style={{ background: `${THREAT_COLORS[t.type]}08`, border: `1px solid ${THREAT_COLORS[t.type]}35`, borderRadius: 7, padding: "12px" }}>
            {/* Card header */}
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
              <SeverityRing severity={t.severity} color={THREAT_COLORS[t.type]} size={42} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: 12, color: THREAT_COLORS[t.type], marginBottom: 2, lineHeight: 1.3 }}>{t.icon} {t.label}</div>
                <div style={{ display: "flex", gap: 4 }}>
                  <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 8, background: `${THREAT_COLORS[t.type]}20`, border: `1px solid ${THREAT_COLORS[t.type]}40`, borderRadius: 3, padding: "1px 5px", color: THREAT_COLORS[t.type], textTransform: "uppercase" }}>{t.type}</span>
                </div>
              </div>
            </div>

            {/* Description */}
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: 11, color: "#8b93a8", lineHeight: 1.5, marginBottom: 8 }}>{t.desc}</div>

            {/* Affected routes impact table */}
            {affectedRouteData.length > 0 && (
              <div style={{ background: "rgba(0,0,0,.2)", borderRadius: 5, padding: "8px 10px" }}>
                <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 7, letterSpacing: "0.15em", color: "#4a5166", marginBottom: 6 }}>FREIGHT ROUTE IMPACT</div>
                {affectedRouteData.map(({ rid, data }) => {
                  const routeInfo = ROUTE_ECONOMICS[rid];
                  const st = data ? (STATUS_CONFIG[data.status] || STATUS_CONFIG.PROCEED) : null;
                  return (
                    <div key={rid} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, color: "#e2e6f0", flex: 1 }}>{rid}</span>
                      {routeInfo && <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 8, color: "#4a5166" }}>{routeInfo.km.toLocaleString()} km</span>}
                      {data && st ? (
                        <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 8, padding: "1px 5px", borderRadius: 3, color: st.color, background: st.bg, border: `1px solid ${st.border}` }}>
                          {data.status} {Math.round(data.risk * 100)}%
                        </span>
                      ) : (
                        <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 8, color: "#4a5166" }}>—</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Coordinates */}
            <div style={{ marginTop: 6, fontFamily: "JetBrains Mono, monospace", fontSize: 8, color: "#4a5166" }}>
              📍 {t.lat.toFixed(2)}°N {t.lng.toFixed(2)}°E
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── THREAT MARKERS ON MAP ────────────────────────────────────────────────────
function ThreatMarkers({ visible }) {
  if (!visible) return null;
  return (
    <>
      {MANMADE_THREATS.map(t => (
        <CircleMarker key={t.id} center={[t.lat, t.lng]} radius={8 + t.severity * 10}
          pathOptions={{ color: THREAT_COLORS[t.type], fillColor: THREAT_COLORS[t.type], fillOpacity: 0.25, weight: 2, dashArray: "4 3" }}>
          <Tooltip direction="top" permanent={false}>
            <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12, maxWidth: 280, lineHeight: 1.5 }}>
              <div style={{ color: THREAT_COLORS[t.type], fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{t.icon} {t.label}</div>
              <div style={{ color: "#e2e6f0", fontSize: 11, marginBottom: 6 }}>{t.desc}</div>
              <div style={{ display: "flex", gap: 12 }}>
                <div><div style={{ color: "#4a5166", fontSize: 9 }}>TYPE</div><div style={{ color: THREAT_COLORS[t.type], fontSize: 11, textTransform: "uppercase" }}>{t.type}</div></div>
                <div><div style={{ color: "#4a5166", fontSize: 9 }}>SEVERITY</div><div style={{ color: THREAT_COLORS[t.type], fontSize: 11, fontWeight: 700 }}>{Math.round(t.severity * 100)}%</div></div>
                <div><div style={{ color: "#4a5166", fontSize: 9 }}>AFFECTS</div><div style={{ color: "#8b93a8", fontSize: 10 }}>{t.affectsRoutes.join(", ")}</div></div>
              </div>
            </div>
          </Tooltip>
        </CircleMarker>
      ))}
    </>
  );
}

// ─── ROUTE NODE MARKERS ON MAP ────────────────────────────────────────────────
function RouteNodeMarkers({ routeId, routeColor }) {
  const nodes = ROUTE_NODES[routeId];
  if (!nodes) return null;
  return (
    <>
      {nodes.map((node, i) => {
        const isEndpoint = i === 0 || i === nodes.length - 1;
        const nodeColor = node.risk ? NODE_RISK_COLORS[node.risk] : (isEndpoint ? routeColor : "rgba(255,255,255,.4)");
        const radius = isEndpoint ? 6 : (node.type === "chokepoint" ? 5 : (node.risk ? 4 : 3));
        return (
          <CircleMarker key={i} center={[node.lat, node.lng]} radius={radius}
            pathOptions={{ color: nodeColor, fillColor: nodeColor, fillOpacity: isEndpoint ? 1 : 0.7, weight: isEndpoint ? 2 : 1 }}>
            <Tooltip direction="top">
              <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, lineHeight: 1.5 }}>
                <div style={{ color: nodeColor, fontWeight: 700 }}>{NODE_TYPE_ICONS[node.type]} {node.name}</div>
                <div style={{ color: "#4a5166", fontSize: 9, textTransform: "uppercase" }}>{node.type}{node.risk ? ` — ${node.risk} risk` : ""}</div>
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </>
  );
}

// ─── BIG MAP TOOLTIP ──────────────────────────────────────────────────────────
function BigRouteTooltip({ route, segIdx, total, hotInfo }) {
  const st = STATUS_CONFIG[route.status] || STATUS_CONFIG.PROCEED;
  const eco = ROUTE_ECONOMICS[route.route_id];
  const threats = MANMADE_THREATS.filter(t => t.affectsRoutes.includes(route.route_id));
  const { pct, color } = riskBar(route.overall_risk);
  const nodes = ROUTE_NODES[route.route_id] || [];
  const chokepoints = nodes.filter(n => n.type === "chokepoint");
  return (
    <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, lineHeight: 1.5, minWidth: 300, maxWidth: 360 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, paddingBottom: 7, borderBottom: "1px solid rgba(255,255,255,.08)" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e6f0", fontFamily: "Syne, sans-serif" }}>{TYPE_ICONS[route.type]} {route.short}</div>
          <div style={{ fontSize: 9, color: "#4a5166", marginTop: 2 }}>{route.name}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color, fontFamily: "Syne, sans-serif" }}>{pct}%</div>
          <div style={{ fontSize: 8, padding: "1px 6px", borderRadius: 3, color: st.color, background: st.bg, border: `1px solid ${st.border}`, textAlign: "center" }}>{route.status_label || route.status}</div>
        </div>
      </div>
      {segIdx !== undefined && (
        <div style={{ fontSize: 9, color: "#4a5166", marginBottom: 6 }}>
          Segment {segIdx + 1} / {total}
          {hotInfo && <span style={{ color: THREAT_COLORS[hotInfo.threat.type], marginLeft: 8 }}>● THREAT ZONE</span>}
        </div>
      )}
      {route.factors && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 9, color: "#4a5166", letterSpacing: "0.12em", marginBottom: 4 }}>RISK BREAKDOWN</div>
          {[
            { key: "weather",      label: "🌩 Weather",    color: "#3b82f6" },
            { key: "geopolitical", label: "🌍 Geopolit.",  color: "#8b5cf6" },
            { key: "manmade",      label: "⚔️ Manmade",    color: "#ef4444" },
            { key: "seasonal",     label: "📅 Seasonal",   color: "#06b6d4" },
          ].filter(i => route.factors[i.key] !== undefined).map(({ key, label, color: c }) => {
            const p = Math.round((route.factors[key] || 0) * 100);
            return (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                <span style={{ fontSize: 9, color: "#4a5166", width: 68, flexShrink: 0 }}>{label}</span>
                <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,.06)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${p}%`, background: c, borderRadius: 2 }} />
                </div>
                <span style={{ fontSize: 9, color: c, width: 28, textAlign: "right", fontWeight: 700 }}>{p}%</span>
              </div>
            );
          })}
        </div>
      )}
      {eco && (
        <div style={{ display: "flex", gap: 10, marginBottom: 8, paddingBottom: 7, borderBottom: "1px solid rgba(255,255,255,.08)" }}>
          <div><div style={{ fontSize: 8, color: "#4a5166" }}>CARGO COST</div><div style={{ fontSize: 11, color: "#e2e6f0", fontWeight: 700 }}>${eco.baseCost.toLocaleString()}</div></div>
          <div><div style={{ fontSize: 8, color: "#4a5166" }}>DISTANCE</div><div style={{ fontSize: 11, color: "#e2e6f0", fontWeight: 700 }}>{eco.km.toLocaleString()} km</div></div>
          <div><div style={{ fontSize: 8, color: "#4a5166" }}>TRANSIT</div><div style={{ fontSize: 11, color: "#e2e6f0", fontWeight: 700 }}>{eco.days}d</div></div>
          <div><div style={{ fontSize: 8, color: "#4a5166" }}>NODES</div><div style={{ fontSize: 11, color: "#e2e6f0", fontWeight: 700 }}>{nodes.length}</div></div>
        </div>
      )}
      {chokepoints.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 8, color: "#4a5166", letterSpacing: "0.12em", marginBottom: 4 }}>CHOKEPOINTS ({chokepoints.length})</div>
          {chokepoints.map((cp, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
              <span style={{ color: cp.risk ? NODE_RISK_COLORS[cp.risk] : "#eab308" }}>⚠</span>
              <span style={{ fontSize: 10, color: cp.risk ? NODE_RISK_COLORS[cp.risk] : "#eab308" }}>{cp.name}</span>
              {cp.risk && <span style={{ fontSize: 8, color: NODE_RISK_COLORS[cp.risk] }}>{cp.risk.toUpperCase()}</span>}
            </div>
          ))}
        </div>
      )}
      {threats.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 9, color: "#4a5166", letterSpacing: "0.12em", marginBottom: 4 }}>ACTIVE THREATS ON ROUTE</div>
          {threats.map(t => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
              <span>{t.icon}</span>
              <span style={{ flex: 1, fontSize: 10, color: THREAT_COLORS[t.type] }}>{t.label}</span>
              <span style={{ fontSize: 9, color: THREAT_COLORS[t.type], fontWeight: 700 }}>{Math.round(t.severity * 100)}%</span>
            </div>
          ))}
        </div>
      )}
      {hotInfo && (
        <div style={{ background: `${THREAT_COLORS[hotInfo.threat.type]}18`, border: `1px solid ${THREAT_COLORS[hotInfo.threat.type]}40`, borderRadius: 4, padding: "6px 8px", marginTop: 4 }}>
          <div style={{ color: THREAT_COLORS[hotInfo.threat.type], fontWeight: 700, fontSize: 10, marginBottom: 2 }}>{hotInfo.threat.icon} {hotInfo.threat.label}</div>
          <div style={{ color: "#8b93a8", fontSize: 10 }}>{hotInfo.threat.desc}</div>
          <div style={{ color: THREAT_COLORS[hotInfo.threat.type], fontSize: 9, marginTop: 3 }}>Severity: {Math.round(hotInfo.severity * 100)}%</div>
        </div>
      )}
      <div style={{ marginTop: 8, fontSize: 9, color: "#4a5166", textAlign: "center" }}>Click again to deselect • Goods flow only</div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [routes,          setRoutes]          = useState([]);
  const [alerts,          setAlerts]          = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [systemStatus,    setSystemStatus]    = useState("NORMAL");
  const [loading,         setLoading]         = useState(false);
  const [selectedRoute,   setSelectedRoute]   = useState(null);
  const [activeScenario,  setActiveScenario]  = useState(null);
  const [scenarioName,    setScenarioName]    = useState(null);
  const [error,           setError]           = useState(null);
  const [activeTab,       setActiveTab]       = useState("routes");
  const [mapCenter,       setMapCenter]       = useState([22, 82]);
  const [mapZoom,         setMapZoom]         = useState(4);
  const [apiStatus,       setApiStatus]       = useState(null);
  const [lastUpdated,     setLastUpdated]     = useState(null);
  const [showThreats,     setShowThreats]     = useState(true);
  const [flyKey,          setFlyKey]          = useState(0);

  const fetchLiveData = useCallback(async () => {
    setLoading(true); setError(null); setActiveScenario(null); setScenarioName(null);
    try {
      const resp = await axios.post(`${API_BASE}/route-risk`, { route_ids: null });
      const data = resp.data;
      setRoutes(data.routes || []);
      setSystemStatus(data.system_status || "NORMAL");
      setRecommendations(data.recommendations || []);
      setAlerts([]);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch {
      setError("Cannot reach backend. Is FastAPI running on port 8000?");
      loadFallbackData();
    } finally { setLoading(false); }
  }, []);

  const runDemo = useCallback(async (scenarioId) => {
    setLoading(true); setError(null);
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
    } catch {
      setError("Demo failed. Using local fallback.");
      runLocalScenario(scenarioId);
    } finally { setLoading(false); }
  }, []);

  const checkApiHealth = useCallback(async () => {
    try {
      const resp = await axios.get(`${API_BASE}/health`, { timeout: 3000 });
      setApiStatus(resp.data.apis);
    } catch { setApiStatus(null); }
  }, []);

  useEffect(() => { loadFallbackData(); checkApiHealth(); }, []);

  function loadFallbackData() {
    setRoutes(FALLBACK_ROUTES);
    setSystemStatus("ELEVATED");
    setAlerts(DEFAULT_ALERTS);
    setRecommendations([]);
    setLastUpdated(new Date().toLocaleTimeString() + " (static)");
  }

  function runLocalScenario(id) {
    const s = LOCAL_SCENARIOS[id];
    if (!s) return;
    const updated = FALLBACK_ROUTES.map(r => ({
      ...r, ...(s.overrides[r.route_id] || {}),
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
    if (risk >= 0.8)  return "#ef4444";
    if (risk >= 0.65) return "#f97316";
    if (risk >= 0.35) return "#eab308";
    return "#22c55e";
  }

  function handleRouteClick(routeId) {
    const newId = routeId === selectedRoute ? null : routeId;
    setSelectedRoute(newId);
    if (newId) {
      const r = routes.find(x => x.route_id === newId);
      if (r && r.waypoints && r.waypoints.length > 0) {
        const mid = r.waypoints[Math.floor(r.waypoints.length / 2)];
        setMapCenter([mid[0], mid[1]]);
        setMapZoom(r.type === "sea" ? 4 : 5);
        setFlyKey(k => k + 1);
        setActiveTab("routes");
      }
    }
  }

  function getHotSegments(route) {
    if (!route) return [];
    const threats = MANMADE_THREATS.filter(t => t.affectsRoutes.includes(route.route_id));
    if (threats.length === 0) return [];
    const segments = [];
    const wps = route.waypoints;
    for (let i = 0; i < wps.length - 1; i++) {
      const segMidLat = (wps[i][0] + wps[i+1][0]) / 2;
      const segMidLng = (wps[i][1] + wps[i+1][1]) / 2;
      let maxSeverity = 0, closestThreat = null;
      for (const t of threats) {
        const dist = Math.sqrt(Math.pow(segMidLat - t.lat, 2) + Math.pow(segMidLng - t.lng, 2));
        if (dist < 12 && t.severity > maxSeverity) { maxSeverity = t.severity; closestThreat = t; }
      }
      if (closestThreat) segments.push({ idx: i, severity: maxSeverity, threat: closestThreat });
    }
    return segments;
  }

  const selectedRouteObj = routes.find(r => r.route_id === selectedRoute) || null;
  const hotSegments = getHotSegments(selectedRouteObj);
  const hotSegmentIdxs = new Set(hotSegments.map(s => s.idx));

  const seaRoutes  = routes.filter(r => r.type === "sea");
  const roadRoutes = routes.filter(r => r.type === "road");
  const railRoutes = routes.filter(r => r.type === "rail");

  return (
    <div style={{ display: "flex", height: "100vh", background: "#0d0f14", fontFamily: "Inter, sans-serif", overflow: "hidden" }}>

      {/* ── SIDEBAR ── */}
      <div style={{ width: 340, minWidth: 340, height: "100vh", background: "#13161e", borderRight: "1px solid #252935", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ padding: "20px 20px 14px", borderBottom: "1px solid #252935" }}>
          <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, letterSpacing: "0.25em", color: "#a78bfa", marginBottom: 6 }}>▸ SUPPLY CHAIN INTELLIGENCE</div>
          <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: 20, color: "#e2e6f0", lineHeight: 1.2 }}>India Freight<br />Risk Monitor</div>
          <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
            {["🚛 Road Freight", "🚂 Rail Freight", "🚢 Sea Cargo", "⚔️ Threats"].map(t => (
              <span key={t} style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, padding: "2px 8px", borderRadius: 3, background: "rgba(167,139,250,.08)", border: "1px solid rgba(167,139,250,.2)", color: "#a78bfa" }}>{t}</span>
            ))}
          </div>
        </div>

        {/* Scenarios */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #252935" }}>
          <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, letterSpacing: "0.2em", color: "#4a5166", marginBottom: 8 }}>DEMO SCENARIOS</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {DEMO_SCENARIOS.map(s => (
              <button key={s.id} onClick={() => runDemo(s.id)} style={{
                background: activeScenario === s.id ? `${s.color}18` : "rgba(255,255,255,.03)",
                border: `1px solid ${activeScenario === s.id ? s.color + "50" : "rgba(255,255,255,.08)"}`,
                borderRadius: 5, padding: "7px 12px", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 8,
                color: activeScenario === s.id ? s.color : "#8b93a8",
                fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 500, transition: "all .15s",
              }}>
                <span>{s.icon}</span><span>{s.label}</span>
                {activeScenario === s.id && <span style={{ marginLeft: "auto", fontFamily: "JetBrains Mono, monospace", fontSize: 8, color: s.color }}>ACTIVE</span>}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button onClick={fetchLiveData} disabled={loading} style={{
              flex: 1, background: "rgba(34,197,94,.08)", border: "1px solid rgba(34,197,94,.25)",
              borderRadius: 5, padding: "7px 10px", cursor: "pointer", color: "#22c55e",
              fontFamily: "JetBrains Mono, monospace", fontSize: 10, letterSpacing: "0.12em",
            }}>{loading ? "LOADING…" : "⟳ LIVE DATA"}</button>
            <button onClick={() => setShowThreats(v => !v)} style={{
              background: showThreats ? "rgba(249,115,22,.1)" : "rgba(255,255,255,.03)",
              border: `1px solid ${showThreats ? "rgba(249,115,22,.3)" : "rgba(255,255,255,.08)"}`,
              borderRadius: 5, padding: "7px 10px", cursor: "pointer",
              color: showThreats ? "#f97316" : "#4a5166",
              fontFamily: "JetBrains Mono, monospace", fontSize: 10,
            }}>{showThreats ? "⚔ ON" : "⚔ OFF"}</button>
            {selectedRoute && (
              <button onClick={() => setSelectedRoute(null)} style={{
                background: "rgba(167,139,250,.08)", border: "1px solid rgba(167,139,250,.25)",
                borderRadius: 5, padding: "7px 10px", cursor: "pointer",
                color: "#a78bfa", fontFamily: "JetBrains Mono, monospace", fontSize: 10,
              }}>✕ RESET</button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid #252935" }}>
          {["routes", "alerts", "recs", "threats"].map(t => (
            <button key={t} onClick={() => setActiveTab(t)} style={{
              flex: 1, padding: "10px 0",
              background: activeTab === t ? "rgba(167,139,250,.06)" : "transparent",
              border: "none", borderBottom: activeTab === t ? "2px solid #a78bfa" : "2px solid transparent",
              cursor: "pointer", color: activeTab === t ? "#a78bfa" : "#4a5166",
              fontFamily: "JetBrains Mono, monospace", fontSize: 8, letterSpacing: "0.12em", transition: "all .15s",
            }}>
              {t === "routes" ? "ROUTES" : t === "alerts" ? `ALERTS${alerts.length ? ` (${alerts.length})` : ""}` : t === "recs" ? "RECS" : "THREATS"}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, overflow: "auto", padding: "12px 12px" }}>
          {activeTab === "routes" && (
            <>
              <SystemStatusBadge status={systemStatus} />
              {selectedRoute && (
                <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, color: "#a78bfa", background: "rgba(167,139,250,.08)", border: "1px solid rgba(167,139,250,.25)", borderRadius: 4, padding: "5px 10px", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>🔍 ROUTE ISOLATED — click again to reset</span>
                  <button onClick={() => setSelectedRoute(null)} style={{ background: "none", border: "none", color: "#a78bfa", cursor: "pointer", fontSize: 11 }}>✕</button>
                </div>
              )}
              {scenarioName && <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: 13, color: "#e2e6f0", marginBottom: 10 }}>{scenarioName}</div>}
              {seaRoutes.length > 0 && (
                <>
                  <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, letterSpacing: "0.2em", color: "#4a5166", marginBottom: 6, marginTop: 4 }}>🚢 MARITIME CARGO ({seaRoutes.length})</div>
                  {seaRoutes.map(r => <RouteCard key={r.route_id} route={r} selected={selectedRoute === r.route_id} onClick={handleRouteClick} />)}
                </>
              )}
              {roadRoutes.length > 0 && (
                <>
                  <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, letterSpacing: "0.2em", color: "#4a5166", marginBottom: 6, marginTop: 12 }}>🚛 ROAD FREIGHT ({roadRoutes.length})</div>
                  {roadRoutes.map(r => <RouteCard key={r.route_id} route={r} selected={selectedRoute === r.route_id} onClick={handleRouteClick} />)}
                </>
              )}
              {railRoutes.length > 0 && (
                <>
                  <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, letterSpacing: "0.2em", color: "#4a5166", marginBottom: 6, marginTop: 12 }}>🚂 RAIL FREIGHT ({railRoutes.length})</div>
                  {railRoutes.map(r => <RouteCard key={r.route_id} route={r} selected={selectedRoute === r.route_id} onClick={handleRouteClick} />)}
                </>
              )}
            </>
          )}

          {activeTab === "alerts" && (
            alerts.length > 0
              ? <AlertBanner alerts={alerts} />
              : <div style={{ color: "#4a5166", fontFamily: "JetBrains Mono, monospace", fontSize: 11, textAlign: "center", marginTop: 24 }}>No active alerts. Run a scenario or fetch live data.</div>
          )}

          {activeTab === "recs" && (
            recommendations.length > 0
              ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {recommendations.map((r, i) => (
                    <div key={i} style={{ background: r.priority === "critical" ? "rgba(239,68,68,.06)" : "rgba(34,197,94,.06)", border: `1px solid ${r.priority === "critical" ? "rgba(239,68,68,.25)" : "rgba(34,197,94,.25)"}`, borderRadius: 5, padding: "10px 12px" }}>
                      <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "#f97316", marginBottom: 4 }}>{r.from} {r.to ? `→ ${r.to}` : "→ HOLD"}</div>
                      <div style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: "#8b93a8" }}>{r.reason}</div>
                    </div>
                  ))}
                </div>
              )
              : <div style={{ color: "#4a5166", fontFamily: "JetBrains Mono, monospace", fontSize: 11, textAlign: "center", marginTop: 24 }}>No reroute recommendations active.</div>
          )}

          {activeTab === "threats" && <ThreatsTab routes={routes} />}
        </div>

        {/* Footer */}
        <div style={{ padding: "10px 16px", borderTop: "1px solid #252935", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 8, color: "#4a5166" }}>{lastUpdated ? `Updated ${lastUpdated}` : "—"}</span>
          {apiStatus && (
            <div style={{ display: "flex", gap: 4 }}>
              {Object.entries(apiStatus).map(([k, v]) => (
                <span key={k} style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 7, padding: "1px 5px", borderRadius: 2, background: v === "ok" ? "rgba(34,197,94,.1)" : "rgba(239,68,68,.1)", color: v === "ok" ? "#22c55e" : "#ef4444", border: `1px solid ${v === "ok" ? "rgba(34,197,94,.3)" : "rgba(239,68,68,.3)"}` }}>
                  {k === "tomorrow_io" ? "T.IO" : "OWM"} {v === "ok" ? "●" : "○"}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── MAP AREA ── */}
      <div style={{ flex: 1, position: "relative" }}>
        {error && (
          <div style={{ position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 1000, background: "rgba(239,68,68,.12)", border: "1px solid rgba(239,68,68,.35)", borderRadius: 6, padding: "10px 18px", fontFamily: "Inter, sans-serif", fontSize: 12, color: "#ef4444", whiteSpace: "nowrap" }}>⚠️ {error}</div>
        )}
        {loading && (
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(13,15,20,.6)", backdropFilter: "blur(2px)" }}>
            <div style={{ fontFamily: "Syne, sans-serif", fontSize: 16, fontWeight: 700, color: "#a78bfa" }}>Fetching freight route data…</div>
          </div>
        )}

        {/* Selected route overlay */}
        {selectedRouteObj && (
          <div style={{ position: "absolute", bottom: 24, left: 24, zIndex: 998, background: "rgba(13,15,20,.95)", border: `1px solid ${STATUS_CONFIG[selectedRouteObj.status]?.border || "#252935"}`, borderRadius: 8, padding: "12px 16px", minWidth: 240, maxWidth: 320 }}>
            <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 8, letterSpacing: "0.15em", color: "#4a5166", marginBottom: 4 }}>SELECTED FREIGHT ROUTE</div>
            <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: 14, color: "#e2e6f0", marginBottom: 8 }}>{selectedRouteObj.name}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,.06)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.round(selectedRouteObj.overall_risk * 100)}%`, background: riskBar(selectedRouteObj.overall_risk).color, borderRadius: 3 }} />
              </div>
              <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12, fontWeight: 700, color: riskBar(selectedRouteObj.overall_risk).color }}>{Math.round(selectedRouteObj.overall_risk * 100)}%</span>
              <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, padding: "2px 7px", borderRadius: 3, color: STATUS_CONFIG[selectedRouteObj.status]?.color, background: STATUS_CONFIG[selectedRouteObj.status]?.bg, border: `1px solid ${STATUS_CONFIG[selectedRouteObj.status]?.border}` }}>{selectedRouteObj.status}</span>
            </div>
            {ROUTE_NODES[selectedRouteObj.route_id] && (
              <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 8, color: "#4a5166", marginBottom: 4 }}>
                📍 {ROUTE_NODES[selectedRouteObj.route_id].length} waypoints
                {" · "}
                {ROUTE_NODES[selectedRouteObj.route_id].filter(n => n.type === "chokepoint").length} chokepoints
                {" · "}
                {ROUTE_NODES[selectedRouteObj.route_id].filter(n => n.risk).length} risk nodes
              </div>
            )}
            {hotSegments.length > 0 && (
              <div style={{ marginTop: 4, fontFamily: "JetBrains Mono, monospace", fontSize: 8, color: "#ef4444" }}>● {hotSegments.length} HIGH-RISK SEGMENT{hotSegments.length > 1 ? "S" : ""} HIGHLIGHTED</div>
            )}
            <button onClick={() => setSelectedRoute(null)} style={{ marginTop: 8, width: "100%", background: "rgba(255,255,255,.04)", border: "1px solid #252935", borderRadius: 4, padding: "5px", cursor: "pointer", fontFamily: "JetBrains Mono, monospace", fontSize: 9, color: "#4a5166" }}>
              ✕ DESELECT / SHOW ALL ROUTES
            </button>
          </div>
        )}

        {/* Legend */}
        <div style={{ position: "absolute", top: 16, right: 16, zIndex: 998, background: "rgba(13,15,20,.92)", border: "1px solid #252935", borderRadius: 8, padding: "12px 16px", minWidth: 170 }}>
          <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 8, letterSpacing: "0.2em", color: "#4a5166", marginBottom: 8 }}>FREIGHT RISK LEGEND</div>
          {[
            { color: "#22c55e", label: "PROCEED  < 35%" },
            { color: "#eab308", label: "MONITOR  35–65%" },
            { color: "#f97316", label: "REROUTE  65–80%" },
            { color: "#ef4444", label: "HOLD     > 80%"  },
          ].map(l => (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
              <div style={{ width: 24, height: 3, background: l.color, borderRadius: 1 }} />
              <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, color: "#8b93a8" }}>{l.label}</span>
            </div>
          ))}
          <div style={{ borderTop: "1px solid #252935", marginTop: 8, paddingTop: 8 }}>
            <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 8, color: "#4a5166", marginBottom: 5 }}>WAYPOINT NODES</div>
            {[
              { color: "#e2e6f0", label: "Port / Hub" },
              { color: "#eab308", label: "Chokepoint ◆" },
              { color: "#ef4444", label: "Critical node" },
              { color: "#f97316", label: "High-risk node" },
            ].map(l => (
              <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: l.color, opacity: 0.8 }} />
                <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 8, color: "#4a5166" }}>{l.label}</span>
              </div>
            ))}
          </div>
          <div style={{ borderTop: "1px solid #252935", marginTop: 6, paddingTop: 6 }}>
            <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 8, color: "#4a5166", marginBottom: 5 }}>THREATS</div>
            {Object.entries(THREAT_COLORS).map(([type, color]) => (
              <div key={type} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, opacity: 0.7 }} />
                <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 8, color: "#4a5166", textTransform: "capitalize" }}>{type}</span>
              </div>
            ))}
          </div>
          <div style={{ borderTop: "1px solid #252935", marginTop: 6, paddingTop: 6 }}>
            <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 8, color: "#ef4444" }}>━━ Threat segment</div>
            <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 8, color: "#a78bfa", marginTop: 2 }}>Click route → isolate</div>
            <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 8, color: "#4a5166", marginTop: 1 }}>Click again → show all</div>
          </div>
        </div>

        <MapContainer center={mapCenter} zoom={4} style={{ width: "100%", height: "100%" }} zoomControl={false}>
          <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution="&copy; OpenStreetMap contributors &copy; CARTO" />
          {selectedRouteObj && <MapFlyTo key={flyKey} center={mapCenter} zoom={mapZoom} />}
          <ThreatMarkers visible={showThreats} />

          {routes.map(route => {
            const style = ROUTE_STYLES[route.type] || ROUTE_STYLES.road;
            const isSelected = selectedRoute === route.route_id;
            const isHidden = selectedRoute !== null && !isSelected;
            const positions = route.waypoints.map(w => [w[0], w[1]]);
            if (isHidden) return null;

            if (isSelected) {
              return (
                <React.Fragment key={route.route_id}>
                  <Polyline positions={positions} pathOptions={{ color: route.color || "#22c55e", weight: style.weight + 10, opacity: 0.15 }} />
                  {positions.slice(0, -1).map((pos, i) => {
                    const isHot = hotSegmentIdxs.has(i);
                    const hotInfo = isHot ? hotSegments.find(s => s.idx === i) : null;
                    return (
                      <React.Fragment key={i}>
                        {isHot && <Polyline positions={[positions[i], positions[i+1]]} pathOptions={{ color: THREAT_COLORS[hotInfo.threat.type] || "#ef4444", weight: style.weight + 12, opacity: 0.3 }} />}
                        <Polyline
                          positions={[positions[i], positions[i+1]]}
                          pathOptions={{ color: isHot ? (THREAT_COLORS[hotInfo.threat.type] || "#ef4444") : (route.color || "#22c55e"), weight: isHot ? style.weight + 3 : style.weight + 1, dashArray: isHot ? null : style.dashArray, opacity: 1 }}
                          eventHandlers={{ click: () => handleRouteClick(route.route_id) }}
                        >
                          <Tooltip sticky direction="top">
                            <BigRouteTooltip route={route} segIdx={i} total={positions.length - 1} hotInfo={isHot ? hotInfo : null} />
                          </Tooltip>
                        </Polyline>
                      </React.Fragment>
                    );
                  })}
                  <RouteNodeMarkers routeId={route.route_id} routeColor={route.color || "#22c55e"} />
                </React.Fragment>
              );
            }

            return (
              <React.Fragment key={route.route_id}>
                <Polyline
                  positions={positions}
                  pathOptions={{ color: route.color || "#22c55e", weight: style.weight, dashArray: style.dashArray, opacity: 0.75 }}
                  eventHandlers={{ click: () => handleRouteClick(route.route_id) }}
                >
                  <Tooltip sticky direction="top"><BigRouteTooltip route={route} /></Tooltip>
                </Polyline>
                {positions.length > 0 && (
                  <CircleMarker center={positions[0]} radius={4} pathOptions={{ color: route.color, fillColor: route.color, fillOpacity: 0.8, weight: 1 }}>
                    <Tooltip><div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11 }}>{route.name}</div></Tooltip>
                  </CircleMarker>
                )}
              </React.Fragment>
            );
          })}
        </MapContainer>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
        .leaflet-tooltip { background: #13161e !important; border: 1px solid #252935 !important; color: #e2e6f0 !important; font-family: JetBrains Mono, monospace !important; font-size: 11px !important; max-width: 380px !important; min-width: 300px !important; white-space: normal !important; padding: 10px 14px !important; box-shadow: 0 4px 24px rgba(0,0,0,.5) !important; border-radius: 6px !important; }
        .leaflet-tooltip-bottom::before { border-bottom-color: #252935 !important; }
        .leaflet-tooltip-top::before { border-top-color: #252935 !important; }
        .leaflet-container { background: #0d0f14; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #252935; border-radius: 2px; }
      `}</style>
    </div>
  );
}

// ─── DEFAULT ALERTS ───────────────────────────────────────────────────────────
const DEFAULT_ALERTS = [
  { type: "manmade",  message: "⚔️ Bab-el-Mandeb: Active Houthi drone/missile attacks — M2 Suez at ELEVATED risk. Cargo reroute advised." },
  { type: "manmade",  message: "⚔️ Strait of Hormuz: Iranian naval exercises ongoing — M3 tanker cargo MONITOR" },
  { type: "manmade",  message: "🏴‍☠️ Gulf of Aden: IMB piracy alert active — cargo vessels: armed escort recommended" },
  { type: "warning",  message: "🌀 Bay of Bengal: Cyclone season active — M1 CVMC / NH-16 freight watch" },
  { type: "info",     message: "ℹ️ Click any route on map or sidebar to ISOLATE it. Click again to show all." },
];

// ─── FALLBACK ROUTES ──────────────────────────────────────────────────────────
const FALLBACK_ROUTES = [
  { route_id: "M1_CVMC", name: "CVMC — Chennai to Vladivostok Maritime Corridor", short: "M1 CVMC", type: "sea", overall_risk: 0.32, status: "MONITOR", status_label: "MONITOR", top_factor: "geopolitical", color: "#eab308", waypoints: [[13.08,80.28],[10.50,82.50],[5.50,87.00],[3.00,95.00],[1.26,103.82],[5.00,108.00],[12.00,113.00],[18.00,117.00],[22.50,120.50],[25.00,122.00],[30.00,128.00],[35.00,131.00],[38.00,134.00],[43.10,131.90]], factors: { weather: 0.10, geopolitical: 0.35, manmade: 0.28, seasonal: 0.15 }, description: "India-Russia eastern goods corridor. Bulk cargo, containers, fertilisers. ~24 days." },
  { route_id: "M2_SUEZ", name: "Suez — Kandla to Europe via Red Sea", short: "M2 Suez", type: "sea", overall_risk: 0.88, status: "HOLD", status_label: "HOLD AT PORT", top_factor: "manmade", color: "#ef4444", waypoints: [[23.03,70.22],[22.00,66.00],[17.00,59.00],[12.50,53.00],[11.50,43.50],[15.00,42.00],[20.00,38.50],[27.00,35.50],[29.90,32.50],[31.30,32.30],[36.50,28.00],[38.00,15.00],[43.10,5.50]], factors: { weather: 0.15, geopolitical: 0.85, manmade: 0.88, seasonal: 0.10 }, description: "Primary Europe-bound export. Textiles, pharma, chemicals. ~35 days." },
  { route_id: "M3_HORMUZ", name: "Hormuz — Ras Tanura to Vadinar/Kandla (Crude Import)", short: "M3 Hormuz", type: "sea", overall_risk: 0.45, status: "MONITOR", status_label: "MONITOR", top_factor: "manmade", color: "#eab308", waypoints: [[27.50,49.50],[26.60,51.00],[26.00,54.00],[26.50,56.50],[24.50,58.50],[22.50,62.00],[22.50,67.00],[22.48,69.63],[23.03,70.22]], factors: { weather: 0.05, geopolitical: 0.50, manmade: 0.42, seasonal: 0.08 }, description: "Primary crude import. 85% of India crude supply." },
  { route_id: "M4_KANDLA_VADINAR", name: "Kandla — Vadinar Gulf of Kutch Coastal Shuttle", short: "M4 Kandla–Vadinar", type: "sea", overall_risk: 0.10, status: "PROCEED", status_label: "PROCEED", top_factor: "seasonal", color: "#22c55e", waypoints: [[23.03,70.22],[22.85,70.05],[22.70,69.85],[22.48,69.63]], factors: { weather: 0.05, geopolitical: 0.02, manmade: 0.00, seasonal: 0.10 }, description: "Short coastal tanker shuttle within Gulf of Kutch. ~65 km." },
  { route_id: "NH44_NS", name: "NH 44 — Srinagar to Kanyakumari", short: "NH-44 N-S", type: "road", overall_risk: 0.32, status: "MONITOR", status_label: "MONITOR", top_factor: "manmade", color: "#eab308", waypoints: [[34.07,74.79],[32.73,75.12],[32.08,76.17],[30.73,76.78],[28.63,77.21],[27.17,78.01],[25.45,78.57],[23.18,79.95],[21.14,79.08],[17.38,78.48],[15.34,75.13],[14.67,75.92],[13.08,77.59],[11.00,76.96],[8.08,77.55]], factors: { weather: 0.10, geopolitical: 0.45, manmade: 0.32, seasonal: 0.20 }, description: "India's longest freight highway. ~40% of overland freight. 3,745 km." },
  { route_id: "NH48_WE", name: "NH 48 — Delhi–Mumbai Expressway Corridor", short: "NH-48 D-M", type: "road", overall_risk: 0.15, status: "PROCEED", status_label: "PROCEED", top_factor: "seasonal", color: "#22c55e", waypoints: [[28.63,77.21],[27.49,76.59],[26.92,75.82],[25.15,75.85],[23.00,72.57],[22.31,72.96],[21.19,72.83],[20.23,72.97],[19.07,72.87]], factors: { weather: 0.05, geopolitical: 0.02, manmade: 0.05, seasonal: 0.15 }, description: "Delhi-Mumbai freight expressway. India's busiest goods corridor. 1,415 km." },
  { route_id: "NH16_EC", name: "NH 16 — East Coast Corridor (Chennai–Kolkata)", short: "NH-16 EC", type: "road", overall_risk: 0.28, status: "PROCEED", status_label: "PROCEED", top_factor: "seasonal", color: "#22c55e", waypoints: [[13.08,80.28],[14.46,79.98],[15.83,80.04],[16.30,80.45],[17.68,83.22],[19.31,84.79],[20.29,85.84],[22.57,88.36]], factors: { weather: 0.12, geopolitical: 0.02, manmade: 0.03, seasonal: 0.25 }, description: "Chennai to Kolkata east coast highway. Cyclone-prone. 1,650 km." },
  { route_id: "NH66_WC", name: "NH 66 — Mumbai to Kanyakumari (West Coast)", short: "NH-66 W-Coast", type: "road", overall_risk: 0.18, status: "PROCEED", status_label: "PROCEED", top_factor: "seasonal", color: "#22c55e", waypoints: [[19.07,72.87],[18.40,73.08],[17.30,73.31],[16.70,73.81],[15.49,73.83],[14.81,74.13],[13.84,74.55],[12.87,74.84],[11.99,75.37],[11.25,75.78],[10.52,76.21],[9.93,76.27],[8.89,76.62],[8.08,77.55]], factors: { weather: 0.12, geopolitical: 0.02, manmade: 0.02, seasonal: 0.18 }, description: "West coast highway. Fisheries + port cargo. 2,500 km." },
  { route_id: "NH27_EW", name: "NH 27 — East-West Corridor (Porbandar–Silchar)", short: "NH-27 E-W", type: "road", overall_risk: 0.22, status: "PROCEED", status_label: "PROCEED", top_factor: "seasonal", color: "#22c55e", waypoints: [[21.64,69.61],[22.31,72.96],[22.57,74.02],[23.17,76.13],[23.18,79.95],[23.83,82.01],[22.57,88.36],[24.82,92.80]], factors: { weather: 0.10, geopolitical: 0.02, manmade: 0.05, seasonal: 0.22 }, description: "Trans-India goods highway. Critical for NE states. 2,700 km." },
  { route_id: "NH58_CD", name: "NH 58 — Char Dham / Rishikesh–Mana Pass", short: "NH-58 Char Dham", type: "road", overall_risk: 0.38, status: "MONITOR", status_label: "MONITOR", top_factor: "seasonal", color: "#eab308", waypoints: [[29.95,78.16],[30.44,78.45],[30.74,78.80],[30.97,79.09],[31.10,79.35],[31.20,79.68],[31.10,79.97]], factors: { weather: 0.38, geopolitical: 0.02, manmade: 0.05, seasonal: 0.42 }, description: "High altitude Himalayan freight route. Seasonal closures, snow, landslide. 280 km." },
  { route_id: "NH_NE", name: "NH 2 / NH 37 — Northeast Corridor (Siliguri–Imphal)", short: "NH-NE Corridor", type: "road", overall_risk: 0.44, status: "MONITOR", status_label: "MONITOR", top_factor: "manmade", color: "#eab308", waypoints: [[26.72,88.43],[26.16,89.07],[26.04,91.75],[25.58,91.88],[26.17,92.94],[26.74,94.22],[25.46,91.36],[24.82,93.95]], factors: { weather: 0.15, geopolitical: 0.40, manmade: 0.44, seasonal: 0.20 }, description: "Goods lifeline to Northeast India. Ethnic tensions + floods. 1,200 km." },
  { route_id: "DFC_WESTERN", name: "Western Dedicated Freight Corridor", short: "W-DFC", type: "rail", overall_risk: 0.12, status: "PROCEED", status_label: "PROCEED", top_factor: "seasonal", color: "#22c55e", waypoints: [[18.96,72.83],[19.22,72.98],[20.99,73.77],[22.31,72.96],[23.00,72.57],[24.17,72.43],[26.45,74.64],[27.00,75.82],[28.20,76.62],[28.63,77.21],[30.90,75.85]], factors: { weather: 0.05, geopolitical: 0.02, manmade: 0.02, seasonal: 0.12 }, description: "JNPT Mumbai to Ludhiana. Double-stack containers. Freight-only. 1,504 km." },
  { route_id: "DFC_EASTERN", name: "Eastern Dedicated Freight Corridor", short: "E-DFC", type: "rail", overall_risk: 0.18, status: "PROCEED", status_label: "PROCEED", top_factor: "seasonal", color: "#22c55e", waypoints: [[30.87,75.90],[30.35,76.77],[28.63,77.21],[27.17,78.01],[26.45,80.35],[25.44,81.84],[25.35,83.00],[23.18,85.32],[22.57,88.36]], factors: { weather: 0.08, geopolitical: 0.02, manmade: 0.02, seasonal: 0.18 }, description: "Ludhiana to Kolkata. Coal, food grains, fertilisers. 1,856 km." },
  { route_id: "COASTAL_RAIL", name: "Coastal Rail — Chennai to Visakhapatnam", short: "Coastal Rail", type: "rail", overall_risk: 0.22, status: "PROCEED", status_label: "PROCEED", top_factor: "seasonal", color: "#22c55e", waypoints: [[13.08,80.28],[13.63,80.18],[14.46,79.98],[16.30,80.45],[17.68,83.22]], factors: { weather: 0.10, geopolitical: 0.02, manmade: 0.02, seasonal: 0.22 }, description: "East coast freight rail. Fertilisers, petroleum products. 840 km." },
  { route_id: "KONKAN_RAIL", name: "Konkan Railway — Mumbai to Mangaluru", short: "Konkan Rail", type: "rail", overall_risk: 0.20, status: "PROCEED", status_label: "PROCEED", top_factor: "seasonal", color: "#22c55e", waypoints: [[19.07,72.87],[18.40,73.08],[17.68,73.42],[16.70,73.81],[15.86,74.50],[15.49,73.83],[14.81,74.13],[13.84,74.55],[12.87,74.84]], factors: { weather: 0.15, geopolitical: 0.02, manmade: 0.02, seasonal: 0.20 }, description: "West coast freight rail. Bulk cargo. High monsoon risk. 760 km." },
  { route_id: "TRANS_RAJDHANI", name: "Trans-Rajdhani Rail — Ahmedabad to Patna", short: "Trans-Rajdhani", type: "rail", overall_risk: 0.14, status: "PROCEED", status_label: "PROCEED", top_factor: "seasonal", color: "#22c55e", waypoints: [[23.00,72.57],[24.59,73.71],[26.92,75.82],[26.45,80.35],[25.44,81.84],[25.61,85.13]], factors: { weather: 0.06, geopolitical: 0.02, manmade: 0.02, seasonal: 0.14 }, description: "Gangetic plain freight rail. Grains, consumer goods. 1,440 km." },
];

// ─── LOCAL SCENARIOS ──────────────────────────────────────────────────────────
const LOCAL_SCENARIOS = {
  cyclone_bob: { name: "Bay of Bengal Cyclone", systemStatus: "CRITICAL", alerts: [{ type: "critical", message: "M1 CVMC: HOLD AT PORT — wave height 7.5m exceeds threshold" },{ type: "critical", message: "NH-16 East Coast: REROUTE — severe wind and flooding" },{ type: "warning", message: "Coastal Rail: MONITOR — freight service disruptions likely" },{ type: "recommendation", message: "Use M3 Hormuz for urgent sea cargo. Switch to NH-44 inland freight." }], overrides: { M1_CVMC: { overall_risk: 0.92, status: "HOLD", status_label: "HOLD AT PORT", top_factor: "weather", factors: { weather: 0.92, geopolitical: 0.05, manmade: 0.00, seasonal: 0.15 }}, NH16_EC: { overall_risk: 0.85, status: "HOLD", status_label: "CLOSED", top_factor: "weather", factors: { weather: 0.85, geopolitical: 0.02, manmade: 0.03, seasonal: 0.25 }}, COASTAL_RAIL: { overall_risk: 0.72, status: "REROUTE", status_label: "REROUTE", top_factor: "weather", factors: { weather: 0.72, geopolitical: 0.02, manmade: 0.02, seasonal: 0.22 }}, NH44_NS: { overall_risk: 0.28, status: "PROCEED", status_label: "PROCEED", top_factor: "seasonal", factors: { weather: 0.10, geopolitical: 0.02, manmade: 0.05, seasonal: 0.20 }}}},
  red_sea: { name: "Red Sea / Houthi Alert", systemStatus: "CRITICAL", alerts: [{ type: "critical", message: "⚔️ M2 Suez: HOLD — Houthi missile attacks in Bab-el-Mandeb. Risk 0.95." },{ type: "manmade", message: "⚔️ Gulf of Aden piracy: Cargo convoy escort required." },{ type: "recommendation", message: "Redirect cargo via M1 CVMC (eastern corridor)" },{ type: "info", message: "M3 Hormuz normal — crude imports unaffected." }], overrides: { M2_SUEZ: { overall_risk: 0.95, status: "HOLD", status_label: "HOLD AT PORT", top_factor: "manmade", factors: { weather: 0.15, geopolitical: 0.92, manmade: 0.95, seasonal: 0.10 }}, M1_CVMC: { overall_risk: 0.32, status: "MONITOR", status_label: "MONITOR", top_factor: "geopolitical", factors: { weather: 0.10, geopolitical: 0.32, manmade: 0.28, seasonal: 0.15 }}, M3_HORMUZ: { overall_risk: 0.22, status: "PROCEED", status_label: "PROCEED", top_factor: "geopolitical", factors: { weather: 0.05, geopolitical: 0.25, manmade: 0.12, seasonal: 0.08 }}}},
  hormuz_crisis: { name: "Strait of Hormuz Crisis", systemStatus: "CRITICAL", alerts: [{ type: "critical", message: "⚔️ M3 Hormuz: HOLD — Iran seizes tanker near Strait" },{ type: "critical", message: "⚔️ M4 Kandla-Vadinar: CLOSED — port security lockdown" },{ type: "manmade", message: "⚔️ VLCC fleet diverted via Cape of Good Hope (+14 days)" },{ type: "warning", message: "India crude reserve drawdown activated. 7-day buffer." },{ type: "recommendation", message: "Emergency: Contact strategic petroleum reserve. Divert M2 Suez shipping." }], overrides: { M3_HORMUZ: { overall_risk: 0.96, status: "HOLD", status_label: "HOLD — SEIZED", top_factor: "manmade", factors: { weather: 0.05, geopolitical: 0.95, manmade: 0.96, seasonal: 0.08 }}, M4_KANDLA_VADINAR: { overall_risk: 0.90, status: "HOLD", status_label: "PORT LOCKED", top_factor: "manmade", factors: { weather: 0.05, geopolitical: 0.88, manmade: 0.90, seasonal: 0.10 }}, M2_SUEZ: { overall_risk: 0.72, status: "REROUTE", status_label: "REROUTE", top_factor: "geopolitical", factors: { weather: 0.15, geopolitical: 0.68, manmade: 0.72, seasonal: 0.10 }}, M1_CVMC: { overall_risk: 0.25, status: "PROCEED", status_label: "PROCEED", top_factor: "geopolitical", factors: { weather: 0.10, geopolitical: 0.25, manmade: 0.15, seasonal: 0.15 }}}},
  monsoon_flood: { name: "North India Monsoon Flood", systemStatus: "CRITICAL", alerts: [{ type: "critical", message: "NH-44: CLOSED — extreme flooding. Risk 0.95." },{ type: "critical", message: "W-DFC: HOLD — railway embankment waterlogged. Freight suspended." },{ type: "warning", message: "NH-48 Delhi-Mumbai: CAUTION — partial Gujarat flooding." },{ type: "recommendation", message: "MODE SWITCH: Reroute N→S freight via E-DFC (Eastern corridor)" }], overrides: { NH44_NS: { overall_risk: 0.95, status: "HOLD", status_label: "CLOSED", top_factor: "weather", factors: { weather: 0.95, geopolitical: 0.02, manmade: 0.05, seasonal: 0.20 }}, DFC_WESTERN: { overall_risk: 0.88, status: "HOLD", status_label: "CLOSED", top_factor: "weather", factors: { weather: 0.88, geopolitical: 0.02, manmade: 0.02, seasonal: 0.12 }}, NH48_WE: { overall_risk: 0.72, status: "REROUTE", status_label: "REROUTE", top_factor: "weather", factors: { weather: 0.72, geopolitical: 0.02, manmade: 0.02, seasonal: 0.15 }}, DFC_EASTERN: { overall_risk: 0.35, status: "MONITOR", status_label: "MONITOR", top_factor: "weather", factors: { weather: 0.35, geopolitical: 0.02, manmade: 0.02, seasonal: 0.18 }}}},
  piracy_surge: { name: "Somalia Piracy Surge", systemStatus: "ELEVATED", alerts: [{ type: "critical", message: "🏴‍☠️ Gulf of Aden: 3 cargo vessels hijacked this week. IMB CRITICAL alert." },{ type: "manmade", message: "🏴‍☠️ M2 Suez: Naval escort required. Adds 2-3 days + $8,000/vessel." },{ type: "warning", message: "M1 CVMC: Minor piracy risk near Malacca — cargo watch." },{ type: "recommendation", message: "Convoy through Gulf of Aden with EU NAVFOR escort fleet." }], overrides: { M2_SUEZ: { overall_risk: 0.78, status: "REROUTE", status_label: "ESCORT ONLY", top_factor: "manmade", factors: { weather: 0.15, geopolitical: 0.72, manmade: 0.78, seasonal: 0.10 }}, M1_CVMC: { overall_risk: 0.38, status: "MONITOR", status_label: "MONITOR", top_factor: "manmade", factors: { weather: 0.10, geopolitical: 0.30, manmade: 0.35, seasonal: 0.15 }}, M3_HORMUZ: { overall_risk: 0.18, status: "PROCEED", status_label: "PROCEED", top_factor: "seasonal", factors: { weather: 0.05, geopolitical: 0.20, manmade: 0.10, seasonal: 0.08 }}}},
};