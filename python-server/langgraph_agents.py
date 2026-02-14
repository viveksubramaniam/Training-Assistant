"""
LangGraph Multi-Agent Orchestration for AI Running Coach

This module implements a graph-based orchestration system with:
- Central orchestrator with persisted state
- Cascading plan agents (DB → Weekly → Daily)
- Chat agent with vector DB integration
- Bidirectional plan modifications
"""

from typing import TypedDict, Annotated, Literal
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from langchain_core.messages import HumanMessage, AIMessage
import json
import os
import requests
from datetime import datetime, timedelta


# =============================================================================
# STATE DEFINITION
# =============================================================================

class PlanState(TypedDict):
    """Persisted state for the orchestrator."""
    user_id: str
    
    # Data
    goal: dict | None
    master_plan: dict | None
    weekly_plan: dict | None
    daily_plan: dict | None
    recent_activities: list | None
    
    # Readiness flags
    is_master_plan_ready: bool
    is_weekly_plan_ready: bool
    is_daily_plan_ready: bool
    
    # Modification tracking (from chat agent)
    pending_modification: dict | None
    needs_weekly_update: bool
    chat_input: str | None  # Input from chat agent
    
    # Routing
    next_agent: str | None  # Decision from orchestrator
    
    # Output
    result: dict | None
    error: str | None


# =============================================================================
# LLM CONFIGURATION
# =============================================================================

LLM_ENDPOINT = os.getenv("LLM_ENDPOINT", "http://localhost:1234/v1/chat/completions")
MODEL_NAME = os.getenv("MODEL_NAME", "local-model")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")  # For OpenRouter
OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions"


def call_llm(prompt: str, system: str = "You are an expert running coach.") -> str:
    """Call the LLM endpoint (OpenRouter or Local)."""
    try:
        current_model = MODEL_NAME
        
        if OPENAI_API_KEY:
            # Use OpenRouter
            endpoint = OPENROUTER_ENDPOINT
            headers = {
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://github.com/langchain-ai/langgraph", # Required by OpenRouter sometimes
                "X-Title": "AI Run Coach"
            }
            # Fallback if model is standard default but we're on OpenRouter
            if current_model == "local-model":
                current_model = "google/gemini-2.0-flash-001"
                print(f"[LLM] 'local-model' detected with API Key. Switching to {current_model} for OpenRouter.")
        else:
            # Use Local LLM (e.g. LM Studio)
            endpoint = LLM_ENDPOINT
            headers = {"Content-Type": "application/json"}
            print(f"[LLM] Using local endpoint: {endpoint}")
        
        print(f"[LLM] Sending request to {endpoint} using model {current_model}")
        
        response = requests.post(
            endpoint,
            headers=headers,
            json={
                "model": current_model,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.7,
                "max_tokens": 2000
            },
            timeout=60
        )
        
        if response.status_code != 200:
            print(f"[LLM] Error Status: {response.status_code}")
            print(f"[LLM] Error Body: {response.text}")
            
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]
    except Exception as e:
        print(f"LLM call failed: {e}")
        raise

def parse_json_response(response: str) -> dict:
    """Extract and parse JSON from LLM response."""
    import re
    # 1. Try to find markdown code block
    json_match = re.search(r'```json\s*(.*?)```', response, re.DOTALL)
    if json_match:
        return json.loads(json_match.group(1))
    
    # 2. Try to find first/last braces
    json_match = re.search(r'\{.*\}', response, re.DOTALL)
    if json_match:
        return json.loads(json_match.group(0))
        
    raise ValueError("No JSON found in response")

# =============================================================================
# ORCHESTRATOR LLM NODE
# =============================================================================

def orchestrator_node(state: PlanState) -> PlanState:
    """
    Orchestrator Agent: Analyzes state and decides which agent to invoke.
    Uses LLM to make routing decisions based on current state and any chat input.
    Considers training load and completed workouts for modifications.
    """
    print(f"[Orchestrator] Analyzing state for user {state['user_id']}")
    
    # Build context for LLM decision
    has_goal = state.get("goal") is not None
    has_master_plan = state.get("master_plan") is not None and bool(state.get("master_plan", {}).get("weeks"))
    has_weekly_plan = state.get("weekly_plan") is not None and bool(state.get("weekly_plan", {}).get("days"))
    has_daily_plan = state.get("is_daily_plan_ready", False)
    pending_mod = state.get("pending_modification")
    chat_input = state.get("chat_input")
    
    # Extract training context for smarter decisions
    weekly_plan = state.get("weekly_plan", {})
    completed_days = 0
    total_km_done = 0
    remaining_km = 0
    current_training_load = "unknown"
    
    if weekly_plan and weekly_plan.get("days"):
        today = datetime.now().strftime("%Y-%m-%d")
        for day in weekly_plan["days"]:
            day_date = day.get("date", "")
            if day_date < today:
                completed_days += 1
                total_km_done += day.get("distance", 0) or 0
            else:
                remaining_km += day.get("distance", 0) or 0
        
        total_weekly_km = weekly_plan.get("totalDistance", 40)
        if total_km_done > total_weekly_km * 0.7:
            current_training_load = "high - already done most of this week's volume"
        elif total_km_done > total_weekly_km * 0.4:
            current_training_load = "moderate - on track"
        else:
            current_training_load = "low - still early in the week"
    
    # Deterministic Overrides (Save LLM calls)
    if has_goal and not has_master_plan:
        print("[Orchestrator] No master plan found -> forcing master_planning_agent")
        state["next_agent"] = "master_planning_agent"
        return state

    prompt = f"""You are an AI orchestrator for a running coach application.
Analyze the current state and decide which action to take.

CURRENT STATE:
- Has Goal: {has_goal}
- Has Master Plan: {has_master_plan}
- Has Weekly Plan: {has_weekly_plan}
- Has Daily Plan: {has_daily_plan}
- Pending Modification: {json.dumps(pending_mod) if pending_mod else 'None'}
- Chat Input: {chat_input if chat_input else 'None'}

TRAINING CONTEXT (for modifications):
- Days completed this week: {completed_days}
- Distance done: {total_km_done:.1f}km
- Remaining planned: {remaining_km:.1f}km
- Current load status: {current_training_load}

DECISION RULES:
1. If no goal exists → "error"
2. If no master plan exists → "master_planning_agent"
3. If chat input requests a change (e.g., "make today easier", "swap workouts", "I'm tired"):
   → "weekly_planner" (will adjust remaining days considering current load)
4. If no weekly plan OR modification pending → "weekly_planner"
5. If no daily plan → "daily_planner"
6. If everything is ready → "prepare_result"

When chat requests modifications, the weekly_planner will:
- Preserve what's already completed
- Adjust ONLY remaining days
- Consider current training load
- Maintain weekly volume targets where possible

Respond with ONLY one of: "master_planning_agent", "weekly_planner", "daily_planner", "prepare_result", "error"
"""

    try:
        response = call_llm(prompt, system="You are a routing decision agent. Respond with only the agent name.")
        decision = response.strip().lower().replace('"', '').replace("'", "")
        
        # Validate and normalize decision
        valid_decisions = ["master_planning_agent", "weekly_planner", "daily_planner", "prepare_result", "error"]
        
        for valid in valid_decisions:
            if valid in decision:
                state["next_agent"] = valid
                print(f"[Orchestrator] Decision: {valid}")
                return state
        
        # Fallback to rule-based if LLM response unclear
        raise ValueError(f"Unclear LLM decision: {decision}")
        
    except Exception as e:
        print(f"[Orchestrator] LLM decision failed, using rules: {e}")
        
        # Rule-based fallback
        if not has_goal:
            state["next_agent"] = "error"
            state["error"] = "No active goal found"
        elif not has_master_plan:
            state["next_agent"] = "master_planning_agent"
        elif chat_input or pending_mod or state.get("needs_weekly_update"):
            state["next_agent"] = "weekly_planner"
        elif not has_weekly_plan:
            state["next_agent"] = "weekly_planner"
        elif not has_daily_plan:
            state["next_agent"] = "daily_planner"
        else:
            state["next_agent"] = "prepare_result"
        
        print(f"[Orchestrator] Fallback decision: {state['next_agent']}")
    
    return state


def route_from_orchestrator(state: PlanState) -> str:
    """Route based on orchestrator's decision."""
    return state.get("next_agent", "prepare_result")


# =============================================================================
# AGENT NODES
# =============================================================================

def master_planning_agent(state: PlanState) -> PlanState:
    """
    Master Planning Agent: Creates the overall training plan when none exists.
    Gets recent activities and calls the LLM to create a master plan.
    This is the first agent in the cascade.
    """
    print(f"[Master Planning Agent] Processing for user {state['user_id']}")
    
    goal = state.get("goal")
    master_plan = state.get("master_plan")
    recent_activities = state.get("recent_activities", [])
    
    # If no goal, we can't proceed
    if not goal:
        state["is_master_plan_ready"] = False
        state["error"] = "No active goal found"
        return state
    
    # If master plan already exists, mark as ready and continue
    if master_plan and master_plan.get("weeks"):
        print("[Master Planning Agent] Master plan already exists")
        state["is_master_plan_ready"] = True
        return state
    
    # Generate master plan via LLM
    print("[Master Planning Agent] Generating new master plan via LLM")
    
    # Build activity context
    activity_context = "No recent activities"
    if recent_activities:
        activity_context = f"{len(recent_activities)} recent activities:\n"
        for act in recent_activities[:5]:
            activity_context += f"- {act.get('date', 'Unknown')}: {act.get('distance', 0)/1000:.1f}km, {act.get('type', 'Run')}\n"
    
    # Calculate weeks until target
    total_weeks = 12  # Default
    if goal.get("targetDate"):
        try:
            target = datetime.fromisoformat(goal["targetDate"].replace("Z", ""))
            weeks_until = (target - datetime.now()).days // 7
            total_weeks = max(4, min(24, weeks_until))
        except:
            pass
    
    prompt = f"""Create a comprehensive {total_weeks}-week training master plan.

GOAL: {goal.get('type', 'General Fitness')}
TARGET DATE: {goal.get('targetDate', 'Not specified')}
WEEKLY TARGET: {goal.get('weeklyTarget', 40)}km
WORKOUT DAYS: {goal.get('preferredWorkoutDays', ['Sun', 'Tue', 'Thu'])}

RECENT ACTIVITY:
{activity_context}

Create a periodized plan with phases:
1. Base Building (weeks 1-4): Foundation, easy aerobic volume
2. Build Phase (weeks 5-8): Increase intensity, add tempo/intervals
3. Peak Phase (weeks 9-{total_weeks-2}): Race-specific training, highest intensity
4. Taper (final 1-2 weeks): Reduce volume, maintain intensity

If there are not so many weeks, you can take a call on how to split the weeeks. Minimum 1 week of a plan is expected. 


Respond with ONLY valid JSON wrapped in a markdown block:
```json
{{
  "weeks": [
    {{"week": 1, "theme": "Base Building", "focus": "Aerobic foundation", "targetKm": 30, "numWorkouts": 5, "numRestDays": 2, "keyWorkouts": ["Long run", "Easy runs"]}},
    {{"week": 2, "theme": "Base Building", "focus": "Volume increase", "targetKm": 35, "numWorkouts": 5, "numRestDays": 2, "keyWorkouts": ["Long run", "Tempo"]}},
    ...
  ],
  "total_weeks": {total_weeks},
  "peak_week": {max(1, total_weeks - 3)},
  "taper_start_week": {max(1, total_weeks - 1)}
}}
```
"""

    try:
        response = call_llm(prompt)
        
        master_plan = parse_json_response(response)
        state["master_plan"] = master_plan
        state["is_master_plan_ready"] = True
        print("[Master Planning Agent] Master plan generated via LLM")
        print(f"[Master Planning Agent] RESPONSE: {json.dumps(master_plan, indent=2)[:1000]}...")
            
    except Exception as e:
        print(f"[Master Planning Agent] LLM generation failed: {e}")
        # print(f"[Master Planning Agent] RAW RESPONSE: {response}") # Can't print response if call_llm raised, but usually it returns str
        print("[Master Planning Agent] Using programmatic fallback")
        
        # Fallback: Generate a basic periodized plan
        weeks = []
        for i in range(1, total_weeks + 1):
                if i <= 4:
                    theme = "Base Building"
                    focus = "Aerobic foundation"
                    target_km = 30 + (i * 2)
                elif i <= 8:
                    theme = "Build Phase"
                    focus = "Add intensity"
                    target_km = 40 + ((i - 4) * 3)
                elif i <= total_weeks - 2:
                    theme = "Peak Phase"
                    focus = "Race-specific"
                    target_km = 50 + ((i - 8) * 2)
                else:
                    theme = "Taper"
                    focus = "Recovery and sharpening"
                    target_km = 30 - ((total_weeks - i) * 5)
                
                weeks.append({
                    "week": i,
                    "theme": theme,
                    "focus": focus,
                    "targetKm": max(20, target_km),
                    "keyWorkouts": ["Long run", "Tempo", "Easy runs"]
                })
        
        state["master_plan"] = {
            "weeks": weeks,
            "total_weeks": total_weeks,
            "peak_week": max(1, total_weeks - 3),
            "taper_start_week": max(1, total_weeks - 1)
            }
        state["is_master_plan_ready"] = True
    
    return state


def weekly_planner(state: PlanState) -> PlanState:
    """
    Weekly Planner Agent: Generates 7-day workout schedule.
    Called after DB agent or when weekly update is needed.
    """
    print("[Weekly Planner] Generating weekly plan")
    
    if not state.get("is_master_plan_ready"):
        state["error"] = "Cannot generate weekly plan: master plan not ready"
        return state
    
    goal = state.get("goal", {})
    master_plan = state.get("master_plan", {})
    
    # Calculate current week
    week_start = datetime.now()
    week_start = week_start - timedelta(days=week_start.weekday())  # Monday
    
    # Get week theme from master plan
    week_theme = "General Training"
    week_focus = "Balanced training"
    current_week = 1
    
    if master_plan and master_plan.get("weeks"):
        for week in master_plan["weeks"]:
            if week.get("week") == current_week:
                week_theme = week.get("theme", week_theme)
                week_focus = week.get("focus", week_focus)
                break
    
    # Handle pending modifications and training context
    modification_context = ""
    existing_plan = state.get("weekly_plan", {})
    completed_days_info = ""
    
    if existing_plan and existing_plan.get("days"):
        today = datetime.now().strftime("%Y-%m-%d")
        completed = []
        km_done = 0
        for day in existing_plan["days"]:
            day_date = day.get("date", "")
            if day_date < today:
                completed.append(day)
                km_done += day.get("distance", 0) or 0
        
        if completed:
            completed_days_info = f"""
ALREADY COMPLETED (PRESERVE THESE):
{json.dumps(completed, indent=2)}
Total km already done: {km_done:.1f}km

IMPORTANT: Keep these completed days as-is. Only modify remaining days.
"""
    
    if state.get("pending_modification") or state.get("chat_input"):
        mod = state.get("pending_modification", {})
        chat = state.get("chat_input", "")
        modification_context = f"""
USER MODIFICATION REQUEST:
Day to modify: {mod.get('day', 'Not specified')}
Request: {mod.get('description', chat)}

When applying this modification:
1. PRESERVE completed days (shown above)
2. Adjust ONLY remaining days
3. Maintain weekly volume target as much as possible
4. Consider current training load when making changes
"""
    
    prompt = f"""Create a detailed 7-day running schedule.

WEEK: {current_week} (starting {week_start.strftime('%Y-%m-%d')})
THEME: {week_theme}
FOCUS: {week_focus}
GOAL: {goal.get('type', 'General Fitness')}
WEEKLY TARGET: {goal.get('weeklyTarget', 40)}km
{completed_days_info}
{modification_context}

Create exactly 7 days with varied workouts. Include a balanced workout, easy runs, tempo runs, long runs, and intervals.
But always stick to the weekly target and the days of the week that user wants to run.

IMPORTANT: The values in the JSON structure below are just for format reference (e.g. distance must be a number). You MUST generate specific, appropriate values for target_time, target_pace, distance, and intensity based on the athlete's level and the goal of the specific workout. Do not simply copy the example values.

Respond with ONLY valid JSON wrapped in a markdown block:
```json
{{
  "weekNumber": {current_week},
  "weekTheme": "{week_theme}",
  "weekFocus": "{week_focus}",
  "days": [
    {{"date": "YYYY-MM-DD", "dayName": "Monday", "title": "Workout Title", "workout_type": "Easy Run|Interval|Long Run|Tempo|Rest", "target_time": "e.g. 45 mins", "target_pace": "e.g. 5:30 /km", "distance": 5, "intensity": 2, "description": "Specific workout details..."}}
  ],
  "restDays": 2
}}
```"""

    try:
        response = call_llm(prompt)
        
        weekly_plan = parse_json_response(response)
        state["weekly_plan"] = weekly_plan
        state["is_weekly_plan_ready"] = True
        state["needs_weekly_update"] = False
        state["pending_modification"] = None  # Clear after applying
        print(f"[Weekly Planner] RESPONSE: {json.dumps(weekly_plan, indent=2)[:1000]}...")
            
    except Exception as e:
        print(f"Weekly planner error: {e}")
        try:
             print(f"RAW RESPONSE: {response}")
        except: pass
        # Fallback plan
        days = []
        for i in range(7):
            day_date = (week_start + timedelta(days=i)).strftime("%Y-%m-%d")
            day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
            
            if i == 2 or i == 6:  # Rest days
                days.append({
                    "date": day_date,
                    "dayName": day_names[i],
                    "title": "Rest Day",
                    "workout_type": "Rest",
                    "intensity": 0,
                    "description": "Active recovery"
                })
            elif i == 5:  # Long run
                days.append({
                    "date": day_date,
                    "dayName": day_names[i],
                    "title": "Long Run",
                    "workout_type": "Long Run",
                    "target_time": "90 mins",
                    "target_pace": "5:30 /km",
                    "distance": 16,
                    "intensity": 2,
                    "description": "Build endurance"
                })
            elif i == 1:  # Interval
                days.append({
                    "date": day_date,
                    "dayName": day_names[i],
                    "title": "Interval Training",
                    "workout_type": "Interval",
                    "target_time": "50 mins",
                    "target_pace": "4:30 /km",
                    "distance": 8,
                    "intensity": 3,
                    "description": "5x1km intervals",
                    "intervals": {"count": 5, "work_pace": "4:30", "active_recovery_pace": "6:00"}
                })
            else:  # Easy runs
                days.append({
                    "date": day_date,
                    "dayName": day_names[i],
                    "title": "Easy Aerobic Run",
                    "workout_type": "Easy Run",
                    "target_time": "45 mins",
                    "target_pace": "5:45 /km",
                    "distance": 7,
                    "intensity": 1,
                    "description": "Zone 2 effort"
                })
        
        state["weekly_plan"] = {
            "weekNumber": current_week,
            "weekTheme": week_theme,
            "weekFocus": week_focus,
            "days": days,
            "totalDistance": 45,
            "restDays": 2
        }
        state["is_weekly_plan_ready"] = True
    
    return state


def daily_planner(state: PlanState) -> PlanState:
    """
    Daily Planner Agent: Generates 3 workout options for today.
    Recommended option MUST match the weekly plan.
    """
    print("[Daily Planner] Generating daily options")
    
    if not state.get("is_weekly_plan_ready"):
        state["error"] = "Cannot generate daily plan: weekly plan not ready"
        return state
    
    weekly_plan = state.get("weekly_plan", {})
    goal = state.get("goal", {})
    
    # Extract today's workout from weekly plan
    today = datetime.now().strftime("%Y-%m-%d")
    today_day_name = datetime.now().strftime("%A")
    today_workout = None
    
    for day in weekly_plan.get("days", []):
        if day.get("date") == today or day.get("dayName", "").lower() == today_day_name.lower():
            today_workout = day
            break
    
    if not today_workout:
        # Default to first non-rest day
        for day in weekly_plan.get("days", []):
            if day.get("workout_type", "").lower() != "rest":
                today_workout = day
                break
    
    if not today_workout:
        today_workout = {"workout_type": "Easy Run", "title": "Recovery Run", "distance": 5}
    
    prompt = f"""Create today's workout options.

TODAY: {today} ({today_day_name})
GOAL: {goal.get('type', 'General Fitness')}
WEEKLY TARGET: {goal.get('weeklyTarget', 40)}km

SCHEDULED WORKOUT FROM WEEKLY PLAN:
{json.dumps(today_workout, indent=2)}

The RECOMMENDED option MUST match the scheduled workout above.
Create 2 alternatives: one lighter, one different type.

INTENSITY LABELS (use ONLY these):
- "Long Run" (for long distance runs, purple badge)
- "Moderate" (for tempo/steady runs, yellow badge)
- "Intense" (for intervals/hard efforts, red badge)
- "Workout" (for structured sessions, orange badge)

Respond with ONLY valid JSON wrapped in a markdown block:
```json
{{
  "recommended": {{
    "type": "{today_workout.get('workout_type', 'Easy Run')}",
    "title": "{today_workout.get('title', 'Workout')}",
    "duration": "{today_workout.get('target_time', '45 mins')}",
    "distance": {today_workout.get('distance', 5)},
    "targetPace": "{today_workout.get('target_pace', '5:30 /km')}",
    "intensityLabel": "Moderate",
    "description": "...",
    "coachTip": "..."
  }},
  "option_2": {{ "type": "Easy Run", "title": "Light Recovery", "intensityLabel": "Moderate", ... }},
  "option_3": {{ "type": "Cross Training", "title": "Alternative", "intensityLabel": "Moderate", ... }},
  "aiInsight": "Brief coaching tip for today"
}}
```"""

    try:
        response = call_llm(prompt)
        
        daily_plan = parse_json_response(response)
        daily_plan["date"] = today
        daily_plan["fromWeeklyPlan"] = today_workout
        state["daily_plan"] = daily_plan
        state["is_daily_plan_ready"] = True
        print(f"[Daily Planner] RESPONSE: {json.dumps(daily_plan, indent=2)[:1000]}...")
            
    except Exception as e:
        print(f"Daily planner error: {e}")
        try:
             print(f"RAW RESPONSE: {response}")
        except: pass
        # Fallback plan based on weekly
        state["daily_plan"] = {
            "date": today,
            "recommended": {
                "type": today_workout.get("workout_type", "Easy Run"),
                "title": today_workout.get("title", "Training Session"),
                "duration": today_workout.get("target_time", "45 mins"),
                "distance": today_workout.get("distance", 5),
                "targetPace": today_workout.get("target_pace", "5:30 /km"),
                "intensityLabel": "Moderate",
                "description": today_workout.get("description", "Complete as planned"),
                "coachTip": "Focus on consistent effort"
            },
            "option_2": {
                "type": "Easy Run",
                "title": "Light Recovery",
                "duration": "30 mins",
                "distance": 4,
                "targetPace": "6:00 /km",
                "intensityLabel": "Moderate",
                "description": "Take it easy if needed",
                "coachTip": "Listen to your body"
            },
            "option_3": {
                "type": "Cross Training",
                "title": "Active Recovery",
                "duration": "30 mins",
                "distance": 0,
                "targetPace": "N/A",
                "intensityLabel": "Moderate",
                "description": "Swimming, cycling, or yoga",
                "coachTip": "Great for recovery"
            },
            "fromWeeklyPlan": today_workout,
            "aiInsight": "Stay consistent with your training plan!"
        }
        state["is_daily_plan_ready"] = True
    
    return state


def prepare_result(state: PlanState) -> PlanState:
    """Prepare the final result for API response."""
    state["result"] = {
        "masterPlan": state.get("master_plan"),
        "weeklyPlan": state.get("weekly_plan"),
        "dailyPlan": state.get("daily_plan"),
        "todayWorkout": state["daily_plan"].get("fromWeeklyPlan") if state.get("daily_plan") else None,
        "flags": {
            "masterPlanReady": state.get("is_master_plan_ready", False),
            "weeklyPlanReady": state.get("is_weekly_plan_ready", False),
            "dailyPlanReady": state.get("is_daily_plan_ready", False)
        }
    }
    print(f"[prepare_result] Final result flags: {state['result']['flags']}")
    print(f"[prepare_result] Has masterPlan: {state['result']['masterPlan'] is not None}")
    print(f"[prepare_result] Has weeklyPlan: {state['result']['weeklyPlan'] is not None}")
    print(f"[prepare_result] Has dailyPlan: {state['result']['dailyPlan'] is not None}")
    return state


# =============================================================================
# ROUTING FUNCTIONS
# =============================================================================

def should_generate_weekly(state: PlanState) -> Literal["weekly_planner", "daily_planner", "prepare_result"]:
    """Decide if weekly planner needs to run."""
    if not state.get("is_weekly_plan_ready") or state.get("needs_weekly_update"):
        return "weekly_planner"
    elif not state.get("is_daily_plan_ready"):
        return "daily_planner"
    else:
        return "prepare_result"


def after_weekly(state: PlanState) -> Literal["daily_planner"]:
    """After weekly, always go to daily (cascading)."""
    return "daily_planner"


def after_daily(state: PlanState) -> Literal["prepare_result"]:
    """After daily, prepare result."""
    return "prepare_result"


# =============================================================================
# GRAPH CONSTRUCTION
# =============================================================================

def build_orchestrator_graph():
    """Build the LangGraph orchestrator."""
    
    # Create the graph
    graph = StateGraph(PlanState)
    
    # Add nodes
    graph.add_node("orchestrator", orchestrator_node)
    graph.add_node("master_planning_agent", master_planning_agent)
    graph.add_node("weekly_planner", weekly_planner)
    graph.add_node("daily_planner", daily_planner)
    graph.add_node("prepare_result", prepare_result)
    
    # Set entry point to orchestrator
    graph.set_entry_point("orchestrator")
    
    # Orchestrator routes to appropriate agent
    graph.add_conditional_edges(
        "orchestrator",
        route_from_orchestrator,
        {
            "master_planning_agent": "master_planning_agent",
            "weekly_planner": "weekly_planner",
            "daily_planner": "daily_planner",
            "prepare_result": "prepare_result",
            "error": "prepare_result"  # Errors go to prepare_result to return error
        }
    )
    
    # After master_planning_agent, go to weekly planner (cascade)
    graph.add_edge("master_planning_agent", "weekly_planner")
    
    # After weekly_planner, go to daily (cascading)
    graph.add_edge("weekly_planner", "daily_planner")
    
    # After daily, prepare result
    graph.add_edge("daily_planner", "prepare_result")
    graph.add_edge("prepare_result", END)
    
    # Add persistence
    memory = MemorySaver()
    
    return graph.compile(checkpointer=memory)


# Create the compiled graph
orchestrator_graph = build_orchestrator_graph()


# =============================================================================
# PUBLIC API
# =============================================================================

def orchestrate_plans(
    user_id: str,
    goal: dict | None = None,
    master_plan: dict | None = None,
    weekly_plan: dict | None = None,
    recent_activities: list | None = None,
    force_regenerate: bool = False
) -> dict:
    """
    Main orchestration function.
    
    Args:
        user_id: Unique user identifier
        goal: User's training goal
        master_plan: Long-term training plan
        weekly_plan: Existing weekly plan (if cached)
        recent_activities: Recent workout activities
        force_regenerate: Force regeneration of all plans
    
    Returns:
        dict with weeklyPlan, dailyPlan, todayWorkout, flags
    """
    
    initial_state: PlanState = {
        "user_id": user_id,
        "goal": goal,
        "master_plan": master_plan if not force_regenerate else None,  # Clear master plan on force regenerate
        "weekly_plan": weekly_plan if not force_regenerate else None,
        "daily_plan": None,
        "recent_activities": recent_activities,
        "is_master_plan_ready": False if force_regenerate else (master_plan is not None and bool(master_plan.get("weeks")) if master_plan else False),
        "is_weekly_plan_ready": weekly_plan is not None and not force_regenerate,
        "is_daily_plan_ready": False,
        "pending_modification": None,
        "needs_weekly_update": force_regenerate,
        "chat_input": None,
        "next_agent": None,
        "result": None,
        "error": None
    }
    
    # Run the graph
    config = {"configurable": {"thread_id": user_id}}
    final_state = orchestrator_graph.invoke(initial_state, config)
    
    if final_state.get("error"):
        return {"error": final_state["error"]}
    
    return final_state.get("result", {})


def modify_plan_from_chat(
    user_id: str,
    modification: dict,
    current_state: dict
) -> dict:
    """
    Handle plan modification from chat agent.
    
    Args:
        user_id: User identifier
        modification: {"day": "Wednesday", "description": "Make it an easy run instead"}
        current_state: Current plan state
    
    Returns:
        Updated plans after modification
    """
    
    state: PlanState = {
        "user_id": user_id,
        "goal": current_state.get("goal"),
        "master_plan": current_state.get("master_plan"),
        "weekly_plan": current_state.get("weekly_plan"),
        "daily_plan": None,
        "recent_activities": None,
        "is_master_plan_ready": True,
        "is_weekly_plan_ready": False,  # Force regeneration
        "is_daily_plan_ready": False,
        "pending_modification": modification,
        "needs_weekly_update": True,
        "chat_input": modification.get("description"),  # Pass chat context
        "next_agent": None,
        "result": None,
        "error": None
    }
    
    config = {"configurable": {"thread_id": user_id}}
    final_state = orchestrator_graph.invoke(state, config)
    
    return final_state.get("result", {})
