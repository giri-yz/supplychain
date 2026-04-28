# Smart Supply Chain Intelligence System
### Multi-Modal Route Risk Monitor — Road · Rail · Sea (India + 3 Maritime Corridors)

## 🚀 Live Demo
**GitHub**: https://github.com/giri-yz/supplychain  
**Deployed**: [Add your deployment URL here]

---

## Architecture

```
React Frontend (Leaflet Map)  ←→  FastAPI Backend  ←→  tomorrow.io + OpenWeatherMap APIs + Gemini AI
        :3000                          :8000
```

## 🐳 Docker Deployment (Recommended)

### Quick Start with Docker
```bash
# Clone the repository
git clone https://github.com/giri-yz/supplychain.git
cd supplychain

# Setup environment variables
cp .env.example .env
# Edit .env with your API keys

# Start with Docker Compose
docker-compose up -d
```

**Services:**
- Frontend: http://localhost:3000
- Backend: http://localhost:8000  
- API Docs: http://localhost:8000/docs

### Environment Variables
Copy `.env.example` to `.env` and add your API keys:

```bash
# Weather APIs
TOMORROW_API_KEY=your_tomorrow_api_key
OWM_API_KEY=your_openweathermap_api_key

# Gemini AI
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-1.5-flash

# Backend URL (for frontend)
REACT_APP_API_URL=http://localhost:8000
```

**Get API Keys:**
- [tomorrow.io](https://tomorrow.io/) - Marine weather data
- [OpenWeatherMap](https://openweathermap.org/api) - Land weather data  
- [Google Gemini](https://makersuite.google.com/app/apikey) - AI analysis

---

## Local Development

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

## ☁️ Cloud Deployment

### Railway (Recommended)
```bash
# 1. Push to GitHub (already done!)
# 2. Go to railway.app and connect your repo
# 3. Add environment variables in Railway dashboard
# 4. Deploy automatically! 🚀
```

### Render
```bash
# 1. Connect GitHub repo to render.com
# 2. Render auto-detects docker-compose.yml
# 3. Add environment variables
# 4. Deploy! 🎉
```

### AWS ECS / Google Cloud Run
For production deployments, see deployment guide in the wiki.

---

## API Security
🔒 **All API keys are stored in environment variables**  
Never commit API keys to version control. Use `.env.example` as template.

---

## Project Structure

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
supplychain/
├── main.py                    # FastAPI backend
├── risk_engine.py             # Route scoring + demo scenarios
├── weather_fetch.py           # Weather API integration
├── threat_fetcher.py          # Threat intelligence
├── requirements.txt           # Python dependencies
├── Dockerfile               # Backend container
├── docker-compose.yml        # Multi-service orchestration
├── .env.example            # Environment variables template
├── .gitignore              # Git exclusions
├── frontend/
│   ├── src/
│   │   ├── App.jsx         # React app entry
│   │   └── AppImpl.jsx     # Main dashboard
│   ├── public/index.html
│   ├── Dockerfile           # Frontend container
│   ├── nginx.conf          # Nginx reverse proxy
│   └── package.json        # Node.js dependencies
└── README.md
```
