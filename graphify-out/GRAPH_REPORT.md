# Graph Report - .  (2026-04-23)

## Corpus Check
- Corpus is ~46,814 words - fits in a single context window. You may not need a graph.

## Summary
- 274 nodes · 387 edges · 31 communities detected
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 29 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Testing Framework|Testing Framework]]
- [[_COMMUNITY_Plan Orchestration|Plan Orchestration]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Activity Management|Activity Management]]
- [[_COMMUNITY_Plan Orchestration|Plan Orchestration]]
- [[_COMMUNITY_Plan Orchestration|Plan Orchestration]]
- [[_COMMUNITY_Plan Orchestration|Plan Orchestration]]
- [[_COMMUNITY_Activity Management|Activity Management]]
- [[_COMMUNITY_Activity Management|Activity Management]]
- [[_COMMUNITY_Plan Orchestration|Plan Orchestration]]
- [[_COMMUNITY_Design System|Design System]]
- [[_COMMUNITY_Frontend Components|Frontend Components]]
- [[_COMMUNITY_Plan Orchestration|Plan Orchestration]]
- [[_COMMUNITY_Frontend Components|Frontend Components]]
- [[_COMMUNITY_Calendar UI|Calendar UI]]
- [[_COMMUNITY_Chat Interface|Chat Interface]]
- [[_COMMUNITY_Strava Auth|Strava Auth]]
- [[_COMMUNITY_Database Layer|Database Layer]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Plan Orchestration|Plan Orchestration]]
- [[_COMMUNITY_Goal Management|Goal Management]]
- [[_COMMUNITY_Plan Orchestration|Plan Orchestration]]
- [[_COMMUNITY_Frontend Components|Frontend Components]]
- [[_COMMUNITY_Plan Orchestration|Plan Orchestration]]
- [[_COMMUNITY_Calendar UI|Calendar UI]]
- [[_COMMUNITY_Frontend Components|Frontend Components]]
- [[_COMMUNITY_Frontend Components|Frontend Components]]
- [[_COMMUNITY_Frontend Components|Frontend Components]]
- [[_COMMUNITY_Design System|Design System]]
- [[_COMMUNITY_Database Layer|Database Layer]]
- [[_COMMUNITY_Database Layer|Database Layer]]

## God Nodes (most connected - your core abstractions)
1. `triggerOrchestration()` - 14 edges
2. `Comprehensive Test Runbook for Run Coach App` - 9 edges
3. `Striive v2 Premium-Athletic Design System` - 8 edges
4. `call_llm()` - 7 edges
5. `LangGraph Multi-Agent Plan Orchestration` - 7 edges
6. `parse_json_response()` - 6 edges
7. `ActivityDetailPage()` - 6 edges
8. `getActivity()` - 5 edges
9. `master_planning_agent()` - 5 edges
10. `weekly_planner()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `Google Fonts: Inter, JetBrains Mono, Space Grotesk, Material Symbols` --semantically_similar_to--> `Striive v2 Typography: Space Grotesk + JetBrains Mono`  [INFERRED] [semantically similar]
  frontend/index.html → striive_v2_plan.md
- `Python Server Dependencies (FastAPI, LangGraph, etc.)` --references--> `LangGraph Multi-Agent Plan Orchestration`  [INFERRED]
  python-server/requirements.txt → claude.md
- `AI Analysis Tests` --references--> `LangGraph Multi-Agent Plan Orchestration`  [INFERRED]
  TEST_AGENT_RUNBOOK.md → claude.md
- `Plan Orchestration Tests` --references--> `LangGraph Multi-Agent Plan Orchestration`  [INFERRED]
  TEST_AGENT_RUNBOOK.md → claude.md
- `Glass Morphism Card Pattern (deprecated in Striive v2)` --rationale_for--> `Striive v2 Premium-Athletic Design System`  [INFERRED]
  frontend/src/calendar_plans.html → striive_v2_plan.md

## Hyperedges (group relationships)
- **Plan Generation Pipeline: Master → Weekly → Daily** — claude_master_planning_agent, claude_weekly_planner, claude_daily_planner [EXTRACTED 1.00]
- **Striive v2 Design System Parallel Implementation Tasks** — striive_v2_profile_redesign, striive_v2_chat_redesign, striive_v2_modal_token_swap, striive_v2_coach_full_route [EXTRACTED 1.00]
- **Comprehensive Test Coverage Across All System Layers** — test_runbook_auth_tests, test_runbook_activity_tests, test_runbook_plan_tests, test_runbook_frontend_tests, test_runbook_security_tests [EXTRACTED 1.00]

## Communities

### Community 0 - "Testing Framework"
Cohesion: 0.12
Nodes (33): calculateStreak(), cleanupOldGoals(), clearUserCaches(), completeGoal(), createGoal(), deactivateUserGoals(), deleteGoal(), deleteSummary() (+25 more)

### Community 1 - "Plan Orchestration"
Cohesion: 0.1
Nodes (32): after_daily(), after_weekly(), build_orchestrator_graph(), call_llm(), daily_planner(), master_planning_agent(), modify_plan_from_chat(), orchestrate_plans() (+24 more)

### Community 2 - "Community 2"
Cohesion: 0.16
Nodes (22): clearUserCaches(), createGoal(), deactivateUserGoals(), deleteGoal(), deleteSummary(), getActiveGoal(), getActivity(), getActivitySummary() (+14 more)

### Community 3 - "Activity Management"
Cohesion: 0.14
Nodes (20): ActivityData, analyze_activity(), chat_with_coach(), ChatRequest, GoalData, health_check(), orchestrate_plans(), OrchestrationRequest (+12 more)

### Community 4 - "Plan Orchestration"
Cohesion: 0.12
Nodes (19): System Architecture with 3-service Design, Daily Plan Structure v2.1 with 3 Options, Daily Planner Agent, Demo User (Strava ID 999999999), LangGraph Multi-Agent Plan Orchestration, Master Planning Agent, Run Coach App Project Summary, Weekly Planner Agent (+11 more)

### Community 5 - "Plan Orchestration"
Cohesion: 0.24
Nodes (13): adjustWorkout(), generateFallbackDailyPlan(), generateFallbackMasterPlan(), generateFallbackWeeklyPlan(), getWeekStart(), matchDay(), requireAuth(), triggerOrchestration() (+5 more)

### Community 6 - "Plan Orchestration"
Cohesion: 0.19
Nodes (13): Calendar Plans Uses Tailwind + Primary Color #f97415, Glass Morphism Card Pattern (deprecated in Striive v2), Calendar Plans HTML Prototype, Google Fonts: Inter, JetBrains Mono, Space Grotesk, Material Symbols, Frontend HTML Entry Point, ChatWidget v2 Redesign Task, Coach as Full Route (#/coach) Implementation, Striive v2 Design Philosophy and Aesthetic (+5 more)

### Community 7 - "Activity Management"
Cohesion: 0.4
Nodes (8): ActivityListPage(), ActivityTypeIcon(), App(), BottomNav(), go(), LoginScreen(), parseHash(), useRoute()

### Community 8 - "Activity Management"
Cohesion: 0.5
Nodes (7): ActivityDetailPage(), formatDuration(), formatPaceFromSpeed(), HRTrace(), Recenter(), rollingAverage(), tagForType()

### Community 9 - "Plan Orchestration"
Cohesion: 0.73
Nodes (4): DailyPlanTab(), effortProfile(), getTodayInfo(), parseDurationMinutes()

### Community 10 - "Design System"
Cohesion: 0.6
Nodes (4): ensureValidToken(), getAuthenticatedUser(), refreshAccessToken(), requireAuth()

### Community 11 - "Frontend Components"
Cohesion: 0.6
Nodes (3): PulseDots(), StravaIcon(), StravaLoginButton()

### Community 12 - "Plan Orchestration"
Cohesion: 0.4
Nodes (5): Interactive Activity Analysis with AI Insights, AI Coach with Personalized Plans, Goal Setting and Training Progress Tracking, Strava OAuth Integration, Training Assistant Application

### Community 13 - "Frontend Components"
Cohesion: 0.67
Nodes (2): ChevronRight(), ProfilePage()

### Community 14 - "Calendar UI"
Cohesion: 0.67
Nodes (2): CalendarPage(), categorize()

### Community 15 - "Chat Interface"
Cohesion: 0.67
Nodes (2): BrainSVG(), ChatWidget()

### Community 16 - "Strava Auth"
Cohesion: 0.67
Nodes (1): requireAuth()

### Community 17 - "Database Layer"
Cohesion: 0.67
Nodes (1): getDatabaseType()

### Community 18 - "Community 18"
Cohesion: 0.67
Nodes (1): run()

### Community 19 - "Plan Orchestration"
Cohesion: 0.67
Nodes (1): WeeklyPlanTab()

### Community 20 - "Goal Management"
Cohesion: 0.67
Nodes (1): GoalEditorModal()

### Community 21 - "Plan Orchestration"
Cohesion: 0.67
Nodes (1): TrainingPlanLoader()

### Community 22 - "Frontend Components"
Cohesion: 0.67
Nodes (1): ConfirmationModal()

### Community 23 - "Plan Orchestration"
Cohesion: 0.67
Nodes (1): PlanCreatingLoader()

### Community 24 - "Calendar UI"
Cohesion: 0.67
Nodes (1): DetailedWeekView()

### Community 25 - "Frontend Components"
Cohesion: 0.67
Nodes (1): TrainingPhasesView()

### Community 26 - "Frontend Components"
Cohesion: 0.67
Nodes (1): MonthView()

### Community 27 - "Frontend Components"
Cohesion: 0.67
Nodes (3): AI Service Tech Stack, Backend Tech Stack, Frontend Tech Stack

### Community 28 - "Design System"
Cohesion: 1.0
Nodes (2): JWT Authentication (24h expiry), Strava Token Auto-Refresh with 5min Buffer

### Community 47 - "Database Layer"
Cohesion: 1.0
Nodes (1): PostgreSQL Database

### Community 48 - "Database Layer"
Cohesion: 1.0
Nodes (1): PostgreSQL Database Schema with 14 Tables

## Knowledge Gaps
- **46 isolated node(s):** `Request for plan orchestration via LangGraph`, `Request for chat-based plan interaction`, `Activity data for analysis`, `Health check endpoint`, `Main LangGraph orchestration endpoint.          Flow: orchestrator → master_plan` (+41 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Frontend Components`** (4 nodes): `ProfilePage.jsx`, `ProfilePage.jsx`, `ChevronRight()`, `ProfilePage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Calendar UI`** (4 nodes): `CalendarPage()`, `categorize()`, `CalendarPage.jsx`, `CalendarPage.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Chat Interface`** (4 nodes): `BrainSVG()`, `ChatWidget()`, `ChatWidget.jsx`, `ChatWidget.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Strava Auth`** (3 nodes): `goals.js`, `requireAuth()`, `goals.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Database Layer`** (3 nodes): `index.js`, `index.js`, `getDatabaseType()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 18`** (3 nodes): `run_seed.js`, `run_seed.js`, `run()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Plan Orchestration`** (3 nodes): `WeeklyPlanTab.jsx`, `WeeklyPlanTab.jsx`, `WeeklyPlanTab()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Goal Management`** (3 nodes): `GoalEditorModal.jsx`, `GoalEditorModal()`, `GoalEditorModal.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Plan Orchestration`** (3 nodes): `TrainingPlanLoader.jsx`, `TrainingPlanLoader.jsx`, `TrainingPlanLoader()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Frontend Components`** (3 nodes): `ConfirmationModal()`, `ConfirmationModal.jsx`, `ConfirmationModal.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Plan Orchestration`** (3 nodes): `PlanCreatingLoader.jsx`, `PlanCreatingLoader.jsx`, `PlanCreatingLoader()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Calendar UI`** (3 nodes): `DetailedWeekView()`, `DetailedWeekView.jsx`, `DetailedWeekView.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Frontend Components`** (3 nodes): `TrainingPhasesView.jsx`, `TrainingPhasesView.jsx`, `TrainingPhasesView()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Frontend Components`** (3 nodes): `MonthView.jsx`, `MonthView.jsx`, `MonthView()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Design System`** (2 nodes): `JWT Authentication (24h expiry)`, `Strava Token Auto-Refresh with 5min Buffer`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Database Layer`** (1 nodes): `PostgreSQL Database`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Database Layer`** (1 nodes): `PostgreSQL Database Schema with 14 Tables`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `triggerOrchestration()` connect `Plan Orchestration` to `Community 2`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Why does `modify_plan_from_chat()` connect `Plan Orchestration` to `Activity Management`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Why does `chat_with_coach()` connect `Activity Management` to `Plan Orchestration`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Are the 8 inferred relationships involving `triggerOrchestration()` (e.g. with `getActiveGoal()` and `getMasterPlan()`) actually correct?**
  _`triggerOrchestration()` has 8 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `LangGraph Multi-Agent Plan Orchestration` (e.g. with `Python Server Dependencies (FastAPI, LangGraph, etc.)` and `AI Analysis Tests`) actually correct?**
  _`LangGraph Multi-Agent Plan Orchestration` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Request for plan orchestration via LangGraph`, `Request for chat-based plan interaction`, `Activity data for analysis` to the rest of the system?**
  _46 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Testing Framework` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._