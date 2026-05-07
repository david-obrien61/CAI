import time
import tempfile
import secrets
import base64
from google import genai
from google.genai import types
from typing import List, Dict, Optional
from pydantic import BaseModel, Field
from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.responses import PlainTextResponse, HTMLResponse, RedirectResponse
import httpx
import uvicorn
from fastapi.middleware.cors import CORSMiddleware
import json
import os
from dotenv import load_dotenv

# Load environment variables from the .env file (override=True forces it to ignore cached terminal variables)
load_dotenv(override=True)

# ==========================================
# Configure Gemini API
# ==========================================
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    print("WARNING: GEMINI_API_KEY environment variable not set.")
client = genai.Client(api_key=api_key)

# ==========================================
# 0. PYDANTIC MODELS (Strict Data Shapes)
# ==========================================

class PartManifestItem(BaseModel):
    name: str
    qty: int

class RepairTask(BaseModel):
    description: str
    suggested_hours: float
    parts: List[PartManifestItem]

class TranscriptionResponse(BaseModel):
    transcription: str
    tasks: List[RepairTask]

# ==========================================
# 1. FASTAPI APP INSTANCE
# ==========================================

app = FastAPI(
    title="Ignition OS Smart Estimate Engine",
    description="Processes technician audio notes to generate parts manifests.",
    version="1.0.0"
)

# Enable CORS so the React Web App can talk to this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount the unified AI router (/ai/vin_decode, /ai/dtc_decode, etc.)
from ai_router import ai_router, _supabase, _anthropic_client, _log_usage, _log_error
app.include_router(ai_router)

# Mount the monitor router (/health/ping, /monitor/dashboard, /cron/daily)
from monitor import monitor_router
app.include_router(monitor_router)

# ==========================================
# 2. CENTRAL DATABASE (Mock Cloud)
# ==========================================

DB_FILE = "shop_db.json"

def load_db():
    if os.path.exists(DB_FILE):
        with open(DB_FILE, "r") as f:
            return json.load(f)
    return {
        "jobs": [
            { "jobId": "JOB-999", "name": "PRE-FLIGHT TEST", "year": "1999", "make": "Chevy", "model": "Suburban", "status": "READY" }
        ]
    }

def save_db(data):
    with open(DB_FILE, "w") as f:
        json.dump(data, f, indent=4)

DATABASE = load_db()

# ==========================================
# 3. QUICKBOOKS OAUTH CONFIG
# ==========================================

QBO_CLIENT_ID     = os.getenv("QBO_CLIENT_ID", "")
QBO_CLIENT_SECRET = os.getenv("QBO_CLIENT_SECRET", "")
QBO_REDIRECT_URI  = os.getenv("QBO_REDIRECT_URI", "http://localhost:8000/api/qbo/callback")
QBO_ENVIRONMENT   = os.getenv("QBO_ENVIRONMENT", "sandbox")  # "sandbox" or "production"
QBO_SCOPE         = "com.intuit.quickbooks.accounting"

QBO_AUTH_BASE = "https://appcenter.intuit.com/connect/oauth2"
QBO_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer"
QBO_API_BASE  = (
    "https://sandbox-quickbooks.api.intuit.com/v3/company"
    if QBO_ENVIRONMENT == "sandbox"
    else "https://quickbooks.api.intuit.com/v3/company"
)

# In-memory token store (survives restarts via DB_FILE below)
qbo_tokens: dict = {}

def load_qbo_tokens():
    global qbo_tokens
    db = load_db()
    qbo_tokens = db.get("qbo_tokens", {})

def save_qbo_tokens():
    db = load_db()
    db["qbo_tokens"] = qbo_tokens
    save_db(db)

# ── OAuth state nonce (prevents CSRF) ──────────────────────────────────────────
_oauth_states: dict = {}  # state_nonce → True


# ==========================================
# 3b. LOGIC ENGINE (AI SIMULATION)
# ==========================================


# ==========================================
# 4. API ENDPOINTS
# ==========================================

@app.get("/")
async def root():
    """Root endpoint to provide a friendly welcome message."""
    return {"message": "Welcome to the Ignition OS Smart Estimate Engine API! Visit /docs to test the endpoints."}

@app.get("/api/jobs")
async def get_jobs():
    """Returns the central list of jobs"""
    return DATABASE["jobs"]

@app.post("/api/jobs")
async def save_jobs(jobs: List[dict]):
    """Overwrites the central list of jobs (Mock sync)"""
    DATABASE["jobs"] = jobs
    save_db(DATABASE)
    return {"status": "success"}

@app.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio(file: UploadFile = File(...)):
    """
    Accepts an audio file, simulates transcription and part extraction,
    and returns data in the format the mobile app expects.
    """
    print(f"Received file: {file.filename} ({file.content_type})")
    
    # 1. Save the uploaded audio to a temporary file so Gemini can process it
    with tempfile.NamedTemporaryFile(delete=False, suffix=".m4a") as temp_audio:
        temp_audio.write(await file.read())
        temp_audio_path = temp_audio.name

    try:
        # 2. Upload to Gemini
        print("Uploading audio to Gemini...")
        audio_file = client.files.upload(file=temp_audio_path)

        # Wait for the file to finish processing on Google's end
        state = getattr(audio_file.state, "name", str(audio_file.state))
        while "PROCESSING" in state:
            print("Processing audio on Gemini...", flush=True)
            time.sleep(2)
            audio_file = client.files.get(name=audio_file.name)
            state = getattr(audio_file.state, "name", str(audio_file.state))
            
        if "FAILED" in state:
            raise Exception("Gemini failed to process the audio file.")

        # 3. Prompt Gemini with strict JSON instructions
        prompt = """
        You are a master diesel mechanic and service writer. 
        Listen to the following technician's audio note. 
        1. Provide a clean, professional text transcription of what they said.
        2. Extract the repair actions into specific 'tasks'.
        3. For each task, estimate the 'suggested_hours' based on standard heavy-duty/diesel labor guides.
        4. For each task, list the REQUIRED 'parts'. If a part implies other necessary parts (e.g., an oil change requires an oil filter, a gasket implies sealant, etc.), include those implied parts too with reasonable quantities.
        
        Return the result strictly as JSON matching this schema:
        {
            "transcription": "string",
            "tasks": [
                {
                    "description": "string",
                    "suggested_hours": float,
                    "parts": [{"name": "string", "qty": int}]
                }
            ]
        }
        """

        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[prompt, audio_file],
            config=types.GenerateContentConfig(response_mime_type="application/json")
        )
        
        # 4. Parse JSON and return to mobile app
        raw_text = response.text
        print(f"RAW GEMINI RESPONSE:\n{raw_text}")
        
        # Strip markdown code blocks if Gemini accidentally included them
        if raw_text.strip().startswith("```"):
            raw_text = raw_text.strip().strip("`").replace("json\n", "", 1)
            
        result = json.loads(raw_text)
        return TranscriptionResponse(**result)

    except Exception as e:
        import traceback
        print("\n--- ERROR IN TRANSCRIBE ---")
        traceback.print_exc()
        print("---------------------------\n")
        return PlainTextResponse(content=f"Server Error: {str(e)}", status_code=500)

    finally:
        # Clean up the file from Google's servers
        try:
            if 'audio_file' in locals() and audio_file.name:
                client.files.delete(name=audio_file.name)
        except Exception:
            pass
            
        # Clean up local temp file
        if os.path.exists(temp_audio_path):
            os.remove(temp_audio_path)

# ==========================================
# 5. ESTIMATE AGENT
# ==========================================

class EstimateBuildRequest(BaseModel):
    estimate_id: str
    shop_id:     str
    labor_rate:      float = 125.0   # shop's door rate $/hr
    markup_percent:  float = 40.0    # parts markup over wholesale cost
    tax_rate:        float = 0.0825  # sales tax applied to parts only


def _get_labor_hours(work_items: list, dtc_codes: list, vehicle: dict,
                     complaint: str, tech_notes: str,
                     shop_id: str) -> list:
    """
    Maps evaluation work items → priced line items via Claude.

    Pilot: Claude approximation of flat-rate labor hours.
    Upgrade path: swap this function body for a Mitchell1 / AllData API call.
    The input/output contract (work_items in → line item dicts out) stays the same.
    """
    import anthropic

    dtc_summary = [
        {"code": d["code"], "description": d.get("description", ""), "severity": d.get("severity", "")}
        for d in dtc_codes
    ]

    system = (
        "You are an expert automotive service estimator. Your job is to convert a technician's "
        "evaluation findings into a complete, customer-ready line-item repair estimate.\n\n"
        "Rules:\n"
        "- Create separate LABOR and PART line items for every repair identified.\n"
        "- Labor hours must reflect standard flat-rate book time (Mitchell1/AllData equivalent). "
        "Be realistic — do not pad or underestimate.\n"
        "- For PART items, provide realistic OEM-equivalent wholesale cost estimates.\n"
        "- Include shop supplies and hazmat/disposal as FEE line items on any fluids job.\n"
        "- Sort by: major repairs first, then minor, then fees (sort_order ascending).\n"
        "- Descriptions must be customer-facing — clear, professional, no jargon.\n"
        "- Return ONLY a valid JSON array. No markdown, no explanation text."
    )

    user = (
        f"Vehicle: {json.dumps(vehicle)}\n"
        f"Customer complaint: {complaint}\n"
        f"Tech notes: {tech_notes}\n"
        f"Work items identified during evaluation: {json.dumps(work_items)}\n"
        f"Active DTC fault codes: {json.dumps(dtc_summary)}\n\n"
        "Return a JSON array. Each element must match this shape exactly:\n"
        "{\n"
        '  "item_type": "LABOR|PART|SUBLET|FEE|MISC",\n'
        '  "description": "Customer-facing description",\n'
        '  "part_number": "OEM or aftermarket part number (PART only, else null)",\n'
        '  "quantity": 1,\n'
        '  "labor_hours": null,\n'
        '  "unit_cost_estimate": 0.00,\n'
        '  "sort_order": 0,\n'
        '  "notes": "Internal tech note or null"\n'
        "}\n\n"
        "For LABOR items: set labor_hours, set unit_cost_estimate to null.\n"
        "For PART items: set unit_cost_estimate (wholesale cost), set labor_hours to null.\n"
        "For FEE items: set unit_cost_estimate, set labor_hours to null.\n"
    )

    client = _anthropic_client()
    msg = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=4096,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    raw = msg.content[0].text.strip()

    cost = msg.usage.input_tokens * 0.00000025 + msg.usage.output_tokens * 0.00000125
    _log_usage(shop_id, "estimate_build_labor", "claude", "claude-haiku-4-5-20251001",
               msg.usage.input_tokens, msg.usage.output_tokens, cost)

    # Strip markdown fences if model added them
    if raw.startswith("```"):
        raw = "\n".join(raw.split("\n")[1:]).rsplit("```", 1)[0]

    return json.loads(raw.strip())


def _source_parts(line_items: list, shop_id: str, job_id: str) -> list:
    """
    For each PART line item:
    1. Check Supabase `inventory` table for a match (by part_number or name ilike)
    2. If found and qty > 0: set source='INVENTORY', unit_cost from inventory row
    3. If not found or qty = 0: set source='VENDOR', supplier = highest-priority vendor
    """
    from ai_router import _supabase
    db = _supabase()

    # Preferred vendors (simulating DataBridge backend sync)
    vendors = [
        {"id": "V-001", "name": "AutoZone Commercial", "priority": 1},
        {"id": "V-002", "name": "NAPA Auto Parts", "priority": 2},
        {"id": "V-003", "name": "FleetPride", "priority": 3}
    ]
    vendors.sort(key=lambda x: x["priority"])
    default_vendor = vendors[0]["name"]

    for item in line_items:
        if item.get("item_type") != "PART":
            continue

        part_num = item.get("part_number")
        desc = item.get("description", "")
        
        match = None
        if part_num:
            res = db.table("inventory").select("*").eq("shop_id", shop_id).eq("part_number", part_num).execute()
            if res.data:
                match = res.data[0]
        
        if not match and desc:
            res = db.table("inventory").select("*").eq("shop_id", shop_id).ilike("name", f"%{desc}%").execute()
            if res.data:
                match = res.data[0]
                
        if match and match.get("qty", 0) > 0:
            item["source"] = "INVENTORY"
            item["supplier"] = "SHOP_STOCK"
            if match.get("unit_cost") is not None:
                item["unit_cost_estimate"] = match.get("unit_cost")
        else:
            item["source"] = "VENDOR"
            item["supplier"] = default_vendor

    return line_items


@app.post("/api/estimate/build")
async def build_estimate(req: EstimateBuildRequest):
    """
    Estimate agent pipeline:
      1. Load estimate + evaluation + DTC codes from Supabase
      2. Call Claude to map work items → labor hours + parts
      3. Apply shop margin engine to parts pricing
      4. Write estimate_line_items rows
      5. Update estimate status → ready + totals
      6. Return structured result
    """
    db = _supabase()

    # ── 1. Load estimate row ──────────────────────────────────────────────────
    est_res = db.table("estimates").select("*").eq("id", req.estimate_id).single().execute()
    if not est_res.data:
        raise HTTPException(404, "Estimate not found")
    estimate = est_res.data
    job_id   = estimate["job_id"]
    eval_id  = estimate.get("evaluation_id")

    # ── 2. Load evaluation ────────────────────────────────────────────────────
    evaluation = None
    if eval_id:
        ev = db.table("evaluations").select("*").eq("id", eval_id).single().execute()
        evaluation = ev.data
    if not evaluation:
        # Fall back: latest submitted eval for this job
        ev = (db.table("evaluations").select("*")
              .eq("job_id", job_id).eq("status", "submitted")
              .order("created_at", desc=True).limit(1).execute())
        evaluation = ev.data[0] if ev.data else None
    if not evaluation:
        raise HTTPException(404, "No submitted evaluation found for this job")

    # ── 3. Load DTC codes ─────────────────────────────────────────────────────
    dtc_res   = db.table("dtc_codes").select("*").eq("evaluation_id", evaluation["id"]).execute()
    dtc_codes = dtc_res.data or []

    # ── 4. Load job + vehicle snapshot ────────────────────────────────────────
    job_res = db.table("jobs").select("*").eq("id", job_id).single().execute()
    job     = job_res.data or {}
    vehicle = job.get("vehicle") or {}

    complaint  = evaluation.get("complaint") or job.get("complaint") or ""
    tech_notes = evaluation.get("tech_notes") or ""
    work_items = evaluation.get("work_items") or []

    # ── 5. Call Claude labor/parts agent ─────────────────────────────────────
    try:
        agent_items = _get_labor_hours(
            work_items, dtc_codes, vehicle, complaint, tech_notes, req.shop_id
        )
    except json.JSONDecodeError as e:
        _log_error(req.shop_id, "AI_CALL", "Estimate JSON parse failed",
                   endpoint="/api/estimate/build", detail=str(e))
        raise HTTPException(500, f"Failed to parse estimate JSON from Claude: {e}")
    except Exception as e:
        _log_error(req.shop_id, "AI_CALL", str(e), endpoint="/api/estimate/build")
        raise HTTPException(500, f"Claude estimate failed: {e}")

    # ── 5b. Source parts from inventory or preferred vendor ───────────────────
    agent_items = _source_parts(agent_items, shop_id=req.shop_id, job_id=job_id)

    # ── 6. Apply margin engine ────────────────────────────────────────────────
    markup     = req.markup_percent / 100.0
    labor_rate = req.labor_rate
    rows_to_insert = []
    subtotal_parts = 0.0
    subtotal_labor = 0.0
    subtotal_fees  = 0.0

    for i, item in enumerate(agent_items):
        item_type   = item.get("item_type", "MISC")
        quantity    = float(item.get("quantity") or 1)
        labor_hours = float(item["labor_hours"]) if item.get("labor_hours") else None
        unit_cost   = float(item["unit_cost_estimate"]) if item.get("unit_cost_estimate") else None

        unit_price = None
        line_total = 0.0

        if item_type == "LABOR" and labor_hours:
            unit_price = labor_rate
            line_total = round(labor_hours * labor_rate, 2)
            subtotal_labor += line_total

        elif item_type == "PART" and unit_cost is not None:
            unit_price = round(unit_cost * (1 + markup), 2)
            line_total = round(unit_price * quantity, 2)
            subtotal_parts += line_total

        elif unit_cost is not None:
            unit_price = round(unit_cost, 2)
            line_total = round(unit_price * quantity, 2)
            subtotal_fees += line_total

        rows_to_insert.append({
            "estimate_id": req.estimate_id,
            "job_id":      job_id,
            "shop_id":     req.shop_id,
            "item_type":   item_type,
            "description": item.get("description", ""),
            "part_number": item.get("part_number"),
            "supplier":    item.get("supplier"),
            "quantity":    quantity,
            "unit_cost":   unit_cost,
            "unit_price":  unit_price,
            "labor_hours": labor_hours,
            "labor_rate":  labor_rate if item_type == "LABOR" else None,
            "line_total":  line_total,
            "auth_status": "pending",
            "sort_order":  item.get("sort_order", i),
            "notes":       item.get("notes"),
        })

    # ── 7. Write line items ───────────────────────────────────────────────────
    try:
        db.table("estimate_line_items").insert(rows_to_insert).execute()
    except Exception as e:
        raise HTTPException(500, f"Failed to write estimate line items: {e}")

    # ── 8. Update estimate totals + status ────────────────────────────────────
    subtotal = round(subtotal_labor + subtotal_parts + subtotal_fees, 2)
    # Tax applied to parts only (labor is generally not taxable in most US states)
    tax   = round(subtotal_parts * req.tax_rate, 2)
    total = round(subtotal + tax, 2)

    agent_notes = (
        f"{len(rows_to_insert)} line items generated. "
        f"Labor: ${subtotal_labor:.2f} | Parts: ${subtotal_parts:.2f} | Fees: ${subtotal_fees:.2f}. "
        f"{len(dtc_codes)} DTC codes processed. "
        f"{len(work_items)} work items from evaluation."
    )

    try:
        db.table("estimates").update({
            "status":        "ready",
            "agent_version": "haiku-4-5@v1",
            "agent_notes":   agent_notes,
            "subtotal":      subtotal,
            "tax":           tax,
            "total":         total,
        }).eq("id", req.estimate_id).execute()

        db.table("jobs").update({"status": "estimating"}).eq("id", job_id).execute()
    except Exception as e:
        raise HTTPException(500, f"Failed to update estimate record: {e}")

    # ── 9. Return result ──────────────────────────────────────────────────────
    line_items = (db.table("estimate_line_items").select("*")
                  .eq("estimate_id", req.estimate_id)
                  .order("sort_order").execute().data or [])

    return {
        "estimate_id":   req.estimate_id,
        "job_id":        job_id,
        "status":        "ready",
        "subtotal":      subtotal,
        "tax":           tax,
        "total":         total,
        "subtotal_labor":  subtotal_labor,
        "subtotal_parts":  subtotal_parts,
        "subtotal_fees":   subtotal_fees,
        "line_items":    line_items,
        "items_count":   len(rows_to_insert),
        "agent_version": "haiku-4-5@v1",
        "agent_notes":   agent_notes,
    }


    }


# ==========================================
# 6. PURCHASE ORDERS
# ==========================================

@app.post("/api/jobs/{job_id}/generate-pos")
async def generate_pos(job_id: str):
    """
    Auto-generates Purchase Orders (POs) for approved VENDOR parts.
    """
    from ai_router import _supabase
    import datetime
    db = _supabase()

    # 1. Load estimate_line_items where auth_status='approved' and source='VENDOR'
    res = db.table("estimate_line_items").select("*").eq("job_id", job_id).eq("auth_status", "approved").eq("item_type", "PART").eq("source", "VENDOR").execute()
    vendor_parts = res.data or []

    if not vendor_parts:
        # If no vendor parts, just update job status to in_repair
        try:
            db.table("jobs").update({"status": "in_repair"}).eq("id", job_id).execute()
        except:
            pass
        return {"status": "success", "message": "No vendor parts to order.", "purchase_orders": []}

    # Group by supplier
    by_supplier = {}
    for part in vendor_parts:
        sup = part.get("supplier") or "Unknown Vendor"
        if sup not in by_supplier:
            by_supplier[sup] = []
        by_supplier[sup].append(part)

    pos_created = []
    now = datetime.datetime.utcnow().isoformat()
    
    shop_id = vendor_parts[0]["shop_id"]

    for supplier, parts in by_supplier.items():
        po_record = {
            "job_id": job_id,
            "shop_id": shop_id,
            "vendor": supplier,
            "parts": parts,
            "status": "ORDERED"
        }
        try:
            inserted = db.table("purchase_orders").insert(po_record).execute()
            if inserted.data:
                pos_created.append(inserted.data[0])
        except Exception as e:
            raise HTTPException(500, f"Failed to create PO for {supplier}: {str(e)}")

    # Update job status
    try:
        db.table("jobs").update({"status": "in_repair"}).eq("id", job_id).execute()
    except Exception as e:
        pass

    return {"status": "success", "purchase_orders": pos_created}


# ==========================================
# 7. QUICKBOOKS ENDPOINTS
# ==========================================

@app.get("/api/qbo/auth-url")
async def qbo_auth_url():
    """Returns the Intuit OAuth2 authorization URL for the frontend to open as a popup."""
    if not QBO_CLIENT_ID:
        raise HTTPException(status_code=500, detail="QBO_CLIENT_ID not set in .env file. See setup instructions.")

    state = secrets.token_urlsafe(16)
    _oauth_states[state] = True

    params = (
        f"?client_id={QBO_CLIENT_ID}"
        f"&redirect_uri={QBO_REDIRECT_URI}"
        f"&response_type=code"
        f"&scope={QBO_SCOPE}"
        f"&state={state}"
    )
    return {"url": QBO_AUTH_BASE + params}


@app.get("/api/qbo/callback")
async def qbo_callback(code: str = Query(...), state: str = Query(...), realmId: str = Query(...)):
    """
    Intuit redirects here after the user approves. Exchanges the auth code for tokens,
    then closes the popup with a self-closing HTML page.
    """
    global qbo_tokens

    if state not in _oauth_states:
        return HTMLResponse("<h2>Invalid state. Please try connecting again.</h2>", status_code=400)
    del _oauth_states[state]

    credentials = base64.b64encode(f"{QBO_CLIENT_ID}:{QBO_CLIENT_SECRET}".encode()).decode()

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            QBO_TOKEN_URL,
            headers={
                "Authorization": f"Basic {credentials}",
                "Accept": "application/json",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": QBO_REDIRECT_URI,
            },
        )

    if resp.status_code != 200:
        return HTMLResponse(f"<h2>Token exchange failed: {resp.text}</h2>", status_code=500)

    token_data = resp.json()

    # Fetch company name from QBO
    company_name = ""
    try:
        async with httpx.AsyncClient() as client:
            info_resp = await client.get(
                f"{QBO_API_BASE}/{realmId}/companyinfo/{realmId}?minorversion=65",
                headers={
                    "Authorization": f"Bearer {token_data['access_token']}",
                    "Accept": "application/json",
                },
            )
        if info_resp.status_code == 200:
            company_name = info_resp.json().get("CompanyInfo", {}).get("CompanyName", "")
    except Exception:
        pass

    qbo_tokens = {
        "access_token":  token_data["access_token"],
        "refresh_token": token_data.get("refresh_token", ""),
        "realm_id":      realmId,
        "company_name":  company_name,
        "connected":     True,
    }
    save_qbo_tokens()

    # Self-closing popup — the frontend polls /api/qbo/status to detect success
    return HTMLResponse("""
        <html><body style="font-family:sans-serif;background:#000;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
          <div style="text-align:center">
            <h2 style="color:#10b981">QuickBooks Connected!</h2>
            <p style="color:#64748b">This window will close automatically...</p>
          </div>
          <script>setTimeout(() => window.close(), 1500);</script>
        </body></html>
    """)


@app.get("/api/qbo/status")
async def qbo_status():
    """Frontend polls this to confirm OAuth completed and tokens are stored."""
    load_qbo_tokens()
    if not qbo_tokens.get("connected"):
        return {"connected": False}
    return {
        "connected":   True,
        "realmId":     qbo_tokens.get("realm_id"),
        "companyName": qbo_tokens.get("company_name"),
    }


@app.post("/api/qbo/disconnect")
async def qbo_disconnect():
    global qbo_tokens
    qbo_tokens = {}
    save_qbo_tokens()
    return {"status": "disconnected"}


async def _refresh_qbo_token():
    """Silently refreshes the access token using the stored refresh token."""
    global qbo_tokens
    credentials = base64.b64encode(f"{QBO_CLIENT_ID}:{QBO_CLIENT_SECRET}".encode()).decode()
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            QBO_TOKEN_URL,
            headers={
                "Authorization": f"Basic {credentials}",
                "Accept": "application/json",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            data={
                "grant_type": "refresh_token",
                "refresh_token": qbo_tokens["refresh_token"],
            },
        )
    if resp.status_code == 200:
        data = resp.json()
        qbo_tokens["access_token"]  = data["access_token"]
        qbo_tokens["refresh_token"] = data.get("refresh_token", qbo_tokens["refresh_token"])
        save_qbo_tokens()
        return True
    return False


async def _qbo_get(path: str):
    """Authenticated GET to QBO API with one automatic token refresh on 401."""
    load_qbo_tokens()
    if not qbo_tokens.get("connected"):
        raise HTTPException(status_code=401, detail="QuickBooks not connected.")

    realm  = qbo_tokens["realm_id"]
    url    = f"{QBO_API_BASE}/{realm}/{path}&minorversion=65"
    headers = {"Authorization": f"Bearer {qbo_tokens['access_token']}", "Accept": "application/json"}

    async with httpx.AsyncClient() as client:
        resp = await client.get(url, headers=headers)

    if resp.status_code == 401:
        refreshed = await _refresh_qbo_token()
        if refreshed:
            headers["Authorization"] = f"Bearer {qbo_tokens['access_token']}"
            async with httpx.AsyncClient() as client:
                resp = await client.get(url, headers=headers)

    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail=f"QBO API error: {resp.text}")

    return resp.json()


@app.get("/api/qbo/customers")
async def qbo_get_customers():
    """Pulls all active customers from QuickBooks Online."""
    data = await _qbo_get("query?query=select * from Customer where Active = true MAXRESULTS 500")
    customers = data.get("QueryResponse", {}).get("Customer", [])
    return {"customers": customers, "count": len(customers)}


@app.get("/api/qbo/invoices")
async def qbo_get_invoices(days: int = Query(90, ge=1, le=365)):
    """Pulls invoices created within the last N days from QuickBooks Online."""
    from datetime import datetime, timedelta
    since = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d")
    data = await _qbo_get(f"query?query=select * from Invoice where TxnDate >= '{since}' MAXRESULTS 500")
    invoices = data.get("QueryResponse", {}).get("Invoice", [])
    return {"invoices": invoices, "count": len(invoices)}


@app.post("/api/qbo/invoice")
async def qbo_push_invoice(payload: dict):
    """Pushes a completed CAI work order as a new Invoice to QuickBooks Online."""
    load_qbo_tokens()
    if not qbo_tokens.get("connected"):
        raise HTTPException(status_code=401, detail="QuickBooks not connected.")

    realm   = qbo_tokens["realm_id"]
    url     = f"{QBO_API_BASE}/{realm}/invoice?minorversion=65"
    headers = {
        "Authorization": f"Bearer {qbo_tokens['access_token']}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(url, headers=headers, json=payload)

    if resp.status_code not in (200, 201):
        raise HTTPException(status_code=resp.status_code, detail=f"QBO push failed: {resp.text}")

    return resp.json()


# ==========================================
# 7. EXECUTION
# ==========================================

if __name__ == "__main__":
    # To run this server:
    # 1. pip install "fastapi[all]"
    # 2. uvicorn shop_estimate:app --host 0.0.0.0 --port 8000 --reload
    print("Starting Ignition OS Smart Estimate Engine...")
    print("Run with: uvicorn shop_estimate:app --host 0.0.0.0 --port 8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)
