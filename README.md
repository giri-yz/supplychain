# Smart Supply Chain Intelligence System
### Multi-Modal Route Risk Monitor — Road · Rail · Sea (India + 3 Maritime Corridors)

---

## Architecture

```
React Frontend (Leaflet Map)  ←→  FastAPI Backend  ←→  tomorrow.io + OpenWeatherMap APIs
        :3000                          :8000
```

**Routes Covered:**
| ID | Name | Type |
|----|------|------|
| M1_CVMC | Chennai–Vladivostok Maritime Corridor | Sea |
| M2_SUEZ | India–Russia via Suez Canal | Sea |
| M3_HORMUZ | Arabian Sea Crude Import (Hormuz) | Sea |
| NH44_NS | NH-44 Srinagar–Kanyakumari | Road |
| NH48_WE | NH-48 Delhi–Mumbai Expressway | Road |
| NH16_EC | NH-16 East Coast Chennai–Kolkata | Road |
| DFC_WESTERN | Western Dedicated Freight Corridor | Rail |
| DFC_EASTERN | Eastern Dedicated Freight Corridor | Rail |
| COASTAL_RAIL | Chennai–Visakhapatnam Coastal Rail | Rail |

---

## Quick Start

### 1. Backend (FastAPI)

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Backend runs at: http://localhost:8000
API docs at: http://localhost:8000/docs

### 2. Frontend (React)

```bash
cd frontend
npm install
npm start
```

Frontend runs at: http://localhost:3000

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Health check |
| GET | `/health` | API key status |
| GET | `/all-routes` | All route definitions + waypoints |
| POST | `/route-risk` | Score routes with live weather |
| POST | `/demo-scenario` | Run a demo scenario |
| GET | `/weather-status` | Weather at key waypoints |

### POST /route-risk
```json
{ "route_ids": null }   // null = all routes
{ "route_ids": ["M1_CVMC", "M3_HORMUZ"] }  // specific routes
```

### POST /demo-scenario
```json
{ "scenario": "cyclone_bob" }      // Bay of Bengal Cyclone
{ "scenario": "red_sea" }           // Red Sea Alert
{ "scenario": "monsoon_flood" }     // North India Monsoon
```

---

## Demo Scenarios

| Scenario | Description |
|----------|-------------|
| `cyclone_bob` | Severe cyclone hits Bay of Bengal — M1 CVMC HOLD, NH-16 REROUTE |
| `red_sea` | Houthi escalation — M2 Suez HOLD, reroute via M1 CVMC |
| `monsoon_flood` | North India floods — NH-44 CLOSED, mode-switch to E-DFC rail |

---

## Risk Scoring Logic

```
overall_risk = weather_risk × 0.70 + geo_risk × 0.30 + seasonal_risk × 0.10

PROCEED  < 35%   (green)
MONITOR  35–65%  (yellow)
REROUTE  65–80%  (orange)
HOLD     > 80%   (red)
```

Weather sources:
- **Sea routes** → tomorrow.io (wave height, wind, swell)
- **Land routes** → OpenWeatherMap (rainfall, wind, visibility)

---

## API Keys
- **tomorrow.io**: `vmle9hoMwHIumkHqhsVd0wbpyerIc9aj`
- **OpenWeatherMap**: `606dd22f35a1316a3b6cbdb88f0b4336`

Set as environment variables if preferred:
```bash
export TOMORROW_API_KEY=vmle9hoMwHIumkHqhsVd0wbpyerIc9aj
export OWM_API_KEY=606dd22f35a1316a3b6cbdb88f0b4336
```

---

## Frontend Features
- 🗺️ **Leaflet map** with dark CartoDB basemap
- 🎨 **Color-coded routes**: green/yellow/orange/red by risk level
- 📊 **Sidebar** with ranked routes, risk bars, status badges
- 🎭 **3 demo scenarios** with one-click triggering
- 📡 **Live weather integration** via ⟳ LIVE DATA button
- 🔄 **Offline fallback** — works with static data even without backend
- 💡 **SHAP-style explanations** showing dominant risk factor per route

---

## Project Structure
```
supply-chain/
├── backend/
│   ├── main.py           # FastAPI app
│   ├── risk_engine.py    # Route scoring + demo scenarios
│   ├── weather_fetch.py  # tomorrow.io + OWM API integration
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx       # Full React dashboard
│   │   └── index.js
│   └── public/index.html
└── README.md
```
