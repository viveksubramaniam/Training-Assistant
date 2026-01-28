import React, { useState, useEffect } from 'react';
import DailyPlanTab from './DailyPlanTab';
import CalendarPage from './CalendarPage';
import ProfilePage from './ProfilePage';
import ActivityDetailPage from './ActivityDetailPage';
import ChatWidget from './components/ChatWidget';
import { Clock, RefreshCw, Zap, Award, Activity } from 'lucide-react';
import { API_BASE_URL } from './config/api';

/* -------------------------------------------------------------------------- */
/*                                Login Screen                                */
/* -------------------------------------------------------------------------- */
const LoginScreen = () => {
  return (
    <div className="h-screen flex flex-col items-center justify-center bg-background-dark relative overflow-hidden font-display">
      {/* Background Gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[100px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-[100px]"></div>

      <div className="relative z-10 flex flex-col items-center p-8 text-center max-w-sm">
        <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 border border-primary/20 shadow-[0_0_30px_rgba(249,116,21,0.2)]">
          <span className="material-symbols-outlined text-4xl text-primary">shadow</span>
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-white mb-2">ECLIPSE <span className="text-primary">AI</span></h1>
        <p className="text-slate-400 mb-12 text-lg font-medium">Your adaptive performance coach.</p>

        <a
          href={`${API_BASE_URL}/api/auth/strava/login`}
          className="w-full bg-[#ec4e06] hover:bg-[#d84605] text-white font-bold py-4 px-8 rounded-xl flex items-center justify-center gap-3 transition-transform active:scale-95 shadow-lg shadow-orange-900/20"
        >
          <img src="https://upload.wikimedia.org/wikipedia/commons/c/cb/Strava_Logo.png" alt="Strava" className="h-6 brightness-0 invert" />
          <span className="font-bold">Connect with Strava</span>
        </a>
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

  // Fetch initial data
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [userRes, activitiesRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/user`, { credentials: 'include' }),
          fetch(`${API_BASE_URL}/api/activities`, { credentials: 'include' })
        ]);

        if (userRes.ok) {
          const userData = await userRes.json();
          setUser(userData);
        } else {
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

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/activities/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullSync: false }),
        credentials: 'include'
      });
      if (res.ok) {
        // Refresh activities
        const actRes = await fetch(`${API_BASE_URL}/api/activities`, { credentials: 'include' });
        if (actRes.ok) setActivities(await actRes.json());
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
            <DailyPlanTab user={user} onNavigateToCalendar={() => setActiveTab('plan')} />
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
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors"
                >
                  <RefreshCw className={`w-5 h-5 text-primary ${syncing ? 'animate-spin' : ''}`} />
                </button>
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
        onPlanUpdate={() => handleSync()} // Refresh plan on update? Or refetch plan
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
