import time
from typing import List, Tuple
from pydantic import BaseModel, Field

# ==========================================
# 0. PYDANTIC MODELS (Strict Data Shapes)
# ==========================================

class ParsedTechNote(BaseModel):
    part: str = Field(description="The generic name of the requested part")
    vehicle: str = Field(description="Target vehicle details including Year/Make/Model")

class VendorQuote(BaseModel):
    vendor: str
    part_no: str
    cost: float = Field(gt=0, description="Wholesale cost explicitly asserted to be > 0")
    stock: str 
    eta_hours: int

class ProcessedEstimate(VendorQuote):
    retail: float
    profit: float

# ==========================================
# 1. CONFIGURATION: SHOP PRICE MATRIX
# ==========================================
# Rules: Wholesale Cost Range -> % Markup
PRICE_MATRIX = [
    {"max_cost": 50, "markup": 1.0},    # 100% markup on small items (nuts/bolts/filters)
    {"max_cost": 200, "markup": 0.6},   # 60% markup
    {"max_cost": 1000, "markup": 0.4},  # 40% markup
    {"max_cost": 10000, "markup": 0.25} # 25% markup on big ticket items (transmissions)
]

# ==========================================
# 2. VENDOR DATA (Simulating Live API Feeds)
# ==========================================
def get_live_vendor_inventory(part_name: str, vehicle: str) -> List[VendorQuote]:
    """
    In production, this calls APIs like PartsTech, Nexpart, or FleetPride.
    """
    return [
        VendorQuote(vendor="NAPA", part_no="ALT-9921", cost=185.00, stock="Local", eta_hours=2),
        VendorQuote(vendor="AutoZone", part_no="AZ-882", cost=192.50, stock="Local", eta_hours=1),
        VendorQuote(vendor="DieselSpecialist", part_no="DS-X10", cost=160.00, stock="Warehouse", eta_hours=24)
    ]

# ==========================================
# 3. LOGIC ENGINES
# ==========================================

def calculate_retail_price(cost: float) -> float:
    """Applies the Shop's Markup Matrix to the wholesale cost."""
    for tier in PRICE_MATRIX:
        if cost <= tier["max_cost"]:
            return round(cost * (1 + tier["markup"]), 2)
    return round(cost * 1.2, 2) # Default 20% for extreme cases

def parse_tech_note(note: str) -> ParsedTechNote:
    """
    Simulating an AI extraction (e.g., Gemini API).
    Input: "Need an alternator for a 2018 Ram 3500"
    """
    # Real AI call: response = llm.extract(note, schema=ParsedTechNote)
    return ParsedTechNote(part="Alternator", vehicle="2018 Ram 3500 Cummins")

# ==========================================
# 4. THE HYBRID WORKFLOW
# ==========================================

def build_smart_estimate(tech_voice_note: str) -> Tuple[ProcessedEstimate, List[ProcessedEstimate]]:
    print(f"--- Processing Note: '{tech_voice_note}' ---")
    
    # Step 1: AI Understands the need through a validated model
    extracted: ParsedTechNote = parse_tech_note(tech_voice_note)
    
    # Step 2: Fetch Live Quotes as structured VendorQuote data models
    quotes: List[VendorQuote] = get_live_vendor_inventory(extracted.part, extracted.vehicle)
    
    processed_options: List[ProcessedEstimate] = []
    for q in quotes:
        retail = calculate_retail_price(q.cost)
        profit = round(retail - q.cost, 2)
        
        # Injecting the results into the stricter ProcessedEstimate model
        processed_options.append(
            ProcessedEstimate(
                vendor=q.vendor,
                part_no=q.part_no,
                cost=q.cost,
                stock=q.stock,
                eta_hours=q.eta_hours,
                retail=retail,
                profit=profit
            )
        )

    # Step 3: Recommend the "Best Fit" (Balance of Price vs Speed)
    # We prefer 'Local' stock and then the highest profit. Note that we use .stock instead of ['stock']
    recommendation = sorted(processed_options, key=lambda x: (x.stock != 'Local', -x.profit))[0]
    
    return recommendation, processed_options

def execute_order(recommendation: ProcessedEstimate) -> None:
    """Called only when customer clicks 'APPROVE'"""
    print(f"\n[ACTION] Ordering Part {recommendation.vendor}...")
    time.sleep(1)
    print(f"[SUCCESS] Purchase Order #TX-99281 sent to {recommendation.vendor}.")
    print(f"[LOG] Profit of ${recommendation.profit} locked in.")

# ==========================================
# 5. EXECUTION EXAMPLE
# ==========================================

if __name__ == "__main__":
    # A. Technician speaks into the tablet:
    note = "The 2018 Ram 3500 needs a new alternator, current one is seized."

    # B. AI builds the internal data (Happens BEFORE estimate is sent)
    best_option, all_options = build_smart_estimate(note)

    print("\n--- AI Sourcing Results (Internal View) ---")
    for opt in all_options:
        # Note the change from dictionary syntax opt['vendor'] to property syntax opt.vendor
        print(f"Vendor: {opt.vendor} | Retail: ${opt.retail} | ETA: {opt.eta_hours}hrs | Profit: ${opt.profit}")

    print(f"\nAI RECOMMENDED VENDOR: {best_option.vendor} (Highest profit + Local stock)")

    # C. Customer approves the estimate (Simulated)
    customer_approved = True 

    if customer_approved:
        execute_order(best_option)
