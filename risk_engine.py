"""
Risk Engine — Route definitions, scoring logic, demo scenarios.
Covers: 4 maritime, 7 road, 5 rail routes.

RISK PHILOSOPHY: Goods-flow focus only.
If ANY risk factor (weather/natural OR manmade/geopolitical) exceeds the HOLD
threshold independently, the route is classified as HOLD — no averaging dilutes
a genuinely dangerous condition.
"""
from typing import Dict, List, Any, Optional
import math

RISK_THRESHOLD_HIGH = 0.65
RISK_THRESHOLD_HOLD = 0.80

# ─── GEOPOLITICAL RISK BASE SCORES ───────────────────────────────────────────
GEOPOLITICAL_RISK = {
    "red_sea":        0.85,   # Houthi attacks — CRITICAL
    "hormuz":         0.50,   # Iran tension — HIGH
    "bay_of_bengal":  0.05,
    "south_china_sea":0.35,   # PRC territorial claims
    "taiwan_strait":  0.45,   # PLA military exercises
    "gulf_of_aden":   0.55,   # Piracy + Houthi
    "malacca":        0.20,   # Congestion + minor piracy
    "indian_ocean":   0.05,
    "northeast_india":0.40,   # Ethnic conflict, road blockades
    "kashmir":        0.45,   # Security operations
    "domestic":       0.02,
}

# ─── MANMADE THREAT ZONES ────────────────────────────────────────────────────
MANMADE_THREATS = {
    "hormuz_tension": {
        "lat": 26.5, "lng": 56.5, "radius": 3.0,
        "severity": 0.72, "type": "military",
        "desc": "Iranian naval exercises + tanker seizures. US carrier group deployed.",
        "affects": ["M3_HORMUZ"],
    },
    "red_sea_houthi": {
        "lat": 13.5, "lng": 43.5, "radius": 5.0,
        "severity": 0.88, "type": "conflict",
        "desc": "Active Houthi missile/drone attacks. Red Sea transit DANGEROUS.",
        "affects": ["M2_SUEZ"],
    },
    "south_china_sea": {
        "lat": 12.0, "lng": 113.0, "radius": 8.0,
        "severity": 0.55, "type": "territorial",
        "desc": "PRC Coast Guard harassment. Transit advisories issued.",
        "affects": ["M1_CVMC"],
    },
    "somalia_pirates": {
        "lat": 11.0, "lng": 51.0, "radius": 6.0,
        "severity": 0.45, "type": "piracy",
        "desc": "Renewed Somali piracy. IMB Piracy Reporting Centre: HIGH RISK.",
        "affects": ["M2_SUEZ"],
    },
    "malacca_congestion": {
        "lat": 1.26, "lng": 103.82, "radius": 2.0,
        "severity": 0.30, "type": "congestion",
        "desc": "Singapore port congestion +3.5 days. AIS spoofing reported.",
        "affects": ["M1_CVMC"],
    },
    "kashmir_nh44": {
        "lat": 33.5, "lng": 75.5, "radius": 2.5,
        "severity": 0.42, "type": "protest",
        "desc": "Frequent NH-44 shutdowns near Jammu-Srinagar. Security operations.",
        "affects": ["NH44_NS"],
    },
    "manipur_protest": {
        "lat": 24.8, "lng": 93.9, "radius": 2.0,
        "severity": 0.38, "type": "protest",
        "desc": "Ethnic tensions affecting NH-2/NH-37. Truck convoys require escort.",
        "affects": ["NH_NE"],
    },
    "taiwan_strait": {
        "lat": 24.5, "lng": 121.0, "radius": 3.0,
        "severity": 0.62, "type": "military",
        "desc": "PLA exercises restrict transit windows. Risk of vessel detention.",
        "affects": ["M1_CVMC"],
    },
}

# ─── ROUTE DEFINITIONS ───────────────────────────────────────────────────────
ROUTES = {
    # ── MARITIME ──
    "M1_CVMC": {
        "id": "M1_CVMC", "name": "CVMC — Chennai to Vladivostok Maritime Corridor",
        "short": "M1 CVMC", "type": "sea", "color_base": "#3b82f6",
        "description": "India-Russia eastern goods corridor. Chennai → Malacca → South China Sea → Taiwan Strait → Vladivostok. Carries bulk cargo, containers, fertilisers. ~24 days.",
        "waypoints": [
            [13.08, 80.28],[10.5, 82.50],[5.50, 87.00],[3.00, 95.00],[1.26, 103.82],
            [5.00, 108.00],[12.00, 113.00],[18.00, 117.00],[22.50, 120.50],[25.00, 122.00],
            [30.00, 128.00],[35.00, 131.00],[38.00, 134.00],[43.10, 131.90],
        ],
        "geo_risk_zones": ["bay_of_bengal", "south_china_sea", "taiwan_strait", "malacca"],
        "manmade_zones": ["south_china_sea", "malacca_congestion", "taiwan_strait"],
        "season_risk": 0.15,
        "base_cost_usd": 1200, "km": 14500, "days": 24,
    },
    "M2_SUEZ": {
        "id": "M2_SUEZ", "name": "Suez — Kandla to Europe via Red Sea",
        "short": "M2 Suez", "type": "sea", "color_base": "#8b5cf6",
        "description": "Primary Europe-bound export route. Kandla → Arabian Sea → Gulf of Aden → Red Sea → Suez Canal → Mediterranean. Textiles, pharma, chemicals. ~35 days.",
        "waypoints": [
            [23.03, 70.22],[22.00, 66.00],[17.00, 59.00],[12.50, 53.00],
            [11.50, 43.50],[15.00, 42.00],[20.00, 38.50],[27.00, 35.50],
            [29.90, 32.50],[31.30, 32.30],[36.50, 28.00],[38.00, 15.00],[43.10, 5.50],
        ],
        "geo_risk_zones": ["red_sea", "gulf_of_aden"],
        "manmade_zones": ["red_sea_houthi", "somalia_pirates"],
        "season_risk": 0.10,
        "base_cost_usd": 1800, "km": 11800, "days": 35,
    },
    "M3_HORMUZ": {
        "id": "M3_HORMUZ", "name": "Hormuz — Ras Tanura to Vadinar/Kandla (Crude Import)",
        "short": "M3 Hormuz", "type": "sea", "color_base": "#10b981",
        "description": "Primary crude oil import. Ras Tanura → Strait of Hormuz → Arabian Sea → Vadinar/Kandla. 85% of India crude supply. Any disruption = national energy emergency.",
        "waypoints": [
            [27.50, 49.50],[26.60, 51.00],[26.00, 54.00],[26.50, 56.50],
            [24.50, 58.50],[22.50, 62.00],[22.50, 67.00],[22.48, 69.63],[23.03, 70.22],
        ],
        "geo_risk_zones": ["hormuz"],
        "manmade_zones": ["hormuz_tension"],
        "season_risk": 0.08,
        "base_cost_usd": 280, "km": 1400, "days": 4,
    },
    "M4_KANDLA_VADINAR": {
        "id": "M4_KANDLA_VADINAR", "name": "Kandla — Vadinar Gulf of Kutch Coastal Shuttle",
        "short": "M4 Kandla–Vadinar", "type": "sea", "color_base": "#06b6d4",
        "description": "Short coastal tanker shuttle within Gulf of Kutch. Transfers crude between terminals. ~65 km.",
        "waypoints": [
            [23.03, 70.22],[22.85, 70.05],[22.70, 69.85],[22.48, 69.63],
        ],
        "geo_risk_zones": ["domestic"],
        "manmade_zones": [],
        "season_risk": 0.10,
        "base_cost_usd": 40, "km": 65, "days": 0.2,
    },

    # ── ROAD ──
    "NH44_NS": {
        "id": "NH44_NS", "name": "NH 44 — Srinagar to Kanyakumari",
        "short": "NH-44 N-S", "type": "road", "color_base": "#f59e0b",
        "description": "India's longest freight highway. Critical north-south goods spine. 3,745 km. Carries ~40% of India's overland freight.",
        "waypoints": [
            [34.07, 74.79],[32.73, 75.12],[32.08, 76.17],[30.73, 76.78],[28.63, 77.21],
            [27.17, 78.01],[25.45, 78.57],[23.18, 79.95],[21.14, 79.08],[17.38, 78.48],
            [15.34, 75.13],[14.67, 75.92],[13.08, 77.59],[11.00, 76.96],[8.08, 77.55],
        ],
        "geo_risk_zones": ["kashmir", "domestic"],
        "manmade_zones": ["kashmir_nh44"],
        "season_risk": 0.20,
        "base_cost_usd": 3200, "km": 3745, "days": 5,
    },
    "NH48_WE": {
        "id": "NH48_WE", "name": "NH 48 — Delhi–Mumbai Expressway Corridor",
        "short": "NH-48 D-M", "type": "road", "color_base": "#f59e0b",
        "description": "High-capacity Delhi-Mumbai freight expressway. 1,415 km. India's busiest goods corridor. Connects manufacturing hubs to JNPT port.",
        "waypoints": [
            [28.63, 77.21],[27.49, 76.59],[26.92, 75.82],[25.15, 75.85],
            [23.00, 72.57],[22.31, 72.96],[21.19, 72.83],[20.23, 72.97],[19.07, 72.87],
        ],
        "geo_risk_zones": ["domestic"],
        "manmade_zones": [],
        "season_risk": 0.15,
        "base_cost_usd": 2100, "km": 1415, "days": 2,
    },
    "NH16_EC": {
        "id": "NH16_EC", "name": "NH 16 — East Coast Corridor (Chennai–Kolkata)",
        "short": "NH-16 EC", "type": "road", "color_base": "#f59e0b",
        "description": "Chennai to Kolkata east coast highway. 1,650 km. Links major port cities. Cyclone-prone stretch.",
        "waypoints": [
            [13.08, 80.28],[14.46, 79.98],[15.83, 80.04],[16.30, 80.45],
            [17.68, 83.22],[19.31, 84.79],[20.29, 85.84],[22.57, 88.36],
        ],
        "geo_risk_zones": ["domestic"],
        "manmade_zones": [],
        "season_risk": 0.25,
        "base_cost_usd": 1800, "km": 1650, "days": 2.5,
    },
    "NH66_WC": {
        "id": "NH66_WC", "name": "NH 66 — Mumbai to Kanyakumari (West Coast)",
        "short": "NH-66 W-Coast", "type": "road", "color_base": "#f59e0b",
        "description": "West coast highway through Konkan, Goa, Karnataka, Kerala. 2,500 km. Heavy monsoon risk. Key for fisheries + port cargo.",
        "waypoints": [
            [19.07, 72.87],[18.40, 73.08],[17.30, 73.31],[16.70, 73.81],
            [15.49, 73.83],[14.81, 74.13],[13.84, 74.55],[12.87, 74.84],
            [11.99, 75.37],[11.25, 75.78],[10.52, 76.21],[9.93, 76.27],[8.89, 76.62],[8.08, 77.55],
        ],
        "geo_risk_zones": ["domestic"],
        "manmade_zones": [],
        "season_risk": 0.18,
        "base_cost_usd": 2600, "km": 2500, "days": 3.5,
    },
    "NH27_EW": {
        "id": "NH27_EW", "name": "NH 27 — East-West Corridor (Porbandar–Silchar)",
        "short": "NH-27 E-W", "type": "road", "color_base": "#f59e0b",
        "description": "Trans-India east-west highway linking Gujarat to Northeast. 2,700 km. Critical for goods to landlocked NE states.",
        "waypoints": [
            [21.64, 69.61],[22.31, 72.96],[22.57, 74.02],[23.17, 76.13],
            [23.18, 79.95],[23.83, 82.01],[22.57, 88.36],[24.82, 92.80],
        ],
        "geo_risk_zones": ["domestic"],
        "manmade_zones": [],
        "season_risk": 0.22,
        "base_cost_usd": 2800, "km": 2700, "days": 3.8,
    },
    "NH58_CD": {
        "id": "NH58_CD", "name": "NH 58 — Char Dham / Rishikesh–Mana Pass",
        "short": "NH-58 Char Dham", "type": "road", "color_base": "#f59e0b",
        "description": "High altitude Himalayan freight route. Supplies border regions. Seasonal closures, snowfall, landslide risk. 280 km.",
        "waypoints": [
            [29.95, 78.16],[30.44, 78.45],[30.74, 78.80],[30.97, 79.09],
            [31.10, 79.35],[31.20, 79.68],[31.10, 79.97],
        ],
        "geo_risk_zones": ["domestic"],
        "manmade_zones": [],
        "season_risk": 0.42,
        "base_cost_usd": 1400, "km": 280, "days": 1,
    },
    "NH_NE": {
        "id": "NH_NE", "name": "NH 2 / NH 37 — Northeast Corridor (Siliguri–Imphal)",
        "short": "NH-NE Corridor", "type": "road", "color_base": "#f59e0b",
        "description": "Critical goods lifeline to Northeast India. Siliguri to Imphal. Ethnic tensions + floods + landslides. 1,200 km.",
        "waypoints": [
            [26.72, 88.43],[26.16, 89.07],[26.04, 91.75],[25.58, 91.88],
            [26.17, 92.94],[26.74, 94.22],[25.46, 91.36],[24.82, 93.95],
        ],
        "geo_risk_zones": ["northeast_india"],
        "manmade_zones": ["manipur_protest"],
        "season_risk": 0.20,
        "base_cost_usd": 1900, "km": 1200, "days": 2.5,
    },

    # ── RAIL ──
    "DFC_WESTERN": {
        "id": "DFC_WESTERN", "name": "Western Dedicated Freight Corridor",
        "short": "W-DFC", "type": "rail", "color_base": "#10b981",
        "description": "JNPT Mumbai to Ludhiana. 1,504 km. Double-stack containers. Designed purely for goods — no passengers. Moves automobiles, FMCG, steel.",
        "waypoints": [
            [18.96, 72.83],[19.22, 72.98],[20.99, 73.77],[22.31, 72.96],
            [23.00, 72.57],[24.17, 72.43],[26.45, 74.64],[27.00, 75.82],
            [28.20, 76.62],[28.63, 77.21],[30.90, 75.85],
        ],
        "geo_risk_zones": ["domestic"],
        "manmade_zones": [],
        "season_risk": 0.12,
        "base_cost_usd": 680, "km": 1504, "days": 2.5,
    },
    "DFC_EASTERN": {
        "id": "DFC_EASTERN", "name": "Eastern Dedicated Freight Corridor",
        "short": "E-DFC", "type": "rail", "color_base": "#10b981",
        "description": "Sahnewal (Ludhiana) to Kolkata (Dankuni). 1,856 km. Freight only. Carries coal, food grains, fertilisers. High capacity corridor.",
        "waypoints": [
            [30.87, 75.90],[30.35, 76.77],[28.63, 77.21],[27.17, 78.01],
            [26.45, 80.35],[25.44, 81.84],[25.35, 83.00],[23.18, 85.32],[22.57, 88.36],
        ],
        "geo_risk_zones": ["domestic"],
        "manmade_zones": [],
        "season_risk": 0.18,
        "base_cost_usd": 720, "km": 1856, "days": 3,
    },
    "COASTAL_RAIL": {
        "id": "COASTAL_RAIL", "name": "Coastal Rail — Chennai to Visakhapatnam",
        "short": "Coastal Rail", "type": "rail", "color_base": "#10b981",
        "description": "East coast rail corridor. 840 km. Carries bulk freight, fertilisers, petroleum products. Cyclone season: high weather risk.",
        "waypoints": [
            [13.08, 80.28],[13.63, 80.18],[14.46, 79.98],[16.30, 80.45],[17.68, 83.22],
        ],
        "geo_risk_zones": ["domestic"],
        "manmade_zones": [],
        "season_risk": 0.22,
        "base_cost_usd": 520, "km": 840, "days": 1.5,
    },
    "KONKAN_RAIL": {
        "id": "KONKAN_RAIL", "name": "Konkan Railway — Mumbai to Mangaluru",
        "short": "Konkan Rail", "type": "rail", "color_base": "#10b981",
        "description": "Scenic west coast rail through 92 tunnels and 2,000 bridges. 760 km. Carries goods including bulk cargo. High landslide + flood risk in monsoon.",
        "waypoints": [
            [19.07, 72.87],[18.40, 73.08],[17.68, 73.42],[16.70, 73.81],
            [15.86, 74.50],[15.49, 73.83],[14.81, 74.13],[13.84, 74.55],[12.87, 74.84],
        ],
        "geo_risk_zones": ["domestic"],
        "manmade_zones": [],
        "season_risk": 0.20,
        "base_cost_usd": 580, "km": 760, "days": 1.5,
    },
    "TRANS_RAJDHANI": {
        "id": "TRANS_RAJDHANI", "name": "Trans-Rajdhani Rail — Ahmedabad to Patna",
        "short": "Trans-Rajdhani", "type": "rail", "color_base": "#10b981",
        "description": "Cross-country Gangetic plain freight rail. 1,440 km. Carries grains, consumer goods, construction materials. Flood risk in Bihar.",
        "waypoints": [
            [23.00, 72.57],[24.59, 73.71],[26.92, 75.82],[26.45, 80.35],
            [25.44, 81.84],[25.61, 85.13],
        ],
        "geo_risk_zones": ["domestic"],
        "manmade_zones": [],
        "season_risk": 0.14,
        "base_cost_usd": 640, "km": 1440, "days": 2.2,
    },
}

# ─── DEMO SCENARIOS ──────────────────────────────────────────────────────────
DEMO_SCENARIOS = {
    "cyclone_bob": {
        "name": "Bay of Bengal Cyclone",
        "description": "Severe cyclone hits Bay of Bengal — M1 CVMC HOLD, NH-16 REROUTE",
        "icon": "🌀",
        "alerts": [
            {"type": "critical",       "message": "M1 CVMC: HOLD AT PORT — wave height 7.5m exceeds safety threshold"},
            {"type": "critical",       "message": "NH-16 East Coast: REROUTE — severe wind and flooding"},
            {"type": "warning",        "message": "Coastal Rail: MONITOR — service disruptions likely"},
            {"type": "recommendation", "message": "Use M3 Hormuz for urgent sea cargo. Switch NH freight to NH-44 inland."},
        ],
        "weather_overrides": {
            "M1_CVMC":   {"risk": 0.92, "geo_risk": 0.05},
            "NH16_EC":   {"risk": 0.85, "geo_risk": 0.02},
            "COASTAL_RAIL": {"risk": 0.72, "geo_risk": 0.02},
            "M2_SUEZ":   {"risk": 0.88, "geo_risk": 0.85},
            "M3_HORMUZ": {"risk": 0.08, "geo_risk": 0.50},
        },
    },
    "red_sea": {
        "name": "Red Sea / Houthi Alert",
        "description": "Houthi escalation — M2 Suez HOLD, reroute via M1 CVMC",
        "icon": "🚀",
        "alerts": [
            {"type": "critical", "message": "⚔️ M2 Suez: HOLD — Active Houthi missile attacks in Bab-el-Mandeb. Risk 0.95."},
            {"type": "manmade",  "message": "⚔️ Gulf of Aden piracy: Armed convoy escort required. +2 days."},
            {"type": "recommendation", "message": "Redirect Russia cargo via M1 CVMC (eastern corridor, +8 days but safe)"},
            {"type": "info",     "message": "M3 Hormuz normal — Middle East crude unaffected by Red Sea situation."},
        ],
        "weather_overrides": {
            "M2_SUEZ":   {"risk": 0.95, "geo_risk": 0.92},
            "M1_CVMC":   {"risk": 0.32, "geo_risk": 0.35},
            "M3_HORMUZ": {"risk": 0.22, "geo_risk": 0.50},
        },
    },
    "hormuz_crisis": {
        "name": "Strait of Hormuz Crisis",
        "description": "Iran seizes tanker near Strait of Hormuz — crude import disruption",
        "icon": "⚔️",
        "alerts": [
            {"type": "critical", "message": "⚔️ M3 Hormuz: HOLD — Iran seizes VLCC near Strait. US Navy deployed."},
            {"type": "critical", "message": "⚔️ M4 Kandla-Vadinar: PORT LOCKED — security lockdown."},
            {"type": "manmade",  "message": "⚔️ VLCC fleet diverted via Cape of Good Hope (+14 days, +$220k/vessel)"},
            {"type": "warning",  "message": "India crude reserve drawdown activated. 7-day strategic buffer."},
            {"type": "recommendation", "message": "Emergency strategic petroleum reserve activation. Contact MoPNG immediately."},
        ],
        "weather_overrides": {
            "M3_HORMUZ":         {"risk": 0.96, "geo_risk": 0.95},
            "M4_KANDLA_VADINAR": {"risk": 0.90, "geo_risk": 0.88},
            "M2_SUEZ":           {"risk": 0.72, "geo_risk": 0.68},
            "M1_CVMC":           {"risk": 0.25, "geo_risk": 0.35},
        },
    },
    "monsoon_flood": {
        "name": "North India Monsoon Flood",
        "description": "North India extreme monsoon flooding — NH-44 CLOSED, DFC WESTERN HOLD",
        "icon": "🌧️",
        "alerts": [
            {"type": "critical",       "message": "NH-44: CLOSED — extreme flooding, risk 0.95."},
            {"type": "critical",       "message": "W-DFC: HOLD — railway embankment waterlogged. Freight suspended."},
            {"type": "warning",        "message": "NH-48 Delhi-Mumbai: CAUTION — partial flooding in Gujarat"},
            {"type": "recommendation", "message": "MODE SWITCH: Reroute N→S freight via E-DFC (Eastern corridor)"},
            {"type": "recommendation", "message": "Maritime alternatives: M3 Hormuz and M1 CVMC both clear"},
        ],
        "weather_overrides": {
            "NH44_NS":     {"risk": 0.95, "geo_risk": 0.02},
            "DFC_WESTERN": {"risk": 0.88, "geo_risk": 0.02},
            "NH48_WE":     {"risk": 0.72, "geo_risk": 0.02},
            "DFC_EASTERN": {"risk": 0.48, "geo_risk": 0.02},
        },
    },
    "piracy_surge": {
        "name": "Somalia Piracy Surge",
        "description": "IMB CRITICAL piracy alert — 3 vessels hijacked in Gulf of Aden",
        "icon": "🏴‍☠️",
        "alerts": [
            {"type": "critical", "message": "🏴‍☠️ Gulf of Aden: 3 vessels hijacked this week. IMB CRITICAL."},
            {"type": "manmade",  "message": "🏴‍☠️ M2 Suez: EU NAVFOR naval escort required. +2-3 days, +$8,000/vessel."},
            {"type": "warning",  "message": "M1 CVMC: Minor piracy risk near Malacca — enhanced watch."},
            {"type": "recommendation", "message": "Join convoy with EU NAVFOR/NATO escort fleet through Gulf of Aden."},
        ],
        "weather_overrides": {
            "M2_SUEZ":   {"risk": 0.78, "geo_risk": 0.72},
            "M1_CVMC":   {"risk": 0.38, "geo_risk": 0.32},
            "M3_HORMUZ": {"risk": 0.18, "geo_risk": 0.50},
        },
    },
}


class RiskEngine:
    def __init__(self):
        self.routes = ROUTES

    def get_all_route_definitions(self):
        return [
            {k: v for k, v in route.items() if k not in ("manmade_zones",)}
            for route in ROUTES.values()
        ]

    def _get_geo_risk(self, route: dict) -> float:
        zones = route.get("geo_risk_zones", [])
        return max((GEOPOLITICAL_RISK.get(z, 0) for z in zones), default=0)

    def _get_manmade_risk(self, route: dict) -> float:
        """Calculate manmade threat risk for a route."""
        zones = route.get("manmade_zones", [])
        if not zones:
            return 0.0
        max_risk = 0.0
        for zone_id in zones:
            threat = MANMADE_THREATS.get(zone_id)
            if threat:
                max_risk = max(max_risk, threat["severity"])
        return round(max_risk, 3)

    def _compute_overall_risk(
        self,
        weather_risk: float,
        geo_risk: float,
        manmade_risk: float,
        season_risk: float,
    ) -> float:
        """
        GOODS-FLOW RISK PHILOSOPHY:
        If ANY individual risk dimension independently hits HOLD threshold (≥0.80),
        the overall route is HOLD — no averaging can dilute a true emergency.
        Otherwise use weighted combination: weather 40%, threat (geo+manmade) 45%, seasonal 15%.
        """
        # Individual dimension check — any HIGH alone overrides blended score
        threat_risk = max(geo_risk, manmade_risk)
        max_individual = max(weather_risk, geo_risk, manmade_risk)

        if max_individual >= RISK_THRESHOLD_HOLD:
            # Hard-lock to maximum: one genuinely dangerous factor = route is dangerous
            return round(min(1.0, max_individual), 3)

        # Blended score for sub-critical conditions
        blended = min(1.0,
            weather_risk * 0.40 +
            threat_risk  * 0.45 +
            season_risk  * 0.15
        )
        # Still bump up if blended is close to what individual factors suggest
        blended = max(blended, max_individual * 0.85)
        return round(blended, 3)

    def score_route(self, route_id: str, fetcher=None) -> dict:
        if route_id not in ROUTES:
            raise ValueError(f"Unknown route: {route_id}")
        route = ROUTES[route_id]
        mode = route["type"]
        waypoints = route["waypoints"]

        if len(waypoints) > 4:
            step = len(waypoints) // 4
            sample_wps = [waypoints[i] for i in range(0, len(waypoints), step)][:4]
        else:
            sample_wps = waypoints

        weather_data = []
        max_weather_risk = 0.0
        if fetcher:
            wx_list = fetcher.fetch_for_waypoints(sample_wps, mode)
            weather_data = wx_list
            max_weather_risk = max((w["risk"] for w in wx_list), default=0)

        geo_risk = self._get_geo_risk(route)
        manmade_risk = self._get_manmade_risk(route)
        season_risk = route.get("season_risk", 0)

        overall_risk = self._compute_overall_risk(max_weather_risk, geo_risk, manmade_risk, season_risk)

        if overall_risk >= RISK_THRESHOLD_HOLD:
            status = "HOLD"
            status_label = "HOLD AT PORT" if mode == "sea" else "CLOSED"
        elif overall_risk >= RISK_THRESHOLD_HIGH:
            status = "REROUTE"
            status_label = "REROUTE"
        elif overall_risk >= 0.35:
            status = "MONITOR"
            status_label = "MONITOR"
        else:
            status = "PROCEED"
            status_label = "PROCEED"

        factors = {
            "weather": round(max_weather_risk, 3),
            "geopolitical": round(geo_risk, 3),
            "manmade": round(manmade_risk, 3),
            "seasonal": round(season_risk, 3),
        }
        top_factor = max(factors, key=factors.get)

        active_threats = [
            {
                "id": zid,
                "label": MANMADE_THREATS[zid]["desc"],
                "severity": MANMADE_THREATS[zid]["severity"],
                "type": MANMADE_THREATS[zid]["type"],
            }
            for zid in route.get("manmade_zones", [])
            if zid in MANMADE_THREATS
        ]

        return {
            "route_id": route_id,
            "name": route["name"],
            "short": route["short"],
            "description": route.get("description", ""),
            "type": mode,
            "overall_risk": overall_risk,
            "status": status,
            "status_label": status_label,
            "top_factor": top_factor,
            "factors": factors,
            "weather_risk": round(max_weather_risk, 3),
            "geo_risk": round(geo_risk, 3),
            "manmade_risk": round(manmade_risk, 3),
            "waypoints": waypoints,
            "color": self._risk_color(overall_risk),
            "weather_sample": weather_data[:2] if weather_data else [],
            "active_threats": active_threats,
            "economics": {
                "base_cost_usd": route.get("base_cost_usd", 0),
                "km": route.get("km", 0),
                "days": route.get("days", 0),
            },
        }

    def _risk_color(self, risk: float) -> str:
        if risk >= RISK_THRESHOLD_HOLD: return "#ef4444"
        elif risk >= RISK_THRESHOLD_HIGH: return "#f97316"
        elif risk >= 0.35: return "#eab308"
        else: return "#22c55e"

    def get_system_status(self, results: list) -> str:
        hold_count = sum(1 for r in results if r["status"] == "HOLD")
        reroute_count = sum(1 for r in results if r["status"] == "REROUTE")
        sea_routes = [r for r in results if r["type"] == "sea"]
        all_sea_hold = all(r["status"] == "HOLD" for r in sea_routes)
        if all_sea_hold and len(sea_routes) >= 3: return "MARITIME_HOLD_ALL"
        elif hold_count >= 3: return "CRITICAL"
        elif hold_count >= 1 or reroute_count >= 2: return "ELEVATED"
        elif reroute_count >= 1: return "ADVISORY"
        else: return "NORMAL"

    def get_recommendations(self, results: list) -> list:
        recommendations = []
        hold_routes = [r for r in results if r["status"] == "HOLD"]
        clear_sea = [r for r in results if r["type"] == "sea" and r["status"] == "PROCEED"]
        clear_rail = [r for r in results if r["type"] == "rail" and r["status"] == "PROCEED"]
        for route in hold_routes:
            if route["type"] == "sea":
                alt = clear_sea[0]["short"] if clear_sea else None
                if alt:
                    recommendations.append({
                        "from": route["short"], "to": alt,
                        "reason": f"Reroute via {alt} — lower risk goods corridor",
                        "priority": "high"
                    })
                else:
                    recommendations.append({
                        "from": route["short"], "to": None,
                        "reason": "All maritime routes elevated — hold cargo at port",
                        "priority": "critical"
                    })
            elif route["type"] == "road":
                if clear_rail:
                    recommendations.append({
                        "from": route["short"], "to": clear_rail[0]["short"],
                        "reason": f"Mode switch: {route['short']} blocked — use {clear_rail[0]['short']} for freight",
                        "priority": "high"
                    })
        return recommendations

    def run_demo_scenario(self, scenario_id: str) -> dict:
        if scenario_id not in DEMO_SCENARIOS:
            raise ValueError(f"Unknown scenario: {scenario_id}. Valid: {list(DEMO_SCENARIOS.keys())}")
        scenario = DEMO_SCENARIOS[scenario_id]
        overrides = scenario["weather_overrides"]
        results = []
        for route_id, route in ROUTES.items():
            override = overrides.get(route_id, {})
            weather_risk = override.get("risk", route.get("season_risk", 0.05))
            geo = override.get("geo_risk", self._get_geo_risk(route))
            manmade = self._get_manmade_risk(route)
            season_risk = route.get("season_risk", 0)

            risk = self._compute_overall_risk(weather_risk, geo, manmade, season_risk)

            if risk >= RISK_THRESHOLD_HOLD:
                status = "HOLD"
                status_label = "HOLD AT PORT" if route["type"] == "sea" else "CLOSED"
            elif risk >= RISK_THRESHOLD_HIGH:
                status = "REROUTE"; status_label = "REROUTE"
            elif risk >= 0.35:
                status = "MONITOR"; status_label = "MONITOR"
            else:
                status = "PROCEED"; status_label = "PROCEED"

            factors = {
                "weather": round(weather_risk, 3),
                "geopolitical": round(geo, 3),
                "manmade": round(manmade, 3),
                "seasonal": round(season_risk, 3),
            }
            top_factor = max(factors, key=factors.get)

            results.append({
                "route_id": route_id,
                "name": route["name"],
                "short": route["short"],
                "description": route.get("description", ""),
                "type": route["type"],
                "overall_risk": risk,
                "status": status,
                "status_label": status_label,
                "top_factor": top_factor,
                "factors": factors,
                "weather_risk": round(weather_risk, 3),
                "geo_risk": round(geo, 3),
                "manmade_risk": round(manmade, 3),
                "waypoints": route["waypoints"],
                "color": self._risk_color(risk),
                "weather_sample": [],
                "economics": {
                    "base_cost_usd": route.get("base_cost_usd", 0),
                    "km": route.get("km", 0),
                    "days": route.get("days", 0),
                },
            })

        results.sort(key=lambda x: x["overall_risk"], reverse=True)
        return {
            "scenario": scenario_id,
            "scenario_name": scenario["name"],
            "description": scenario["description"],
            "icon": scenario["icon"],
            "routes": results,
            "alerts": scenario["alerts"],
            "system_status": self.get_system_status(results),
            "recommendations": self.get_recommendations(results),
        }