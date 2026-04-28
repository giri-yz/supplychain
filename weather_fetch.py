"""
Weather Fetcher — tomorrow.io (marine) + OpenWeatherMap (land)
Caches responses per (lat, lng, hour) to avoid redundant API calls.
"""
import requests
import time
import os
from datetime import datetime
from typing import Dict, Any, Optional

TOMORROW_API_KEY = os.getenv("TOMORROW_API_KEY", "")
OWM_API_KEY = os.getenv("OWM_API_KEY", "")

# Key waypoints to display weather for
KEY_WAYPOINTS = {
    "Bay of Bengal": {"lat": 13.0, "lng": 86.0, "type": "sea"},
    "Arabian Sea (Hormuz Approach)": {"lat": 22.0, "lng": 65.0, "type": "sea"},
    "Red Sea / Suez": {"lat": 27.0, "lng": 36.0, "type": "sea"},
    "Chennai": {"lat": 13.08, "lng": 80.27, "type": "land"},
    "Mumbai": {"lat": 19.07, "lng": 72.87, "type": "land"},
    "Delhi": {"lat": 28.63, "lng": 77.21, "type": "land"},
    "Kolkata": {"lat": 22.57, "lng": 88.36, "type": "land"},
    "Kandla Port": {"lat": 23.03, "lng": 70.22, "type": "sea"},
}

# Weather cache: {(lat_round, lng_round, hour): data}
_cache: Dict = {}


def _cache_key(lat: float, lng: float) -> tuple:
    return (round(lat, 1), round(lng, 1), datetime.now().hour)


def _fetch_tomorrow(lat: float, lng: float) -> Dict[str, Any]:
    """Fetch weather from tomorrow.io API for a coordinate."""
    key = _cache_key(lat, lng)
    if key in _cache:
        return _cache[key]

    url = "https://api.tomorrow.io/v4/weather/realtime"
    params = {
        "location": f"{lat},{lng}",
        "apikey": TOMORROW_API_KEY,
        "units": "metric",
        "fields": "windSpeed,windGust,waveHeight,precipitationIntensity,visibility,weatherCode,temperature,humidity",
    }
    try:
        resp = requests.get(url, params=params, timeout=8)
        resp.raise_for_status()
        data = resp.json()
        values = data.get("data", {}).get("values", {})
        result = {
            "source": "tomorrow.io",
            "wind_speed": values.get("windSpeed", 0),
            "wind_gust": values.get("windGust", 0),
            "wave_height": values.get("waveHeight", 0),
            "precipitation": values.get("precipitationIntensity", 0),
            "visibility": values.get("visibility", 10),
            "weather_code": values.get("weatherCode", 1000),
            "temperature": values.get("temperature", 25),
            "humidity": values.get("humidity", 60),
        }
        _cache[key] = result
        return result
    except Exception as e:
        return _fallback_weather(lat, lng)


def _fetch_owm(lat: float, lng: float) -> Dict[str, Any]:
    """Fetch weather from OpenWeatherMap for land waypoints."""
    key = _cache_key(lat, lng)
    if key in _cache:
        return _cache[key]

    url = "https://api.openweathermap.org/data/2.5/weather"
    params = {
        "lat": lat,
        "lon": lng,
        "appid": OWM_API_KEY,
        "units": "metric",
    }
    try:
        resp = requests.get(url, params=params, timeout=8)
        resp.raise_for_status()
        data = resp.json()
        result = {
            "source": "openweathermap",
            "wind_speed": data.get("wind", {}).get("speed", 0),
            "wind_gust": data.get("wind", {}).get("gust", 0),
            "wave_height": 0,
            "precipitation": data.get("rain", {}).get("1h", 0),
            "visibility": data.get("visibility", 10000) / 1000,  # to km
            "weather_code": data.get("weather", [{}])[0].get("id", 800),
            "temperature": data.get("main", {}).get("temp", 25),
            "humidity": data.get("main", {}).get("humidity", 60),
            "description": data.get("weather", [{}])[0].get("description", "clear"),
        }
        _cache[key] = result
        return result
    except Exception as e:
        return _fallback_weather(lat, lng)


def _fallback_weather(lat: float, lng: float) -> Dict[str, Any]:
    """Return benign fallback weather when API fails."""
    return {
        "source": "fallback",
        "wind_speed": 8,
        "wind_gust": 12,
        "wave_height": 1.0,
        "precipitation": 0,
        "visibility": 10,
        "weather_code": 1000,
        "temperature": 28,
        "humidity": 65,
    }


def fetch_weather(lat: float, lng: float, mode: str = "sea") -> Dict[str, Any]:
    """Unified weather fetch — tomorrow.io for sea, OWM for land."""
    if mode == "sea":
        return _fetch_tomorrow(lat, lng)
    else:
        return _fetch_owm(lat, lng)


def compute_weather_risk(weather: Dict, mode: str) -> float:
    """Convert raw weather data to a 0–1 risk score."""
    risk = 0.0

    wind = weather.get("wind_speed", 0)
    gust = weather.get("wind_gust", 0)
    rain = weather.get("precipitation", 0)
    vis = weather.get("visibility", 10)

    if mode == "sea":
        wave = weather.get("wave_height", 0)
        # Wave height: >4m = critical (0.9+), 2-4m = high, <2m = low
        if wave > 6:
            risk = max(risk, 0.95)
        elif wave > 4:
            risk = max(risk, 0.75)
        elif wave > 2.5:
            risk = max(risk, 0.50)
        elif wave > 1.5:
            risk = max(risk, 0.25)

        # Wind for sea
        if wind > 60:
            risk = max(risk, 0.95)
        elif wind > 40:
            risk = max(risk, 0.70)
        elif wind > 25:
            risk = max(risk, 0.45)
        elif wind > 15:
            risk = max(risk, 0.20)

    else:  # land (road/rail)
        # Rainfall
        if rain > 50:
            risk = max(risk, 0.90)  # Extreme rain
        elif rain > 20:
            risk = max(risk, 0.65)
        elif rain > 10:
            risk = max(risk, 0.40)
        elif rain > 5:
            risk = max(risk, 0.20)

        # Wind for land
        if wind > 80:
            risk = max(risk, 0.85)
        elif wind > 50:
            risk = max(risk, 0.55)
        elif wind > 30:
            risk = max(risk, 0.30)

        # Visibility
        if vis < 0.1:
            risk = max(risk, 0.80)
        elif vis < 0.5:
            risk = max(risk, 0.50)
        elif vis < 1:
            risk = max(risk, 0.30)

    return round(min(risk, 1.0), 3)


class WeatherFetcher:
    def check_apis(self):
        status = {}
        # Quick ping tomorrow.io
        try:
            r = requests.get(
                "https://api.tomorrow.io/v4/weather/realtime",
                params={"location": "13,80", "apikey": TOMORROW_API_KEY, "units": "metric"},
                timeout=5
            )
            status["tomorrow_io"] = "ok" if r.status_code == 200 else f"error_{r.status_code}"
        except:
            status["tomorrow_io"] = "unreachable"

        # Quick ping OWM
        try:
            r = requests.get(
                "https://api.openweathermap.org/data/2.5/weather",
                params={"lat": 13, "lon": 80, "appid": OWM_API_KEY, "units": "metric"},
                timeout=5
            )
            status["openweathermap"] = "ok" if r.status_code == 200 else f"error_{r.status_code}"
        except:
            status["openweathermap"] = "unreachable"

        return status

    def fetch_for_waypoints(self, waypoints: list, mode: str) -> list:
        """Fetch weather for a list of (lat, lng) waypoints."""
        results = []
        for lat, lng in waypoints:
            w = fetch_weather(lat, lng, mode)
            w["lat"] = lat
            w["lng"] = lng
            w["risk"] = compute_weather_risk(w, mode)
            results.append(w)
            time.sleep(0.05)  # small delay to avoid rate limiting
        return results

    def get_key_waypoint_weather(self):
        """Get current weather at major monitoring points."""
        result = {}
        for name, info in KEY_WAYPOINTS.items():
            w = fetch_weather(info["lat"], info["lng"], info["type"])
            w["risk"] = compute_weather_risk(w, info["type"])
            result[name] = w
        return {"waypoints": result}
