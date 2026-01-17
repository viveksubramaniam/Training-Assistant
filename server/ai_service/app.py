
"""AI Running Coach Service - Simplified LangGraph Architecture

This service provides two main entry points:
1. /orchestrate - Main LangGraph orchestration for plan generation
2. /chat - Chat interface that can modify plans through orchestrator
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from dotenv import load_dotenv
from datetime import datetime
import requests

# Load environment variables
load_dotenv()

app = FastAPI(
    title="AI Running Coach Service",
    description="LangGraph-based AI coaching for running",
    version="2.0.0"
)

# Add validation error handler to see exact Pydantic errors
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    print(f"\n{'='*60}")
    print(f"[VALIDATION ERROR] {request.method} {request.url.path}")
    print(f"[VALIDATION ERROR] Errors:")
    for error in exc.errors():
        print(f"  - loc: {error['loc']}")
        print(f"    msg: {error['msg']}")
        print(f"    type: {error['type']}")
    print(f"{'='*60}\n")
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()}
    )

# CORS configuration
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
LLM_ENDPOINT = os.getenv("LLM_ENDPOINT", "http://localhost:1234/v1/chat/completions")
MODEL_NAME = os.getenv("MODEL_NAME", "local-model")
CHAT_MODEL_NAME = os.getenv("CHAT_MODEL_NAME", MODEL_NAME)  # Defaults to MODEL_NAME if not set
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")  # For OpenRouter
OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions"
PORT = int(os.getenv("PORT", "5001"))


# =============================================================================
# REQUEST LOGGING MIDDLEWARE (for debugging 422 errors)
# =============================================================================

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
import json

class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Only log POST requests to our endpoints
        if request.method == "POST" and request.url.path in ["/orchestrate", "/chat"]:
            body = await request.body()
            print(f"\n{'='*60}")
            print(f"[RAW REQUEST] {request.method} {request.url.path}")
            print(f"[RAW REQUEST] Content-Type: {request.headers.get('content-type')}")
            try:
                body_json = json.loads(body)
                print(f"[RAW REQUEST] Body (parsed):")
                for key, value in body_json.items():
                    if isinstance(value, dict):
                        print(f"  {key}: {value}")
                    elif isinstance(value, str) and len(str(value)) > 100:
                        print(f"  {key}: {str(value)[:100]}...")
                    else:
                        print(f"  {key}: {value}")
            except:
                print(f"[RAW REQUEST] Body (raw): {body[:500]}")
            print(f"{'='*60}\n")
        
        response = await call_next(request)
        return response

app.add_middleware(RequestLoggingMiddleware)


# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================

class GoalData(BaseModel):
    """User goal data"""
    type: str | None = None
    targetDate: str | None = None
    weeklyTarget: float | None = None


class OrchestrationRequest(BaseModel):
    """Request for plan orchestration via LangGraph"""
    userId: str
    goal: GoalData | None = None
    masterPlan: dict | None = None
    weeklyPlan: dict | None = None
    recentActivities: list | None = None
    forceRegenerate: bool = False


class ChatRequest(BaseModel):
    """Request for chat-based plan interaction"""
    userId: str
    message: str
    currentPlan: dict | None = None
    goal: GoalData | None = None
    masterPlan: dict | None = None


class ActivityData(BaseModel):
    """Activity data for analysis"""
    id: str
    date: str
    distance: str
    duration: str
    pace: str
    heartRate: str | int
    elevation: str | int
    type: str
    raw: dict | None = None
    title: str | None = None


# =============================================================================
# HEALTH CHECK
# =============================================================================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "ai-coach",
        "version": "2.0.0",
        "timestamp": datetime.utcnow().isoformat()
    }


# =============================================================================
# MAIN ORCHESTRATION ENDPOINT
# =============================================================================

@app.post("/orchestrate")
async def orchestrate_plans(request: OrchestrationRequest):
    """
    Main LangGraph orchestration endpoint.
    
    Flow: orchestrator → master_planning_agent → weekly_planner → daily_planner
    
    The orchestrator LLM analyzes state and decides which agent to invoke.
    Agents cascade: master → weekly → daily
    """
    try:
        from langgraph_agents import orchestrate_plans as run_orchestration
        
        result = run_orchestration(
            user_id=request.userId,
            goal={"type": request.goal.type, "targetDate": request.goal.targetDate, "weeklyTarget": request.goal.weeklyTarget} if request.goal else None,
            master_plan=request.masterPlan,
            weekly_plan=request.weeklyPlan,
            recent_activities=request.recentActivities,
            force_regenerate=request.forceRegenerate
        )
        
        return result
        
    except ImportError as e:
        print(f"LangGraph not available: {e}")
        return {"error": "LangGraph not installed", "details": str(e)}
    except Exception as e:
        print(f"Orchestration error: {e}")
        return {"error": str(e)}


# =============================================================================
# CHAT ENDPOINT (with plan modification capability)
# =============================================================================

@app.post("/chat")
async def chat_with_coach(request: ChatRequest):
    """
    Chat with the AI coach.
    
    Single LLM call that:
    1. Analyzes if user wants to modify their plan
    2. Returns either a plan update OR a chat response
    """
    try:
        import json as json_lib
        import re
        
        prompt = f"""You are a friendly running coach assistant.

USER MESSAGE: "{request.message}"

Analyze what the user wants and respond appropriately.

OPTION A - If user wants to MODIFY their training plan (e.g., "make today easier", "swap workouts", "I'm too tired", "change Wednesday"):
Respond with JSON:
{{"action": "modify_plan", "day": "the day to modify or 'today'", "change": "what change they want", "response": "brief acknowledgement"}}

OPTION B - If user just wants to chat, ask a question, or get advice:
Respond with JSON:
{{"action": "chat", "response": "your helpful coaching response here"}}

Respond with ONLY valid JSON, no other text."""


        # Use OpenRouter for chat agent
        if not OPENAI_API_KEY:
            print("[Chat] ERROR: OPENAI_API_KEY is not set!")
            return {"error": "OpenRouter API key not configured"}
        
        print(f"[Chat] Using OpenRouter with model: {CHAT_MODEL_NAME}")
        print(f"[Chat] API Key present: {bool(OPENAI_API_KEY)} (length: {len(OPENAI_API_KEY) if OPENAI_API_KEY else 0})")
        
        headers = {
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json"
        }
        
        llm_response = requests.post(
            OPENROUTER_ENDPOINT,
            headers=headers,
            json={
                "model": CHAT_MODEL_NAME,
                "messages": [
                    {"role": "system", "content": "You are a running coach. Respond only with JSON."},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.5,
                "max_tokens": 500
            },
            timeout=30
        )
        llm_response.raise_for_status()
        response_text = llm_response.json()["choices"][0]["message"]["content"]
        
        # Parse JSON response
        json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
        if not json_match:
            return {"message": response_text, "planUpdate": False}
        
        result = json_lib.loads(json_match.group())
        
        if result.get("action") == "modify_plan":
            # Route through orchestrator for plan modification
            from langgraph_agents import modify_plan_from_chat
            
            updated_plan = modify_plan_from_chat(
                user_id=request.userId,
                modification={
                    "day": result.get("day", "today"),
                    "description": result.get("change", request.message)
                },
                current_state={
                    "goal": {"type": request.goal.type, "weeklyTarget": request.goal.weeklyTarget} if request.goal else None,
                    "master_plan": request.masterPlan,
                    "weekly_plan": request.currentPlan
                }
            )
            
            return {
                "message": result.get("response", "I've updated your plan."),
                "planUpdate": True,
                "updatedPlan": updated_plan
            }
        else:
            # Regular chat response
            return {
                "message": result.get("response", "I'm here to help!"),
                "planUpdate": False
            }
        
    except ImportError as e:
        return {"message": "Chat service initializing...", "planUpdate": False}
    except Exception as e:
        print(f"Chat error: {e}")
        return {"message": "I'm having trouble right now. Let's try again.", "planUpdate": False}


# =============================================================================
# ACTIVITY ANALYSIS (kept for compatibility)
# =============================================================================

@app.post("/analyze")
async def analyze_activity(activity: ActivityData):
    """Generate AI coaching summary for a running activity."""
    try:
        prompt = f"""Analyze this running activity and provide expert coaching feedback.

Activity: {activity.title or 'Running Activity'}
- Date: {activity.date}
- Distance: {activity.distance} km
- Duration: {activity.duration}
- Pace: {activity.pace} /km
- Heart Rate: {activity.heartRate} bpm
- Elevation: {activity.elevation} m
- Type: {activity.type}

Provide a brief, encouraging analysis focusing on:
1. Performance summary
2. What went well
3. One area to improve
4. Recovery recommendations"""

        response = requests.post(
            LLM_ENDPOINT,
            json={
                "model": MODEL_NAME,
                "messages": [
                    {"role": "system", "content": "You are an expert running coach."},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.7,
                "max_tokens": 500
            },
            timeout=30
        )
        response.raise_for_status()
        analysis = response.json()["choices"][0]["message"]["content"]
        
        return {
            "activityId": activity.id,
            "text": analysis,
            "generatedAt": datetime.utcnow().isoformat(),
            "model": MODEL_NAME,
            "status": "success"
        }
        
    except Exception as e:
        return {
            "activityId": activity.id,
            "text": "Analysis temporarily unavailable.",
            "generatedAt": datetime.utcnow().isoformat(),
            "model": MODEL_NAME,
            "status": "error"
        }


# =============================================================================
# MAIN
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
