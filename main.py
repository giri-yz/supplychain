"""
Smart Supply Chain Intelligence System — FastAPI Backend
Routes:
  GET  /                  — health ping
  GET  /health            — API status
  POST /route-risk        — score specific or all routes (live weather)
  GET  /all-routes        — all route definitions (waypoints, type, metadata)
  POST /demo-scenario     — inject synthetic demo scenario
  GET  /weather-status    — current weather at key waypoints
  GET  /threat-intel      — live Wikipedia + ReliefWeb threat intelligence
  POST /ai-brief          — Gemini AI situational brief for a route or system
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import httpx
import uvicorn
import os

from risk_engine import RiskEngine
from weather_fetch import WeatherFetcher
from threat_fetcher import ThreatFetcher

# ── Gemini config ─────────────────────────────────────────────────────────────
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL   = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
GEMINI_URL     = (
    f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
    f"?key={GEMINI_API_KEY}"
)

app = FastAPI(
    title="Supply Chain Intelligence API",
    description="Multi-modal route risk scoring — Road, Rail & Sea",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine          = RiskEngine()
weather_fetcher = WeatherFetcher()
threat_fetcher  = ThreatFetcher(cache_ttl_minutes=30)


# ── Request models ────────────────────────────────────────────────────────────

class RouteRequest(BaseModel):
    route_ids: Optional[List[str]] = None   # None = score all routes


class DemoRequest(BaseModel):
    scenario: str   # "cyclone_bob" | "red_sea" | "hormuz_crisis" | "monsoon_flood" | "piracy_surge"


class AIBriefRequest(BaseModel):
    route_id: Optional[str] = None          # None = system-level brief
    include_weather: bool = True
    include_threats: bool = True


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "ok", "system": "Supply Chain Intelligence System v2.0"}


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "apis": weather_fetcher.check_apis(),
    }


@app.post("/route-risk")
def score_routes(req: RouteRequest):
    """Score specific or all routes with live weather data + live threat intelligence."""
    try:
        # Apply live threat intelligence before scoring
        threat_fetcher.apply_to_risk_engine()

        route_ids = req.route_ids or list(engine.routes.keys())
        results = []
        for rid in route_ids:
            score = engine.score_route(rid, weather_fetcher)
            results.append(score)

        results.sort(key=lambda x: x["overall_risk"], reverse=True)
        return {
            "routes": results,
            "system_status": engine.get_system_status(results),
            "recommendations": engine.get_recommendations(results),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/all-routes")
def all_routes():
    """Return all route definitions (waypoints, type, metadata)."""
    return {"routes": engine.get_all_route_definitions()}


@app.post("/demo-scenario")
def demo_scenario(req: DemoRequest):
    """Inject a demo scenario with synthetic weather data."""
    try:
        results = engine.run_demo_scenario(req.scenario)
        return results
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/weather-status")
def weather_status():
    """Get current weather conditions at key waypoints."""
    return weather_fetcher.get_key_waypoint_weather()


@app.get("/threat-intel")
def threat_intel(force: bool = False):
    """
    Live threat intelligence from Wikipedia + ReliefWeb RSS.
    Returns updated manmade severity scores, geo risk scores, active disaster events.
    Cached for 30 min — pass ?force=true to bypass cache.
    """
    try:
        updates = threat_fetcher.get_live_updates(force=force)
        return updates
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ai-brief")
async def ai_brief(req: AIBriefRequest):
    """
    Gemini AI situational brief.
    - If route_id given: route-specific risk narrative + recommended actions.
    - If no route_id: system-level executive summary of current freight risk posture.
    """
    if not GEMINI_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Gemini API key not configured. Set GEMINI_API_KEY in main.py.",
        )

    try:
        # Gather context
        threat_updates = threat_fetcher.get_live_updates() if req.include_threats else {}

        context_lines = []

        if req.route_id:
            # ── Route-specific brief ──
            score = engine.score_route(req.route_id, weather_fetcher)
            context_lines += [
                f"ROUTE: {score['name']} ({score['short']})",
                f"TYPE: {score['type']} | STATUS: {score['status']} | OVERALL RISK: {round(score['overall_risk']*100)}%",
                f"RISK FACTORS: Weather {round(score['factors']['weather']*100)}%, "
                f"Geopolitical {round(score['factors']['geopolitical']*100)}%, "
                f"Manmade {round(score['factors']['manmade']*100)}%, "
                f"Seasonal {round(score['factors']['seasonal']*100)}%",
                f"DISTANCE: {score['economics']['km']} km | TRANSIT: {score['economics']['days']} days | BASE COST: ${score['economics']['base_cost_usd']}",
            ]
            if score.get("active_threats"):
                context_lines.append(
                    "ACTIVE THREATS ON ROUTE: "
                    + "; ".join(f"{t['id']} (severity {t['severity']})" for t in score["active_threats"])
                )
            prompt = (
                f"You are a senior freight intelligence analyst at a major Indian logistics firm. "
                f"Given the following live route data, write a concise 3-paragraph situational brief:\n\n"
                f"{chr(10).join(context_lines)}\n\n"
                f"Paragraph 1: Current risk assessment and what is driving it.\n"
                f"Paragraph 2: Operational impact on freight (delays, costs, safety).\n"
                f"Paragraph 3: Recommended action (proceed / reroute / hold) with specific alternatives.\n"
                f"Be direct. Use actual figures. No markdown headers. Max 200 words."
            )
        else:
            # ── System-level executive brief ──
            route_ids = list(engine.routes.keys())
            results = []
            for rid in route_ids:
                score = engine.score_route(rid, weather_fetcher)
                results.append(score)
            results.sort(key=lambda x: x["overall_risk"], reverse=True)
            system_status = engine.get_system_status(results)
            hold_routes    = [r for r in results if r["status"] == "HOLD"]
            reroute_routes = [r for r in results if r["status"] == "REROUTE"]
            clear_routes   = [r for r in results if r["status"] == "PROCEED"]

            context_lines += [
                f"SYSTEM STATUS: {system_status}",
                f"HOLD ROUTES ({len(hold_routes)}): {', '.join(r['short'] for r in hold_routes)}",
                f"REROUTE ROUTES ({len(reroute_routes)}): {', '.join(r['short'] for r in reroute_routes)}",
                f"CLEAR ROUTES ({len(clear_routes)}): {', '.join(r['short'] for r in clear_routes)}",
            ]

            if req.include_threats and threat_updates:
                high_threats = [
                    (k, v) for k, v in threat_updates.get("manmade_severity", {}).items()
                    if v >= 0.6
                ]
                if high_threats:
                    context_lines.append(
                        "HIGH SEVERITY THREATS: "
                        + ", ".join(f"{k} ({v:.2f})" for k, v in sorted(high_threats, key=lambda x: -x[1]))
                    )
                if threat_updates.get("natural_events"):
                    context_lines.append(
                        f"ACTIVE DISASTERS: {len(threat_updates['natural_events'])} events matched"
                    )

            prompt = (
                f"You are a chief supply chain risk officer briefing the India freight operations board. "
                f"Given this live system status, write a concise executive brief:\n\n"
                f"{chr(10).join(context_lines)}\n\n"
                f"Paragraph 1: Overall risk posture and most critical chokepoints.\n"
                f"Paragraph 2: Top 2 geopolitical / weather threats driving risk today.\n"
                f"Paragraph 3: Recommended immediate actions across road, rail and sea freight.\n"
                f"Be authoritative and specific. No markdown. Max 250 words."
            )

        # ── Call Gemini ───────────────────────────────────────────────────────
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.4,
                "maxOutputTokens": 512,
            },
        }
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(GEMINI_URL, json=payload)
            resp.raise_for_status()
            data = resp.json()

        brief_text = (
            data.get("candidates", [{}])[0]
            .get("content", {})
            .get("parts", [{}])[0]
            .get("text", "No response from Gemini.")
        )

        return {
            "brief": brief_text,
            "route_id": req.route_id,
            "generated_at": threat_updates.get("fetched_at", ""),
        }

    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Gemini API error: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)