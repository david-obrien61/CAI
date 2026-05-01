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
from ai_router import ai_router
app.include_router(ai_router)

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
# 5. QUICKBOOKS ENDPOINTS
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
# 6. EXECUTION
# ==========================================

if __name__ == "__main__":
    # To run this server:
    # 1. pip install "fastapi[all]"
    # 2. uvicorn shop_estimate:app --host 0.0.0.0 --port 8000 --reload
    print("Starting Ignition OS Smart Estimate Engine...")
    print("Run with: uvicorn shop_estimate:app --host 0.0.0.0 --port 8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)
