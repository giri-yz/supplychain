"""
threat_fetcher.py  —  Live Threat Intelligence Layer
Sources:
  1. ReliefWeb Disasters RSS  — natural disaster events (confirmed working)
  2. Wikipedia Article Summaries — conflict zone articles (6/7 working)

Usage:
    from threat_fetcher import ThreatFetcher
    fetcher = ThreatFetcher()
    updates = fetcher.get_live_updates()
    fetcher.apply_to_risk_engine()

Run standalone:
    python threat_fetcher.py
"""

import requests
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import Dict, Tuple
import time

HEADERS = {"User-Agent": "SupplyChainMonitor/1.0 (research; contact: supply-chain-monitor@example.com)"}

# ─── WIKIPEDIA ARTICLE MAP ────────────────────────────────────────────────────
# Maps threat_id → (geo_key, wikipedia_article_title, is_historical)
# is_historical=True: article is about a past event — suppress keyword bumps
WIKI_ARTICLES = {
    "red_sea_houthi":  ("red_sea",         "Houthi_movement",                              False),
    "hormuz_tension":  ("hormuz",           "Strait_of_Hormuz",                             False),
    "manipur_protest": ("northeast_india",  "2023_Manipur_violence",                        True),   # past event — no keyword bumps
    "somalia_pirates": ("gulf_of_aden",     "Piracy_off_the_coast_of_Somalia",              False),
    "south_china_sea": ("south_china_sea",  "South_China_Sea_disputes",                     False),
    "taiwan_strait":   ("taiwan_strait",    "Taiwan_Strait",                                False),  # live article, not 2022 exercises
    "kashmir_nh44":    ("kashmir",          "Kashmir_conflict",                             False),
}

# Keyword → delta. Applied only to active (non-historical) articles, weighted by freshness.
ESCALATION_KEYWORDS = [
    (["missile", "drone strike", "tanker seized", "vessel seized", "naval blockade"], +0.12),
    (["escalat", "intensif", "resumed operations", "expanded operations"],             +0.07),
    (["naval exercise", "live-fire exercise", "military drill"],                       +0.04),
    (["blockade", "highway closed", "road shut", "convoy halted"],                     +0.06),
    (["ceasefire", "peace deal", "agreement signed", "withdrawn", "de-escalat"],      -0.12),
    (["reduced tension", "resumed shipping", "reopened"],                              -0.08),
]

# ─── RELIEFWEB DISASTER → ROUTE MAP ──────────────────────────────────────────
# Format: (required_country_terms, optional_type_terms, geo_key, severity_boost, label)
# A disaster matches ONLY IF:
#   - ANY required_country_term is present in title+desc
#   - AND (type_terms is empty OR ANY type_term is present)
# This prevents remote Pacific/Atlantic storms inflating India route scores.
DISASTER_KEYWORD_MAP = [
    (
        ["india", "bangladesh", "myanmar", "sri lanka", "andaman", "bay of bengal",
         "odisha", "andhra", "tamil", "west bengal"],
        ["cyclone", "typhoon", "storm", "flood", "landslide"],
        "bay_of_bengal", 0.70, "Bay of Bengal Storm/Flood"
    ),
    (["yemen"], ["flood", "conflict", "attack", "houthi", "war", "fire"], "red_sea", 0.55, "Yemen Disruption"),
    (["somalia"], [], "gulf_of_aden", 0.50, "Somalia Maritime Threat"),
    (["iran", "hormuz", "persian gulf"], [], "hormuz", 0.60, "Persian Gulf Alert"),
    (["manipur", "nagaland", "assam", "mizoram", "northeast india", "arunachal"], [], "northeast_india", 0.55, "India NE Disruption"),
    (["kashmir", "jammu"], [], "kashmir", 0.50, "Kashmir Disruption"),
    (["china", "taiwan", "south china sea"], [], "south_china_sea", 0.50, "Asia Pacific Tension"),
    (["india"], ["flood", "landslide", "earthquake", "fire", "outbreak", "strike", "cyclone"], "domestic", 0.40, "India Domestic Disruption"),
    (["malaysia", "indonesia", "singapore", "malacca"], ["flood", "earthquake", "conflict", "attack"], "malacca", 0.35, "Malacca Disruption"),
]
# ─── BASE SCORES ──────────────────────────────────────────────────────────────
BASE_SEVERITY = {
    "red_sea_houthi":  0.88,
    "hormuz_tension":  0.72,
    "south_china_sea": 0.55,
    "taiwan_strait":   0.62,
    "somalia_pirates": 0.45,
    "kashmir_nh44":    0.42,
    "manipur_protest": 0.38,
}

BASE_GEO_RISK = {
    "red_sea":         0.85,
    "hormuz":          0.50,
    "bay_of_bengal":   0.05,
    "south_china_sea": 0.35,
    "taiwan_strait":   0.45,
    "gulf_of_aden":    0.55,
    "malacca":         0.20,
    "indian_ocean":    0.05,
    "northeast_india": 0.40,
    "kashmir":         0.45,
    "domestic":        0.02,
}

# Hard cap: live score can't deviate more than this from base in either direction
MAX_DELTA_FROM_BASE = 0.18


class ThreatFetcher:
    def __init__(self, cache_ttl_minutes: int = 30):
        self._cache_ttl = cache_ttl_minutes * 60
        self._last_fetch: float = 0
        self._cached_result: Dict = {}

    def get_live_updates(self, force: bool = False) -> Dict:
        now = time.time()
        if not force and self._cached_result and (now - self._last_fetch) < self._cache_ttl:
            return self._cached_result

        manmade, geo, natural, sources = self._fetch_all()
        result = {
            "manmade_severity": manmade,
            "geo_risk": geo,
            "natural_events": natural,
            "sources": sources,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        }
        self._cached_result = result
        self._last_fetch = now
        return result

    def apply_to_risk_engine(self) -> Dict:
        import risk_engine as re
        updates = self.get_live_updates()
        for threat_id, severity in updates["manmade_severity"].items():
            if threat_id in re.MANMADE_THREATS:
                old = re.MANMADE_THREATS[threat_id]["severity"]
                re.MANMADE_THREATS[threat_id]["severity"] = round(severity, 3)
                print(f"  [threat] {threat_id}: {old:.2f} → {severity:.2f}")
        for geo_key, risk in updates["geo_risk"].items():
            if geo_key in re.GEOPOLITICAL_RISK:
                old = re.GEOPOLITICAL_RISK[geo_key]
                re.GEOPOLITICAL_RISK[geo_key] = round(risk, 3)
                print(f"  [geo]    {geo_key}: {old:.2f} → {risk:.2f}")
        return updates

    def _fetch_all(self) -> Tuple[Dict, Dict, list, list]:
        manmade_severity = dict(BASE_SEVERITY)
        geo_risk = dict(BASE_GEO_RISK)
        natural_events = []
        sources = []

        wiki_updates, wiki_sources = self._fetch_wikipedia()
        for threat_id, data in wiki_updates.items():
            manmade_severity[threat_id] = data["severity"]
            geo_key = data["geo_key"]
            if geo_key in geo_risk:
                geo_risk[geo_key] = round(
                    0.6 * data["geo_severity"] + 0.4 * BASE_GEO_RISK.get(geo_key, 0.3), 3
                )
        sources.extend(wiki_sources)

        disaster_events, disaster_sources = self._fetch_reliefweb_disasters()
        natural_events = disaster_events
        for event in disaster_events:
            geo_key = event.get("geo_key")
            boost = event.get("severity_boost", 0)
            if geo_key and geo_key in geo_risk and boost > 0:
                base = BASE_GEO_RISK.get(geo_key, 0)
                cap = base + 0.20
                current = geo_risk[geo_key]
                geo_risk[geo_key] = round(min(current + boost * 0.12, cap, 0.95), 3)
        sources.extend(disaster_sources)

        return manmade_severity, geo_risk, natural_events, sources

    def _fetch_wikipedia(self) -> Tuple[Dict, list]:
        updates = {}
        sources = []
        for threat_id, (geo_key, article_title, is_historical) in WIKI_ARTICLES.items():
            url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{article_title}"
            try:
                r = requests.get(url, headers=HEADERS, timeout=10)
                if r.status_code == 200:
                    data = r.json()
                    extract = data.get("extract", "")
                    modified_str = data.get("timestamp", "")
                    severity, geo_sev = self._score_wiki_extract(
                        extract, modified_str, threat_id, is_historical
                    )
                    updates[threat_id] = {
                        "severity": severity,
                        "geo_key": geo_key,
                        "geo_severity": geo_sev,
                        "modified": modified_str[:10],
                    }
                    sources.append(f"Wikipedia/{article_title}: OK (modified {modified_str[:10]})")
                else:
                    sources.append(f"Wikipedia/{article_title}: {r.status_code} — using base score")
            except Exception as e:
                sources.append(f"Wikipedia/{article_title}: ERROR {e} — using base score")
            time.sleep(0.3)
        return updates, sources

    def _score_wiki_extract(
        self, extract: str, modified_str: str, threat_id: str, is_historical: bool
    ) -> Tuple[float, float]:
        base = BASE_SEVERITY.get(threat_id, 0.40)
        text = extract.lower()
        delta = 0.0

        age_days = 999
        try:
            modified = datetime.fromisoformat(modified_str.replace("Z", "+00:00"))
            age_days = (datetime.now(timezone.utc) - modified).days
        except Exception:
            pass

        if is_historical:
            # Past event article — only time decay, no keyword escalation
            if age_days <= 7:
                delta = +0.02
            elif age_days > 180:
                delta = -0.10
            elif age_days > 90:
                delta = -0.05
        else:
            # Active situation — keywords weighted by article freshness
            if age_days <= 3:
                delta += 0.05
                kw_weight = 1.0
            elif age_days <= 7:
                delta += 0.02
                kw_weight = 0.8
            elif age_days <= 14:
                kw_weight = 0.5
            elif age_days <= 30:
                kw_weight = 0.2
            else:
                delta -= 0.05
                kw_weight = 0.0

            for keywords, bump in ESCALATION_KEYWORDS:
                if any(kw in text for kw in keywords):
                    delta += bump * kw_weight

        delta = max(-MAX_DELTA_FROM_BASE, min(MAX_DELTA_FROM_BASE, delta))
        severity = round(max(0.10, min(0.97, base + delta)), 3)
        geo_sev = round(max(0.05, severity - 0.10), 3)
        return severity, geo_sev

    def _fetch_reliefweb_disasters(self) -> Tuple[list, list]:
        url = "https://reliefweb.int/disasters/rss.xml"
        events = []
        sources = []
        try:
            r = requests.get(url, headers=HEADERS, timeout=15)
            if r.status_code == 200:
                root = ET.fromstring(r.text)
                items = root.findall(".//item")
                matched_count = 0

                for item in items:
                    title = item.findtext("title", "").lower()
                    desc = item.findtext("description", "").lower()
                    pub_date = item.findtext("pubDate", "")
                    combined = title + " " + desc

                    try:
                        dt = datetime.strptime(pub_date[:25].strip(), "%a, %d %b %Y %H:%M")
                        age_days = (datetime.utcnow() - dt).days
                    except Exception:
                        age_days = 60

                    if age_days > 45:
                        continue

                    for (required_terms, type_terms, geo_key, severity_boost, label) in DISASTER_KEYWORD_MAP:
                        if not any(t in combined for t in required_terms):
                            continue
                        if type_terms and not any(t in combined for t in type_terms):
                            continue

                        recency = max(0.3, 1.0 - age_days / 52.0)
                        events.append({
                            "title": item.findtext("title", ""),
                            "pub_date": pub_date[:22],
                            "geo_key": geo_key,
                            "label": label,
                            "severity_boost": round(severity_boost * recency, 3),
                            "age_days": age_days,
                            "source": "reliefweb_rss",
                        })
                        matched_count += 1
                        break

                sources.append(
                    f"ReliefWeb RSS: OK — {len(items)} total, {matched_count} matched to monitored zones"
                )
            else:
                sources.append(f"ReliefWeb RSS: {r.status_code}")
        except Exception as e:
            sources.append(f"ReliefWeb RSS: ERROR {e}")

        return events, sources


# ─── STANDALONE REPORT ────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("=" * 65)
    print("LIVE THREAT INTELLIGENCE REPORT")
    print(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 65)

    fetcher = ThreatFetcher()
    updates = fetcher.get_live_updates()

    print("\n📡 SOURCES")
    for s in updates["sources"]:
        print(f"  {s}")

    print("\n⚔️  MANMADE THREAT SEVERITY (live vs base)")
    print(f"  {'THREAT':<22} {'BASE':>6}  {'LIVE':>6}  {'DELTA':>7}")
    print(f"  {'-'*22} {'-'*6}  {'-'*6}  {'-'*7}")
    for tid, live_sev in sorted(updates["manmade_severity"].items()):
        base = BASE_SEVERITY.get(tid, 0)
        delta = live_sev - base
        arrow = "▲" if delta > 0.02 else ("▼" if delta < -0.02 else "─")
        print(f"  {tid:<22} {base:>6.2f}  {live_sev:>6.2f}  {arrow}{abs(delta):>5.2f}")

    print("\n🌍 GEOPOLITICAL RISK (live vs base)")
    print(f"  {'GEO ZONE':<20} {'BASE':>6}  {'LIVE':>6}  {'DELTA':>7}")
    print(f"  {'-'*20} {'-'*6}  {'-'*6}  {'-'*7}")
    for gk, live_risk in sorted(updates["geo_risk"].items()):
        base = BASE_GEO_RISK.get(gk, 0)
        delta = live_risk - base
        arrow = "▲" if delta > 0.01 else ("▼" if delta < -0.01 else "─")
        print(f"  {gk:<20} {base:>6.2f}  {live_risk:>6.2f}  {arrow}{abs(delta):>5.2f}")

    print(f"\n🌪️  ACTIVE NATURAL DISASTER EVENTS ({len(updates['natural_events'])} matched)")
    if updates["natural_events"]:
        for ev in updates["natural_events"][:10]:
            print(f"  [{ev['age_days']:>2}d ago] {ev['title'][:55]:<55} → {ev['geo_key']} (+{ev['severity_boost']:.2f})")
    else:
        print("  None matched to monitored zones.")

    print(f"\n⏱  Fetched at: {updates['fetched_at']}")
    print("=" * 65)