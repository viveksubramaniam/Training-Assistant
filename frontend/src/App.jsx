import React, { useState, useEffect } from 'react';
import DailyPlanTab from './DailyPlanTab';
import CalendarPage from './CalendarPage';
import ProfilePage from './ProfilePage';
import ActivityDetailPage from './ActivityDetailPage';
import ChatWidget from './components/ChatWidget';
import { Clock, RefreshCw, Zap, Award, Activity, Eye } from 'lucide-react';
import { API_BASE_URL } from './config/api';

import StravaLoginButton from './components/LoginButton';

const DEMO_USER_ID = 999999999;

/* -------------------------------------------------------------------------- */
/*                                Login Screen                                */
/* -------------------------------------------------------------------------- */
const LoginScreen = () => {
  const [demoLoading, setDemoLoading] = useState(false);

  const handleDemoLogin = async () => {
    setDemoLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/strava/demo-login`, { method: 'POST' });
      if (res.ok) {
        const { token } = await res.json();
        localStorage.setItem('authToken', token);
        window.location.reload();
      } else {
        console.error('Demo login failed');
        setDemoLoading(false);
      }
    } catch (err) {
      console.error('Demo login error:', err);
      setDemoLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-background-dark relative overflow-hidden font-display">
      {/* Background Gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[100px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-[100px]"></div>

      <div className="relative z-10 flex flex-col items-center p-8 text-center max-w-sm">
        <h1 className="text-4xl font-bold tracking-tight text-white mb-2">STRI<span className="text-primary">IVE</span></h1>
        <p className="text-slate-400 mb-12 text-lg font-medium">Your adaptive performance coach.</p>

        <StravaLoginButton onLogin={() => window.location.href = `${API_BASE_URL}/api/auth/strava/login`} />

        {/* Demo Login Button */}
        <button
          onClick={handleDemoLogin}
          disabled={demoLoading}
          className="mt-5 flex items-center gap-2 px-6 py-3 rounded-full bg-white/5 border border-white/10 text-white/60 text-sm font-medium hover:bg-white/10 hover:text-white hover:border-white/20 transition-all duration-300 backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Eye className="w-4 h-4" />
          {demoLoading ? 'Loading demo...' : 'Try Demo Account'}
        </button>

        <p className="mt-8 text-[10px] text-white/20 uppercase tracking-widest font-bold">Version 2.0.1 (Alpha)</p>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*                                 Main App                                   */
/* -------------------------------------------------------------------------- */

const App = () => {
  const [activeTab, setActiveTab] = useState('home'); // home, plan, stats, profile
  const [activities, setActivities] = useState([]);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [activityFilter, setActivityFilter] = useState('All');
  const [showChat, setShowChat] = useState(false); // Global chat state
  const [planVersion, setPlanVersion] = useState(0); // Increments to force DailyPlanTab re-render

  // Fetch initial data
  useEffect(() => {
    const fetchInitialData = async () => {
      // Check for token in URL (redirect from login)
      const urlParams = new URLSearchParams(window.location.search);
      const tokenFromUrl = urlParams.get('token');

      if (tokenFromUrl) {
        localStorage.setItem('authToken', tokenFromUrl);
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      const token = localStorage.getItem('authToken');

      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const headers = { 'Authorization': `Bearer ${token}` };

        const [userRes, activitiesRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/user`, { headers }),
          fetch(`${API_BASE_URL}/api/activities`, { headers })
        ]);

        if (userRes.ok) {
          const userData = await userRes.json();
          setUser(userData);
        } else {
          // Token invalid or expired
          localStorage.removeItem('authToken');
          setUser(null);
        }

        if (activitiesRes.ok) {
          const activityData = await activitiesRes.json();
          setActivities(activityData);
        }

      } catch (err) {
        console.error("Failed to load initial data", err);
        setError("Could not load application data");
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  const isDemo = user?.isDemo || false;

  const handleSync = async () => {
    if (isDemo) return; // Demo mode — sync disabled
    setSyncing(true);
    const token = localStorage.getItem('authToken');
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/activities/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ fullSync: false })
      });
      if (res.ok) {
        // Refresh activities (parallel refetch to save time)
        const [actRes, userRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/activities`, { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch(`${API_BASE_URL}/api/user`, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        if (actRes.ok) setActivities(await actRes.json());
        if (userRes.ok) setUser(await userRes.json());
      } else if (res.status === 401) {
        // Token refresh failed — user needs to re-authenticate
        localStorage.removeItem('authToken');
        setUser(null);
      }
    } catch (err) {
      console.error("Sync failed", err);
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background-dark text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
          <p className="animate-pulse text-white/50 text-sm">Initializing Coach...</p>
        </div>
      </div>
    );
  }

  // Show Login if no user
  if (!user || user.name === 'Guest') {
    // Redirect to login if not authenticated
    return <LoginScreen />;
  }

  return (
    <div className="flex flex-col h-screen bg-background-dark text-white overflow-hidden max-w-[450px] mx-auto shadow-2xl relative font-display">

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative bg-deep-slate">
        {activeTab === 'home' && (
          <div className="h-full overflow-y-auto hide-scrollbar pb-20">
            <DailyPlanTab key={planVersion} user={user} activities={activities} onNavigateToCalendar={() => setActiveTab('plan')} />
          </div>
        )}

        {activeTab === 'plan' && (
          <div className="h-full overflow-y-auto hide-scrollbar pb-20">
            <CalendarPage />
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="h-full overflow-y-auto hide-scrollbar pb-20">
            <ProfilePage user={user} activities={activities} />
          </div>
        )}

        {activeTab === 'stats' && (() => {
          // Stats view code (unchanged)
          const activityTypes = ['All', ...new Set(activities.map(a => a.type).filter(Boolean))];
          const filteredActivities = activityFilter === 'All'
            ? activities
            : activities.filter(a => a.type === activityFilter);

          return (
            <div className="h-full overflow-y-auto hide-scrollbar pb-20 p-4">
              <div className="flex items-center justify-between mb-4 pt-4">
                <h1 className="text-2xl font-bold uppercase tracking-tight">Activity Log</h1>
                {!isDemo && (
                  <button
                    onClick={handleSync}
                    disabled={syncing}
                    className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors"
                  >
                    <RefreshCw className={`w-5 h-5 text-primary ${syncing ? 'animate-spin' : ''}`} />
                  </button>
                )}
              </div>

              {/* Filter Bubbles */}
              <div className="flex gap-2 mb-4 overflow-x-auto hide-scrollbar pb-2">
                {activityTypes.map(type => (
                  <button
                    key={type}
                    onClick={() => setActivityFilter(type)}
                    className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all duration-200 ${activityFilter === type
                      ? 'bg-primary text-white shadow-lg shadow-primary/30'
                      : 'bg-slate-800/80 text-slate-300 border border-slate-700/50 hover:bg-slate-700/80 hover:text-white'
                      }`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                {filteredActivities.map(act => {
                  // Convert Strava data to display format
                  const dateStr = act.start_date || act.date;
                  const displayDate = dateStr ? new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
                  const distanceKm = act.distance ? (act.distance / 1000).toFixed(2) : '--';
                  const avgHr = act.average_heartrate ? Math.round(act.average_heartrate) : null;
                  const avgSpeed = act.average_speed || 0;
                  const avgPace = avgSpeed > 0 ? `${Math.floor(16.6667 / avgSpeed)}:${Math.round((16.6667 / avgSpeed % 1) * 60).toString().padStart(2, '0')}` : null;

                  return (
                    <div
                      key={act.id}
                      onClick={() => setSelectedActivity(act)}
                      className="glass-card p-4 rounded-xl flex justify-between items-center active:scale-95 transition-transform cursor-pointer hover:bg-white/5"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-white/10">
                          {act.type === 'Run' ? <Zap className="w-5 h-5 text-primary" /> : <Clock className="w-5 h-5 text-blue-400" />}
                        </div>
                        <div>
                          <h3 className="font-bold text-sm">{act.name}</h3>
                          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                            <span>{displayDate}</span>
                            <span>•</span>
                            <span className="text-primary">{distanceKm} km</span>
                            {avgPace && <><span>•</span><span>{avgPace}/km</span></>}
                            {avgHr && <><span>•</span><span className="text-rose-400">{avgHr} bpm</span></>}
                          </div>
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-white/20">chevron_right</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

      </div>

      {/* Activity Detail Modal Overlay */}
      {selectedActivity && (
        <div className="absolute inset-0 z-50 bg-background-dark animate-in slide-in-from-bottom duration-300">
          <ActivityDetailPage
            activity={selectedActivity}
            onClose={() => setSelectedActivity(null)}
          />
        </div>
      )}

      {/* Global Chat Widget Overlay */}
      <ChatWidget
        isOpen={showChat}
        onClose={() => setShowChat(false)}
        onPlanUpdate={() => {
          // Refetch user data & force DailyPlanTab re-render
          setPlanVersion(v => v + 1);
          const token = localStorage.getItem('authToken');
          if (token) {
            fetch(`${API_BASE_URL}/api/user`, { headers: { 'Authorization': `Bearer ${token}` } })
              .then(r => r.ok ? r.json() : null)
              .then(data => { if (data) setUser(data); });
          }
        }}
        onGoalChanged={() => {
          // Refetch user data & force DailyPlanTab re-render when goals change
          setPlanVersion(v => v + 1);
          const token = localStorage.getItem('authToken');
          if (token) {
            Promise.all([
              fetch(`${API_BASE_URL}/api/user`, { headers: { 'Authorization': `Bearer ${token}` } }),
              fetch(`${API_BASE_URL}/api/activities`, { headers: { 'Authorization': `Bearer ${token}` } })
            ]).then(async ([userRes, actRes]) => {
              if (userRes.ok) setUser(await userRes.json());
              if (actRes.ok) setActivities(await actRes.json());
            });
          }
        }}
      />

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 w-full max-w-[450px] h-16 bg-gradient-to-t from-[#0f172a] via-[#0f172a]/80 to-transparent backdrop-blur-[2px] z-40">
        <div className="grid grid-cols-5 h-full items-center">

          <button
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'home' ? 'text-primary' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <span className={`material-symbols-outlined text-[26px] ${activeTab === 'home' ? 'fill-1' : ''}`}>home</span>
          </button>

          <button
            onClick={() => setActiveTab('plan')}
            className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'plan' ? 'text-primary' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <span className={`material-symbols-outlined text-[26px] ${activeTab === 'plan' ? 'fill-1' : ''}`}>calendar_month</span>
          </button>

          {/* Center Chat FAB */}
          <div className="flex justify-center translate-y-2">
            <button
              onClick={() => setShowChat(!showChat)}
              className="w-11 h-11 rounded-full bg-primary/10 backdrop-blur-md flex items-center justify-center border border-primary/50 shadow-[0_0_15px_rgba(249,116,21,0.3)] hover:bg-primary/20 hover:scale-105 transition-all text-primary"
              title="Chat with AI Coach"
            >
              <span className="material-symbols-outlined text-[24px]">psychology</span>
            </button>
          </div>

          <button
            onClick={() => setActiveTab('stats')}
            className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'stats' ? 'text-primary' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <span className={`material-symbols-outlined text-[26px] ${activeTab === 'stats' ? 'fill-1' : ''}`}>monitoring</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'profile' ? 'text-primary' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <span className={`material-symbols-outlined text-[26px] ${activeTab === 'profile' ? 'fill-1' : ''}`}>person</span>
          </button>
        </div>
      </nav>

    </div>
  );
}

export default App;
