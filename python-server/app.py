
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
import asyncio

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
        if request.method == "POST" and request.url.path in ["/orchestrate", "/chat", "/analyze"]:
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
    fitnessProfile: dict | None = None
    forceRegenerate: bool = False


class ChatRequest(BaseModel):
    """Request for chat-based plan interaction"""
    userId: str
    message: str
    currentPlan: dict | None = None
    dailyPlan: dict | None = None
    goal: GoalData | None = None
    masterPlan: dict | None = None
    recentActivities: list | None = None
    preferredDays: list | None = None


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
        
        result = await asyncio.to_thread(
            run_orchestration,
            user_id=request.userId,
            goal={"type": request.goal.type, "targetDate": request.goal.targetDate, "weeklyTarget": request.goal.weeklyTarget} if request.goal else None,
            master_plan=request.masterPlan,
            weekly_plan=request.weeklyPlan,
            recent_activities=request.recentActivities,
            fitness_profile=request.fitnessProfile,
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
    Enhanced chat with AI coach.
    Detects user intent and returns structured actions.
    """
    try:
        import json as json_lib
        import re

        # Build context
        context_parts = []
        if request.goal:
            context_parts.append(f"Current goal: {request.goal.type or 'Not set'}, target date: {request.goal.targetDate or 'Not set'}, weekly target: {request.goal.weeklyTarget or 'Not set'}km")
        else:
            context_parts.append("No active goal set.")

        if request.dailyPlan:
            rec = request.dailyPlan.get("recommended", {})
            if rec:
                context_parts.append(f"Today's recommended workout: {rec.get('title', 'N/A')} - {rec.get('distance', 'N/A')} at pace {rec.get('targetPace', 'N/A')}, estimated {rec.get('duration', rec.get('predictedTime', 'N/A'))}")
            opt2 = request.dailyPlan.get("option_2", {})
            if opt2:
                context_parts.append(f"Today's easier option: {opt2.get('title', 'N/A')} - {opt2.get('distance', 'N/A')}")
            opt3 = request.dailyPlan.get("option_3", {})
            if opt3:
                context_parts.append(f"Today's harder option: {opt3.get('title', 'N/A')} - {opt3.get('distance', 'N/A')}")

        if request.currentPlan and isinstance(request.currentPlan, dict) and request.currentPlan.get("days"):
            days_summary = ", ".join([
                f"{d.get('dayName', '?')}: {d.get('title', 'Rest')}" + (f" ({d.get('distance', '')})" if d.get('distance') else "")
                for d in request.currentPlan["days"][:7]
            ])
            context_parts.append(f"This week's plan: {days_summary}")

        if request.recentActivities:
            recent = request.recentActivities[:3]
            activities_str = ", ".join([
                f"{a.get('date', '?')}: {round(a.get('distance', 0)/1000, 1) if isinstance(a.get('distance', 0), (int, float)) else a.get('distance', '?')}km"
                for a in recent
            ])
            context_parts.append(f"Recent activities: {activities_str}")

        today_str = datetime.now().strftime("%Y-%m-%d")
        day_name = datetime.now().strftime("%A")
        context_str = "\n".join(context_parts) if context_parts else "No current training data available."

        prompt = f"""You are a friendly, knowledgeable AI running coach assistant. Today is {day_name}, {today_str}.

USER'S CURRENT STATE:
{context_str}

USER MESSAGE: "{request.message}"

Analyze what the user wants and respond with ONE of these actions as JSON:

1. CREATE GOAL - User wants to set a new training goal
   {{"action": "create_goal", "params": {{"goal_type": "5K|10K|half_marathon|marathon|general", "target_date": "YYYY-MM-DD or null", "weekly_target": number_or_null, "preferred_days": null}}, "message": "your friendly confirmation"}}

2. UPDATE GOAL - User wants to change their existing goal
   {{"action": "update_goal", "params": {{"goal_type": null, "target_date": null, "weekly_target": null, "preferred_days": null}}, "message": "your response"}}
   Only include non-null values for fields the user wants to change.

3. DELETE GOAL - User wants to remove their goal
   {{"action": "delete_goal", "params": {{}}, "message": "your response"}}

4. SKIP WORKOUT - User wants to skip a workout
   {{"action": "skip_workout", "params": {{"date": "{today_str}", "reason": "brief reason"}}, "message": "supportive response about rest"}}

5. SWAP WORKOUTS - User wants to move/rearrange workouts
   {{"action": "swap_workouts", "params": {{"from_date": "day name or YYYY-MM-DD", "to_date": "day name or YYYY-MM-DD"}}, "message": "confirmation of swap"}}

6. ADJUST INTENSITY - User wants easier/harder workout (PREFERRED over adjust_difficulty)
   {{"action": "adjust_intensity", "params": {{"direction": "easier|harder", "percentage": 20-50}}, "message": "what will change"}}

7. GET ESTIMATE - User asks about estimated time/pace/distance
   {{"action": "get_estimate", "params": {{}}, "message": "detailed estimate with pace, time, distance, and tips based on their plan data above"}}

8. WEEKLY SUMMARY - User asks about their week's progress or summary
   {{"action": "weekly_summary", "params": {{}}, "message": "your summary of the week based on the plan data and activities above"}}

9. EXTEND GOAL - User wants to push their goal date back / extend timeline
   {{"action": "extend_goal", "params": {{"weeks": number}}, "message": "confirmation of the extension"}}

10. MODIFY PLAN - General plan change (structural changes to weekly plan)
   {{"action": "modify_plan", "params": {{"day": "day", "change": "description"}}, "message": "your response"}}

11. CHAT - General advice or conversation
   {{"action": "chat", "params": {{}}, "message": "your helpful coaching response"}}

RULES:
- For adjust_intensity: Use this when user says "make it easier", "make it harder", "reduce intensity", "I want a lighter workout" etc.
- For get_estimate: Use the workout data above to calculate and provide specific estimates
- For create_goal: Infer reasonable defaults. If user says "half marathon in June" → goal_type="half_marathon", target_date="2026-06-01", weekly_target=30
- For weekly_summary: Summarize from the plan data and activities provided above
- For extend_goal: If user says "push my goal back 2 weeks" → weeks=2
- If user has no goal and asks about workouts, suggest creating one first
- Be encouraging and coach-like
- Respond with ONLY valid JSON"""

        if not OPENAI_API_KEY:
            return {"error": "API key not configured"}

        headers = {
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json"
        }

        llm_response = await asyncio.to_thread(
            requests.post,
            OPENROUTER_ENDPOINT,
            headers=headers,
            json={
                "model": CHAT_MODEL_NAME,
                "messages": [
                    {"role": "system", "content": "You are an expert running coach. Respond only with valid JSON. No markdown, no code fences, just pure JSON."},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.4,
                "max_tokens": 800
            },
            timeout=30
        )
        llm_response.raise_for_status()
        response_text = llm_response.json()["choices"][0]["message"]["content"]

        # Parse JSON response (handle markdown fences)
        clean_text = response_text.strip()
        if clean_text.startswith("```"):
            clean_text = re.sub(r'^```(?:json)?\s*', '', clean_text)
            clean_text = re.sub(r'\s*```$', '', clean_text)

        json_match = re.search(r'\{.*\}', clean_text, re.DOTALL)
        if not json_match:
            return {"message": response_text, "action": "chat", "planUpdate": False}

        result = json_lib.loads(json_match.group())
        action = result.get("action", "chat")
        params = result.get("params", {})
        message = result.get("message", "I'm here to help!")

        print(f"[Chat] Action detected: {action}, Params: {params}")
        print(f"[LLM-OUTPUT] [chat] model={CHAT_MODEL_NAME} | action={action} | params={params} | messagePreview=\"{message[:100]}\" | rawResponseLen={len(response_text)} | timestamp={datetime.now().isoformat()}")

        # Handle actions that need Python-side processing
        if action == "adjust_intensity":
            # Second LLM call: intelligently adjust today's plan
            direction = params.get("direction", "easier")
            daily_plan_json = json_lib.dumps(request.dailyPlan, indent=2) if request.dailyPlan else "{}"
            
            adjustment_prompt = f"""You are an expert running coach. Adjust this workout plan to make it {direction}.

CURRENT DAILY PLAN (3 options: recommended, option_2=lighter, option_3=challenge):
{daily_plan_json}

DIRECTION: {direction}
USER REQUEST: "{request.message}"

Return ONLY valid JSON with the adjusted plan in this EXACT structure:
{{"recommended": {{"type": "easy|tempo|intervals|long_run|recovery", "title": "descriptive title", "distance": "Xkm", "duration": "Xmin", "targetPace": "Easy|Moderate|Moderate-Hard|Hard", "description": "what the workout involves", "coachTip": "brief encouragement"}}, "option_2": {{"type": "...", "title": "Lighter Version", "distance": "Xkm", "duration": "Xmin", "targetPace": "...", "description": "..."}}, "option_3": {{"type": "...", "title": "Challenge Version", "distance": "Xkm", "duration": "Xmin", "targetPace": "...", "description": "..."}}}}

COACHING RULES:
- For "easier": convert tempo/intervals to easy runs, reduce distance 20-40%, slow the pace, simplify structure
- For "harder": add tempo/interval segments, increase distance 15-30%, set faster pace targets, make structure more challenging
- Keep the 3-option structure (recommended, lighter, challenge)
- All distances as "Xkm", all durations as "Xmin"
- Make changes a real running coach would make — don't just scale numbers"""

            try:
                adjust_headers = {
                    "Authorization": f"Bearer {OPENAI_API_KEY}",
                    "Content-Type": "application/json"
                }
                adjust_response = await asyncio.to_thread(
                    requests.post,
                    OPENROUTER_ENDPOINT,
                    headers=adjust_headers,
                    json={
                        "model": CHAT_MODEL_NAME,
                        "messages": [
                            {"role": "system", "content": "You are an expert running coach. Respond only with valid JSON. No markdown, no code fences, just pure JSON."},
                            {"role": "user", "content": adjustment_prompt}
                        ],
                        "temperature": 0.3,
                        "max_tokens": 800
                    },
                    timeout=30
                )
                adjust_response.raise_for_status()
                adjust_text = adjust_response.json()["choices"][0]["message"]["content"].strip()
                
                # Parse JSON (handle markdown fences)
                if adjust_text.startswith("```"):
                    adjust_text = re.sub(r'^```(?:json)?\s*', '', adjust_text)
                    adjust_text = re.sub(r'\s*```$', '', adjust_text)
                
                adjust_json_match = re.search(r'\{.*\}', adjust_text, re.DOTALL)
                if adjust_json_match:
                    adjusted_plan = json_lib.loads(adjust_json_match.group())
                    # Validate it has the expected structure
                    if "recommended" in adjusted_plan:
                        print(f"[Chat] LLM-adjusted intensity ({direction}): {json_lib.dumps(adjusted_plan)[:200]}...")
                        return {
                            "message": message,
                            "action": "adjust_intensity",
                            "params": params,
                            "planUpdate": True,
                            "updatedPlan": {"dailyPlan": adjusted_plan}
                        }
                
                print(f"[Chat] LLM intensity adjustment returned invalid structure, falling back to programmatic")
            except Exception as e:
                print(f"[Chat] LLM intensity adjustment failed: {e}, falling back to programmatic")
            
            # Fallback: return action for backend programmatic handling
            return {
                "message": message,
                "action": "adjust_intensity",
                "params": params,
                "planUpdate": True,
                "updatedPlan": None
            }

        elif action == "modify_plan":
            try:
                from langgraph_agents import modify_plan_from_chat
                updated_plan = modify_plan_from_chat(
                    user_id=request.userId,
                    modification={
                        "day": params.get("day", "today"),
                        "description": params.get("change", request.message)
                    },
                    current_state={
                        "goal": {"type": request.goal.type, "weeklyTarget": request.goal.weeklyTarget} if request.goal else None,
                        "master_plan": request.masterPlan,
                        "weekly_plan": request.currentPlan
                    }
                )
                return {
                    "message": message,
                    "action": "modify_plan",
                    "params": params,
                    "planUpdate": True,
                    "updatedPlan": updated_plan
                }
            except Exception as e:
                print(f"[Chat] modify_plan_from_chat failed: {e}")
                return {
                    "message": f"{message}\n\n(Note: Plan modification is temporarily limited. Your request has been noted.)",
                    "action": "modify_plan",
                    "params": params,
                    "planUpdate": False,
                    "updatedPlan": None
                }

        else:
            # All other actions are handled by the Node.js backend:
            # create_goal, update_goal, delete_goal, skip_workout, swap_workouts,
            # adjust_intensity, adjust_difficulty, weekly_summary, extend_goal,
            # get_estimate, chat
            return {
                "message": message,
                "action": action,
                "params": params,
                "planUpdate": action in ["skip_workout", "swap_workouts", "adjust_intensity", "adjust_difficulty"],
                "updatedPlan": None
            }

    except json_lib.JSONDecodeError as e:
        print(f"[Chat] JSON parse error: {e}")
        return {"message": "I had trouble understanding. Could you rephrase that?", "action": "chat", "planUpdate": False}
    except Exception as e:
        print(f"[Chat] Error: {e}")
        import traceback
        traceback.print_exc()
        return {"message": "I'm having trouble right now. Let's try again.", "action": "chat", "planUpdate": False}


# =============================================================================
# ACTIVITY ANALYSIS (kept for compatibility)
# =============================================================================

@app.post("/analyze")
async def analyze_activity(request: dict):
    """Generate AI coaching summary for a running activity."""
    try:
        # Handle both { activityData: {...} } and direct activity object
        activity = request.get("activityData", request)
        
        # Extract fields flexibly from Strava activity format
        activity_id = str(activity.get("id", "unknown"))
        name = activity.get("name", activity.get("title", "Running Activity"))
        date = activity.get("start_date", activity.get("date", "unknown"))
        distance_m = activity.get("distance", 0)
        distance_km = round(distance_m / 1000, 2) if isinstance(distance_m, (int, float)) else distance_m
        moving_time = activity.get("moving_time", 0)
        duration = f"{moving_time // 60}:{moving_time % 60:02d}" if isinstance(moving_time, (int, float)) else activity.get("duration", "unknown")
        avg_speed = activity.get("average_speed", 0)
        pace = f"{round(16.6667 / avg_speed, 2) if avg_speed else 0} min/km" if isinstance(avg_speed, (int, float)) and avg_speed > 0 else activity.get("pace", "unknown")
        hr = activity.get("average_heartrate", activity.get("heartRate", "unknown"))
        elevation = activity.get("total_elevation_gain", activity.get("elevation", 0))
        activity_type = activity.get("type", activity.get("sport_type", "Run"))
        
        prompt = f"""Analyze this running activity and provide expert coaching feedback.

Activity: {name}
- Date: {date}
- Distance: {distance_km} km
- Duration: {duration}
- Pace: {pace}
- Heart Rate: {hr} bpm
- Elevation: {elevation} m
- Type: {activity_type}

Respond with JSON containing:
{{"runType": "descriptive name for this run type", "summary": "2-3 sentence performance summary", "highlight": "what went well", "suggestion": "one actionable improvement", "relativeEffort": "low/moderate/high"}}"""

        if not OPENAI_API_KEY:
            print("[Analyze] ERROR: OPENAI_API_KEY is not set!")
            return {
                "activityId": activity_id,
                "text": "Analysis temporarily unavailable - API key not configured.",
                "generatedAt": datetime.utcnow().isoformat(),
                "model": MODEL_NAME,
                "status": "error"
            }

        headers = {
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json"
        }

        response = requests.post(
            OPENROUTER_ENDPOINT,
            headers=headers,
            json={
                "model": MODEL_NAME,
                "messages": [
                    {"role": "system", "content": "You are an expert running coach. Respond only with valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.7,
                "max_tokens": 500
            },
            timeout=30
        )
        response.raise_for_status()
        analysis = response.json()["choices"][0]["message"]["content"]
        
        print(f"[LLM-OUTPUT] [analyze] activityId={activity_id} | model={MODEL_NAME} | analysisPreview=\"{analysis[:120]}\" | timestamp={datetime.now().isoformat()}")
        
        return {
            "activityId": activity_id,
            "text": analysis,
            "generatedAt": datetime.utcnow().isoformat(),
            "model": MODEL_NAME,
            "status": "success"
        }
        
    except Exception as e:
        print(f"[Analyze] Error: {e}")
        return {
            "activityId": request.get("activityData", request).get("id", "unknown"),
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
