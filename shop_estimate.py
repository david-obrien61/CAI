import time
import tempfile
from google import genai
from google.genai import types
from typing import List, Dict
from pydantic import BaseModel, Field
from fastapi import FastAPI, UploadFile, File
import uvicorn
from fastapi.middleware.cors import CORSMiddleware
import json
import os
from dotenv import load_dotenv

# Load environment variables from the .env file
load_dotenv()

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
# 3. LOGIC ENGINE (AI SIMULATION)
# ==========================================


# ==========================================
# 4. API ENDPOINTS
# ==========================================

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
        
        # Clean up the file from Google's servers
        client.files.delete(name=audio_file.name)

        # 4. Parse JSON and return to mobile app
        result = json.loads(response.text)
        return TranscriptionResponse(**result)

    finally:
        # Clean up local temp file
        if os.path.exists(temp_audio_path):
            os.remove(temp_audio_path)

# ==========================================
# 4. EXECUTION
# ==========================================

if __name__ == "__main__":
    # To run this server:
    # 1. pip install "fastapi[all]"
    # 2. uvicorn shop_estimate:app --host 0.0.0.0 --port 8000 --reload
    print("Starting Ignition OS Smart Estimate Engine...")
    print("Run with: uvicorn shop_estimate:app --host 0.0.0.0 --port 8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)
