"""
monitor.py — Level 3 intervention triggers for Ignition OS.

Endpoints:
  GET  /health/ping          — Railway health check
  POST /cron/daily           — Run by Railway cron daily at 07:00 CT
  GET  /monitor/dashboard    — TRACE admin: live shop status summary

Intervention rules:
  TRIAL_AT_RISK    — trial shop, no feature_events in 5+ days
  TRIAL_DAY_12     — savings report should be triggered
  ERROR_SPIKE      — 5+ errors from one shop in 1 hour
  AI_FAILURE_STREAK — 3+ consecutive AI_CALL errors for one shop
  TRIAL_EXPIRED    — trial ended, no conversion
"""

import os, smtplib
from datetime import datetime, timezone, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from fastapi import APIRouter
from dotenv import load_dotenv

load_dotenv(override=True)

monitor_router = APIRouter(prefix="", tags=["Monitor"])

# ── Supabase helper ───────────────────────────────────────────────────────────

def _sb():
    from supabase import create_client
    url = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("VITE_SUPABASE_ANON_KEY")
    return create_client(url, key)

# ── Email helper ──────────────────────────────────────────────────────────────

def _send_alert(subject: str, body: str):
    """Send alert email to TRACE. Requires ALERT_EMAIL_FROM + ALERT_EMAIL_PASSWORD env vars."""
    sender   = os.getenv("ALERT_EMAIL_FROM")
    password = os.getenv("ALERT_EMAIL_PASSWORD")
    receiver = os.getenv("ALERT_EMAIL_TO", "david_obrien2016@outlook.com")

    if not sender or not password:
        print(f"[Monitor] Email not configured — alert skipped: {subject}")
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"[Ignition OS Alert] {subject}"
        msg["From"]    = sender
        msg["To"]      = receiver
        msg.attach(MIMEText(body, "plain"))

        with smtplib.SMTP("smtp.office365.com", 587) as server:
            server.starttls()
            server.login(sender, password)
            server.sendmail(sender, receiver, msg.as_string())
        print(f"[Monitor] Alert sent: {subject}")
        return True
    except Exception as e:
        print(f"[Monitor] Email send failed: {e}")
        return False

def _log_alert(sb, alert_type: str, shop_id: str, shop_name: str, detail: str):
    """Write alert to monitoring_alerts table and attempt email."""
    try:
        sb.table("monitoring_alerts").insert({
            "alert_type": alert_type,
            "shop_id":    shop_id,
            "shop_name":  shop_name,
            "detail":     detail,
            "actioned":   False,
        }).execute()
    except Exception as e:
        print(f"[Monitor] alert log failed: {e}")

# ── Health check ──────────────────────────────────────────────────────────────

@monitor_router.get("/health/ping")
async def health_ping():
    return {"status": "ok", "ts": datetime.now(timezone.utc).isoformat()}

# ── Dashboard (TRACE admin quick view) ───────────────────────────────────────

@monitor_router.get("/monitor/dashboard")
async def dashboard():
    sb  = _sb()
    now = datetime.now(timezone.utc)

    shops = sb.table("shops").select("id,name,tier,trial_started_at,created_at").execute().data or []
    alerts = sb.table("monitoring_alerts").select("*").eq("actioned", False).execute().data or []
    errors_24h = sb.table("error_events").select("shop_id,error_type,created_at") \
        .gte("created_at", (now - timedelta(hours=24)).isoformat()).execute().data or []
    events_24h = sb.table("feature_events").select("shop_id,module,action,created_at") \
        .gte("created_at", (now - timedelta(hours=24)).isoformat()).execute().data or []

    shop_activity = {}
    for e in events_24h:
        shop_activity.setdefault(e["shop_id"], 0)
        shop_activity[e["shop_id"]] += 1

    summary = []
    for s in shops:
        trial_start = datetime.fromisoformat(s["trial_started_at"].replace("Z", "+00:00")) if s.get("trial_started_at") else None
        trial_day   = (now - trial_start).days if trial_start else None
        summary.append({
            "name":          s["name"],
            "tier":          s["tier"],
            "trial_day":     trial_day,
            "events_24h":    shop_activity.get(s["id"], 0),
            "errors_24h":    sum(1 for e in errors_24h if e["shop_id"] == s["id"]),
        })

    return {
        "shops":           summary,
        "open_alerts":     len(alerts),
        "total_errors_24h": len(errors_24h),
        "total_events_24h": len(events_24h),
        "checked_at":      now.isoformat(),
    }

# ── Daily cron — Level 3 intervention triggers ────────────────────────────────

@monitor_router.post("/cron/daily")
async def daily_monitor():
    sb      = _sb()
    now     = datetime.now(timezone.utc)
    alerts  = []

    shops = sb.table("shops").select("id,name,tier,trial_started_at").execute().data or []

    for shop in shops:
        sid   = shop["id"]
        sname = shop["name"]
        tier  = shop["tier"]

        trial_start = datetime.fromisoformat(shop["trial_started_at"].replace("Z", "+00:00")) \
            if shop.get("trial_started_at") else None
        trial_day = (now - trial_start).days if trial_start else None

        # ── TRIAL_AT_RISK: no activity in 5+ days ────────────────────────────
        if tier == "TRIAL":
            recent = sb.table("feature_events").select("id") \
                .eq("shop_id", sid) \
                .gte("created_at", (now - timedelta(days=5)).isoformat()) \
                .limit(1).execute().data
            if not recent:
                detail = f"No activity in 5+ days. Trial day {trial_day}."
                _log_alert(sb, "TRIAL_AT_RISK", sid, sname, detail)
                alerts.append(f"AT RISK: {sname} — {detail}")

        # ── TRIAL_DAY_12: trigger savings report ─────────────────────────────
        if tier == "TRIAL" and trial_day == 12:
            detail = "Trial day 12 — savings report should be sent."
            _log_alert(sb, "TRIAL_DAY_12", sid, sname, detail)
            alerts.append(f"DAY 12: {sname} — {detail}")

        # ── TRIAL_EXPIRED: no conversion after 16 days ───────────────────────
        if tier == "TRIAL" and trial_day and trial_day >= 16:
            detail = f"Trial expired at day {trial_day} with no conversion."
            _log_alert(sb, "TRIAL_EXPIRED", sid, sname, detail)
            alerts.append(f"EXPIRED: {sname} — {detail}")

        # ── ERROR_SPIKE: 5+ errors in last hour ──────────────────────────────
        recent_errors = sb.table("error_events").select("id") \
            .eq("shop_id", sid) \
            .gte("created_at", (now - timedelta(hours=1)).isoformat()) \
            .execute().data or []
        if len(recent_errors) >= 5:
            detail = f"{len(recent_errors)} errors in the last hour."
            _log_alert(sb, "ERROR_SPIKE", sid, sname, detail)
            alerts.append(f"ERROR SPIKE: {sname} — {detail}")

        # ── AI_FAILURE_STREAK: 3 consecutive AI_CALL errors ──────────────────
        ai_errors = sb.table("error_events").select("error_type,created_at") \
            .eq("shop_id", sid).eq("error_type", "AI_CALL") \
            .gte("created_at", (now - timedelta(hours=6)).isoformat()) \
            .order("created_at", desc=True).limit(3).execute().data or []
        if len(ai_errors) >= 3:
            detail = f"3 consecutive AI_CALL failures in 6 hours."
            _log_alert(sb, "AI_FAILURE_STREAK", sid, sname, detail)
            alerts.append(f"AI FAILURES: {sname} — {detail}")

    # ── Send single digest email if any alerts fired ─────────────────────────
    if alerts:
        body = "Ignition OS — Daily Monitor Report\n"
        body += f"Run at: {now.strftime('%Y-%m-%d %H:%M UTC')}\n"
        body += f"Shops checked: {len(shops)}\n\n"
        body += "\n".join(f"• {a}" for a in alerts)
        body += "\n\nView full dashboard: https://ignition-os.vercel.app (admin)"
        _send_alert(f"{len(alerts)} alert(s) need attention", body)

    return {
        "shops_checked": len(shops),
        "alerts_fired":  len(alerts),
        "alerts":        alerts,
        "run_at":        now.isoformat(),
    }
