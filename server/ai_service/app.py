from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests
import os
from dotenv import load_dotenv
from datetime import datetime

# Load environment variables
load_dotenv()

app = FastAPI(
    title="AI Running Coach Service",
    description="AI-powered coaching summaries for running activities",
    version="1.0.0"
)

# CORS configuration for mobile and web clients
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
PORT = int(os.getenv("PORT", "5001"))


class ActivityData(BaseModel):
    """Activity data model for analysis"""
    id: str
    date: str
    distance: str
    duration: str
    pace: str
    heartRate: str | int
    elevation: str | int
    type: str
    raw: dict | None = None
    # Enhanced fields
    title: str | None = None
    hrZonePercentages: list | None = None
    paceZones: dict | None = None
    movingTime: int | None = None
    sufferScore: int | None = None
    averageCadence: float | None = None
    maxHeartrate: int | None = None


class AnalysisResponse(BaseModel):
    """AI analysis response model"""
    activityId: str
    text: str
    generatedAt: str
    model: str
    status: str


@app.get("/health")
async def health_check():
    """Health check endpoint for container orchestration"""
    return {
        "status": "healthy",
        "service": "ai-coach",
        "timestamp": datetime.utcnow().isoformat()
    }


@app.post("/analyze", response_model=AnalysisResponse)
async def analyze_activity(activity: ActivityData):
    """
    Generate AI coaching summary for a running activity.
    
    This endpoint is designed to be easily extended with LangChain.
    Future enhancements:
    - Add LangChain chains for more sophisticated analysis
    - Implement memory for personalized coaching
    - Add retrieval-augmented generation (RAG) for training plans
    """
    
    try:
        # Build the coaching prompt for JSON response
        prompt = f"""Analyze this running activity and provide expert coaching feedback in JSON format.

Activity: {activity.title or 'Running Activity'}

Basic Metrics:
- Date: {activity.date}
- Distance: {activity.distance} km
- Duration: {activity.duration}
- Pace: {activity.pace} /km
- Avg HR: {activity.heartRate} bpm
- Max HR: {activity.maxHeartrate or 'N/A'} bpm
- Elevation: {activity.elevation} m
- Type: {activity.type}
"""
        
        # Add HR zone distribution
        if activity.hrZonePercentages:
            prompt += "\nHeart Rate Zone Distribution:\n"
            for i, zone in enumerate(activity.hrZonePercentages, 1):
                prompt += f"- Zone {i} (up to {zone['zone']} bpm): {zone['percentage']}% of time\n"
        
        # Add pace zones
        if activity.paceZones:
            prompt += f"\nPace Distribution:\n"
            prompt += f"- Easy pace: {activity.paceZones.get('easy', 0)}%\n"
            prompt += f"- Moderate pace: {activity.paceZones.get('moderate', 0)}%\n"
            prompt += f"- Tempo pace: {activity.paceZones.get('tempo', 0)}%\n"
        
        # Add training load indicators
        if activity.sufferScore:
            prompt += f"\nTraining Load:\n"
            prompt += f"- Suffer Score: {activity.sufferScore} (Strava's relative effort metric)\n"
            
            # Simple ATL/CTL context (can be enhanced with historical data)
            if activity.sufferScore < 50:
                training_load = "Low intensity recovery run"
            elif activity.sufferScore < 100:
                training_load = "Moderate training stimulus"
            elif activity.sufferScore < 150:
                training_load = "High training load - significant stimulus"
            else:
                training_load = "Very high training load - potential overreaching"
            prompt += f"- Training Load Context: {training_load}\n"
        
        if activity.averageCadence:
            prompt += f"- Cadence: {activity.averageCadence} spm\n"
        
        # Add optional fields if available
        if activity.raw:
            if activity.raw.get('average_temp'):
                prompt += f"- Temperature: {activity.raw['average_temp']}°C\n"
        
        prompt += """
IMPORTANT INSTRUCTION: You MUST use Average Heart Rate (Avg HR) to classify the activity. The "intensity_label" field MUST match the classification below based on Avg HR:

1. TEMPO: If Avg HR > 150 -> intensity_label="Tempo" (or "Intense" if very high).
2. RECOVERY: If Avg HR > 120 AND Avg HR < 150 -> intensity_label="Recovery".
3. EASY: If Avg HR < 120 -> intensity_label="Easy".
4. LONG RUN: If Distance > 8km -> intensity_label="Long Run" (Override HR rule if valid).
5. MAX EFFORT: If Suffer Score > 150 -> intensity_label="Max Effort".

CRITICAL: You are strictly PROHIBITED from using labels like "Low Aerobic", "High Aerobic", "Anaerobic". You MUST use ONLY: Easy, Recovery, Tempo, Intense, Long Run, Max Effort.

Based on this comprehensive data, respond with ONLY a valid JSON object (no markdown, no code blocks) with these exact fields:
{
  "runType": "string - must match the classification above (e.g., Easy Run, Tempo Run, Long Run, Interval Training)",
  "intensity_label": "string - STRICTLY one of: 'Easy', 'Recovery', 'Tempo', 'Intense', 'Long Run', 'Max Effort'.",
  "relativeEffort": "string - rate as: Low, Moderate, High, or Very High based on HR zones, pace distribution, and suffer score",
  "summary": "string - 2-3 sentence analysis of the performance based on HR zones, pace distribution, and training load. Focus on what the data reveals about effort and execution.",
  "way_forward": "string - next steps on how to improve this form of training. Provide 2-3 actionable bullets or sentences.",
  "highlight": "string - one specific positive aspect based on the metrics (e.g., good HR zone distribution, consistent pacing, appropriate effort level)",
  "suggestion": "string - one data-driven constructive tip for improvement based on the zones and metrics"
}"""
        model_name = os.getenv("MODEL_NAME", "local-model")
        # Call LLM (LM Studio or compatible endpoint)
        llm_response = requests.post(
            LLM_ENDPOINT,
            json={
                "model": model_name,
                "messages": [
                    {"role": "system", "content": "You are a professional running coach with expertise in training zones, periodization, and data-driven coaching. Always respond with valid JSON only, no markdown formatting."},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.7,
                "max_tokens": 600
            },
            timeout=30
        )
        
        llm_response.raise_for_status()
        result = llm_response.json()
        
        analysis_text = result['choices'][0]['message']['content'].strip()
        
        # Try to parse JSON response, fallback to plain text if it fails
        try:
            # Remove markdown code blocks if present
            if analysis_text.startswith('```'):
                analysis_text = analysis_text.split('```')[1]
                if analysis_text.startswith('json'):
                    analysis_text = analysis_text[4:]
                analysis_text = analysis_text.strip()
            
            import json
            analysis_json = json.loads(analysis_text)
            
            # Validate required fields
            # Ensure it is a dictionary
            if isinstance(analysis_json, dict):
                formatted_text = analysis_json
            else:
                formatted_text = {"text": analysis_text}
        except json.JSONDecodeError:
            # If JSON parsing fails, use plain text
            formatted_text = {"text": analysis_text}
        
        
        
        return AnalysisResponse(
            activityId=activity.id,
            text=json.dumps(formatted_text) if isinstance(formatted_text, dict) else formatted_text,
            generatedAt=datetime.utcnow().isoformat(),
            model=model_name,
            status="success"
        )
        
    except requests.exceptions.RequestException as e:
        raise HTTPException(
            status_code=503,
            detail=f"LLM service unavailable: {str(e)}. Is LM Studio running on {LLM_ENDPOINT}?"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed: {str(e)}"
        )


# ============================================================================
# AI COACH ENDPOINTS
# ============================================================================

class GoalData(BaseModel):
    """Goal data for plan generation"""
    type: str
    targetDate: str | None = None
    weeklyTarget: float | None = None

class MasterPlanRequest(BaseModel):
    """Request for master plan generation"""
    goal: GoalData
    preferredDays: list[str] | None = None
    userHistory: dict | None = None

class DailyRecommendationRequest(BaseModel):
    """Request for daily workout recommendation"""
    goal: GoalData
    masterPlan: list | None = None
    recentActivities: list | None = None
    today: str
    preferredDays: list[str] | None = None

class WeeklyPlanRequest(BaseModel):
    """Request for weekly plan generation"""
    goal: GoalData
    masterPlan: list | None = None
    currentWeek: int
    weekStart: str
    preferredDays: list[str] | None = None

class ChatRequest(BaseModel):
    """Request for coach chat"""
    message: str
    history: list | None = None
    currentPlan: dict | None = None


@app.post("/generate-master-plan")
async def generate_master_plan(request: MasterPlanRequest):
    """Generate a full training plan for the goal duration"""
    model_name = os.getenv("MODEL_NAME", "local-model")
    
    # Calculate weeks until target date
    weeks_until_goal = 12  # Default
    if request.goal.targetDate:
        try:
            target = datetime.fromisoformat(request.goal.targetDate)
            today = datetime.now()
            weeks_until_goal = max(4, min(24, (target - today).days // 7))
        except:
            pass
    
    # Build prompt for master plan
    prompt = f"""You are an expert running coach creating a training plan.

GOAL: {request.goal.type}
TARGET DATE: {request.goal.targetDate or 'Flexible'}
WEEKLY TARGET: {request.goal.weeklyTarget or 40} km
PREFERRED WORKOUT DAYS: {', '.join(request.preferredDays or ['Mon', 'Wed', 'Fri', 'Sun'])}
WEEKS AVAILABLE: {weeks_until_goal}

USER HISTORY (last 30 days):
- Average weekly distance: {request.userHistory.get('weekly_avg_distance', 'Unknown') if request.userHistory else 'New runner'} km
- Average HR: {request.userHistory.get('avg_hr', 'Unknown') if request.userHistory else 'Unknown'} bpm
- Longest run: {request.userHistory.get('max_distance', 'Unknown') if request.userHistory else 'Unknown'} km

Create a periodized training plan. Respond with ONLY valid JSON:
{{
  "weeks": [
    {{"week": 1, "theme": "Base Building", "focus": "Easy aerobic runs", "targetKm": 25, "keyWorkout": "Long Run"}},
    ...
  ],
  "totalWeeks": {weeks_until_goal},
  "peakWeek": <week number with highest volume>,
  "taperStart": <week number when taper begins>
}}

Include 3-4 phases: Base Building, Volume/Speed Building, Peak, Taper.
Make sure each week has a clear theme and focus."""

    try:
        llm_response = requests.post(
            LLM_ENDPOINT,
            json={
                "model": model_name,
                "messages": [
                    {"role": "system", "content": "You are an expert running coach. Always respond with valid JSON only."},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.7,
                "max_tokens": 1500
            },
            timeout=60
        )
        llm_response.raise_for_status()
        result = llm_response.json()
        response_text = result['choices'][0]['message']['content'].strip()
        
        # Parse JSON response
        try:
            plan_data = json.loads(response_text)
            return plan_data
        except:
            # Fallback: generate sensible default
            return {
                "weeks": [
                    {"week": i+1, "theme": ["Base Building", "Volume Build", "Speed Work", "Peak", "Taper"][min(i//3, 4)], 
                     "focus": "Progressive training", "targetKm": 30 + (i * 3), "keyWorkout": "Long Run"}
                    for i in range(weeks_until_goal)
                ],
                "totalWeeks": weeks_until_goal,
                "peakWeek": max(1, weeks_until_goal - 2),
                "taperStart": max(1, weeks_until_goal - 1)
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Master plan generation failed: {str(e)}")


@app.post("/daily-recommendation")
async def generate_daily_recommendation(request: DailyRecommendationRequest):
    """Generate 3 workout options for today"""
    model_name = os.getenv("MODEL_NAME", "local-model")
    
    # Format recent activities for context
    recent_summary = "No recent activities"
    if request.recentActivities:
        recent_summary = "\n".join([
            f"- {a.get('date', 'Unknown')}: {a.get('type', 'Run')} - {a.get('distance', 0)/1000:.1f}km, HR: {a.get('avgHR', 'N/A')}, Suffer: {a.get('sufferScore', 'N/A')}"
            for a in request.recentActivities[:7]
        ])
    
    # Get current week's theme from master plan
    week_theme = "General Training"
    if request.masterPlan:
        # Find current week (simplified)
        week_theme = request.masterPlan[0].get('theme', 'Base Building') if request.masterPlan else 'Base Building'
    
    prompt = f"""You are an AI running coach recommending today's workout.

TODAY: {request.today}
GOAL: {request.goal.type}
THIS WEEK'S THEME: {week_theme}

RECENT ACTIVITIES (last 7 days):
{recent_summary}

Based on recovery needs and training progression, recommend 3 workout options:
1. PRIMARY (best choice based on recent training)
2. EASIER alternative (if feeling tired)
3. HARDER alternative (if feeling strong)

Respond with ONLY valid JSON:
{{
  "recommended": {{
    "type": "Moderate Steady Run",
    "intensity": 2,
    "intensityLabel": "Aerobic Base",
    "description": "Brief description of the workout focus",
    "targetPace": "5:15 - 5:30 /km",
    "estimatedDistance": 8.5,
    "estimatedDuration": 45,
    "coachTip": "Personalized tip based on recent activities"
  }},
  "alternatives": [
    {{"type": "Active Recovery", "intensity": 1, "estimatedDuration": 25, "targetPace": "Easy"}},
    {{"type": "Threshold Intervals", "intensity": 3, "estimatedDuration": 60, "targetPace": "4:20 /km"}}
  ]
}}"""

    try:
        llm_response = requests.post(
            LLM_ENDPOINT,
            json={
                "model": model_name,
                "messages": [
                    {"role": "system", "content": "You are an expert running coach. Always respond with valid JSON only."},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.7,
                "max_tokens": 800
            },
            timeout=30
        )
        llm_response.raise_for_status()
        result = llm_response.json()
        response_text = result['choices'][0]['message']['content'].strip()
        
        try:
            return json.loads(response_text)
        except:
            # Fallback default
            return {
                "recommended": {
                    "type": "Easy Run",
                    "intensity": 1,
                    "intensityLabel": "Recovery",
                    "description": "Light aerobic effort to maintain base fitness.",
                    "targetPace": "6:00 - 6:30 /km",
                    "estimatedDistance": 6,
                    "estimatedDuration": 35,
                    "coachTip": "Keep it easy today - consistency beats intensity."
                },
                "alternatives": [
                    {"type": "Rest Day", "intensity": 0, "estimatedDuration": 0, "targetPace": "N/A"},
                    {"type": "Tempo Run", "intensity": 3, "estimatedDuration": 45, "targetPace": "4:30 /km"}
                ]
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Daily recommendation failed: {str(e)}")


@app.post("/weekly-plan")
async def generate_weekly_plan(request: WeeklyPlanRequest):
    """Generate a detailed weekly workout schedule"""
    model_name = os.getenv("MODEL_NAME", "local-model")
    
    # Get week theme from master plan
    week_theme = "General Training"
    week_focus = "Balanced training"
    if request.masterPlan and len(request.masterPlan) >= request.currentWeek:
        week_data = request.masterPlan[request.currentWeek - 1]
        week_theme = week_data.get('theme', 'Base Building')
        week_focus = week_data.get('focus', 'Progressive training')
    
    prompt = f"""Create a weekly running schedule.

WEEK: {request.currentWeek} (starting {request.weekStart})
THEME: {week_theme}
FOCUS: {week_focus}
GOAL: {request.goal.type}
PREFERRED DAYS: {', '.join(request.preferredDays or ['Mon', 'Wed', 'Fri', 'Sun'])}

Create a 7-day training schedule. Rest days should be on non-preferred days.

Respond with ONLY valid JSON:
{{
  "weekNumber": {request.currentWeek},
  "weekTheme": "{week_theme}",
  "weekFocus": "{week_focus}",
  "days": [
    {{"date": "2026-01-20", "dayName": "Monday", "workout": "Easy Run", "distance": 6, "intensity": 1}},
    ...7 days total
  ],
  "totalDistance": <sum of all distances>,
  "restDays": <count of rest days>
}}"""

    try:
        llm_response = requests.post(
            LLM_ENDPOINT,
            json={
                "model": model_name,
                "messages": [
                    {"role": "system", "content": "You are an expert running coach. Always respond with valid JSON only."},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.7,
                "max_tokens": 800
            },
            timeout=30
        )
        llm_response.raise_for_status()
        result = llm_response.json()
        response_text = result['choices'][0]['message']['content'].strip()
        
        try:
            return json.loads(response_text)
        except:
            # Fallback with calculated dates
            from datetime import timedelta
            start = datetime.fromisoformat(request.weekStart)
            days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
            return {
                "weekNumber": request.currentWeek,
                "weekTheme": week_theme,
                "weekFocus": week_focus,
                "days": [
                    {
                        "date": (start + timedelta(days=i)).strftime("%Y-%m-%d"),
                        "dayName": days[i],
                        "workout": "Easy Run" if i % 2 == 0 else "Rest Day",
                        "distance": 6 if i % 2 == 0 else 0,
                        "intensity": 1 if i % 2 == 0 else 0
                    }
                    for i in range(7)
                ],
                "totalDistance": 24,
                "restDays": 3
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Weekly plan failed: {str(e)}")


@app.post("/coach-chat")
async def coach_chat(request: ChatRequest):
    """Handle conversational coaching"""
    model_name = os.getenv("MODEL_NAME", "local-model")
    
    # Build conversation history
    messages = [
        {"role": "system", "content": """You are an AI running coach. Be helpful, encouraging, and data-driven.
If the user asks to modify their workout, suggest specific alternatives.
Keep responses concise (2-3 sentences max).
If suggesting a plan change, include 'PLAN_UPDATE: true' at the end of your response."""}
    ]
    
    if request.history:
        for msg in request.history[-5:]:  # Last 5 messages for context
            messages.append({"role": msg.get('role', 'user'), "content": msg.get('content', '')})
    
    # Add current context if available
    context_info = ""
    if request.currentPlan:
        rec = request.currentPlan.get('recommended', {})
        context_info = f"\n\nCurrent recommended workout: {rec.get('type', 'Unknown')} - {rec.get('estimatedDistance', 0)}km"
    
    messages.append({"role": "user", "content": request.message + context_info})
    
    try:
        llm_response = requests.post(
            LLM_ENDPOINT,
            json={
                "model": model_name,
                "messages": messages,
                "temperature": 0.7,
                "max_tokens": 200
            },
            timeout=20
        )
        llm_response.raise_for_status()
        result = llm_response.json()
        response_text = result['choices'][0]['message']['content'].strip()
        
        # Check for plan update signal
        plan_update = "PLAN_UPDATE: true" in response_text
        clean_response = response_text.replace("PLAN_UPDATE: true", "").strip()
        
        return {
            "message": clean_response,
            "planUpdate": plan_update
        }
    except Exception as e:
        return {
            "message": "I'm having trouble connecting right now. Let's try again in a moment.",
            "planUpdate": False
        }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
