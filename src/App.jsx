import React, { useState, useEffect } from 'react';
import { Calendar, Activity, TrendingUp, User, ChevronRight, Clock, Zap, CheckCircle, Circle, MessageSquare, Target, Flame, RefreshCw, X, Trophy, Map as MapIcon, LogOut, Settings, ChevronUp, ArrowLeft, Heart, Battery, Sparkles } from 'lucide-react';
import ActivityDetailPage from './ActivityDetailPage';
import DailyPlanTab from './DailyPlanTab';
import GoalEditorModal from './GoalEditorModal';
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ResponsiveContainer } from 'recharts';
import 'leaflet/dist/leaflet.css';
import polyline from '@mapbox/polyline';

// Fix Leaflet icon issue
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

/* -------------------------------------------------------------------------- */
/*                            Animations & Components                         */
/* -------------------------------------------------------------------------- */
const SparklesLoader = () => (
  <div className="flex flex-col items-center justify-center py-12 space-y-4">
    <div className="relative">
      <div className="w-16 h-16 border-4 border-[#818CF8]/30 rounded-full animate-pulse"></div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-10 h-10 animate-spin-slow">
          <Zap className="w-6 h-6 text-[#f97415] absolute -top-2 -left-2 animate-bounce" />
          <Target className="w-5 h-5 text-[#818CF8] absolute -bottom-2 -right-2 animate-pulse" />
          <Flame className="w-5 h-5 text-[#f97415] absolute top-0 right-0 animate-bounce delay-75" />
          <Trophy className="w-4 h-4 text-amber-500 absolute bottom-0 left-0 animate-pulse delay-150" />
        </div>


      </div>


    </div>


    <div className="text-center">
      <h3 className="text-lg font-semibold text-white animate-pulse">AI Coach is thinking...</h3>
      <p className="text-sm text-slate-400">Analyzing your heart rate zones and pace consistency</p>
    </div>


  </div>
);


/* ... (ActivityDetail component replacement below) ... */
const formatDuration = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m}:${s.toString().padStart(2, '0')}`;
}

const formatPace = (seconds, km) => {
  if (km === 0) return '0:00';
  const paceSeconds = seconds / km;
  const m = Math.floor(paceSeconds / 60);
  const s = Math.floor(paceSeconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/* -------------------------------------------------------------------------- */
/*                             Activity Detail                                */
/* -------------------------------------------------------------------------- */
const ActivityMap = ({ mapPolyline }) => {
  if (!mapPolyline) return <div className="h-64 bg-slate-800 rounded-xl flex items-center justify-center text-slate-500 border border-white/10">No map data available</div>;

  const positions = polyline.decode(mapPolyline);
  const center = positions[Math.floor(positions.length / 2)];

  // Component to auto-fit bounds
  const Recenter = ({ positions }) => {
    const map = useMap();
    useEffect(() => {
      if (positions.length > 0) {
        map.fitBounds(positions);
      }
    }, [positions, map]);
    return null;
  };

  return (
    <div className="h-64 w-full rounded-xl overflow-hidden shadow-sm border border-white/10 z-0 relative">
      <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false}>
        <TileLayer
          url="https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://stadiamaps.com/">Stadia</a>'
        />
        <Polyline positions={positions} color="#f97415" weight={4} opacity={0.9} />
        <Recenter positions={positions} />
      </MapContainer>
    </div>



  );
};

const ActivityDetail = ({ activity, onClose }) => {
  console.log('ActivityDetail mounted/rendered for activity:', activity.id);

  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview'); // overview, zones, coach
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState(null);
  const [activeVersion, setActiveVersion] = useState(1);
  const [regenerating, setRegenerating] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [versionToSelect, setVersionToSelect] = useState(null);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const res = await fetch(`/api/activities/${activity.id}`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setDetails(data);
        }
      } catch (err) {
        console.error("Failed to load activity details", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [activity.id]);

  // Common function to prepare activity data for AI
  const prepareActivityData = () => {
    // Calculate HR zone percentages from zones data (if details available)
    let hrZonePercentages = null;
    if (details?.zones && details.zones.length > 0) {
      const hrZone = details.zones.find(z => z.type === 'heartrate');
      if (hrZone && hrZone.distribution_buckets) {
        const totalTime = hrZone.distribution_buckets.reduce((sum, b) => sum + b.time, 0);
        hrZonePercentages = hrZone.distribution_buckets.map(bucket => ({
          zone: bucket.max,
          percentage: totalTime > 0 ? ((bucket.time / totalTime) * 100).toFixed(1) : 0,
          time: bucket.time
        }));
      }
    }

    // Calculate pace zones from streams
    let paceZones = null;
    if (details?.streams?.velocity_smooth?.data) {
      const speeds = details.streams.velocity_smooth.data;
      const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
      const paces = speeds.map(s => s > 0 ? 1000 / (s * 60) : 0); // min/km

      const zones = {
        easy: paces.filter(p => p > avgSpeed * 1.1).length,
        moderate: paces.filter(p => p >= avgSpeed * 0.95 && p <= avgSpeed * 1.1).length,
        tempo: paces.filter(p => p < avgSpeed * 0.95).length
      };
      const total = paces.length;
      paceZones = {
        easy: ((zones.easy / total) * 100).toFixed(1),
        moderate: ((zones.moderate / total) * 100).toFixed(1),
        tempo: ((zones.tempo / total) * 100).toFixed(1)
      };
    }

    return {
      ...activity,
      id: String(activity.id),
      elevation: String(activity.elevation),
      title: activity.raw?.name || 'Running Activity',
      hrZonePercentages,
      paceZones,
      movingTime: activity.raw?.moving_time,
      sufferScore: activity.raw?.suffer_score,
      averageCadence: activity.raw?.average_cadence,
      maxHeartrate: activity.raw?.max_heartrate
    };
  };

  // Common function to generate AI summary
  const generateSummary = async (isRegeneration = false) => {
    const activityDataForAI = prepareActivityData();
    if (!activityDataForAI) {
      setAnalysisError('Activity details not loaded yet');
      return;
    }
    if (isRegeneration) {
      setRegenerating(true);
    } else {
      setAnalyzing(true);
    }
    setAnalysisError(null);

    try {
      const endpoint = isRegeneration
        ? `/api/activities/${activity.id}/analysis/regenerate`
        : `/api/activities/${activity.id}/analysis`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityData: activityDataForAI })
      });

      if (response.ok) {
        const data = await response.json();
        setAnalysis(data);
        if (isRegeneration && data.versions) {
          setActiveVersion(data.versions.length); // Switch to newest version
        }
      } else {
        const errData = await response.json();
        console.error('Analysis error:', errData);

        if (errData.detail && Array.isArray(errData.detail)) {
          const errorMessages = errData.detail.map(err => `${err.loc.join('.')}: ${err.msg}`).join(', ');
          setAnalysisError(`Validation error: ${errorMessages}`);
        } else {
          setAnalysisError(errData.error || errData.detail || 'Failed to generate analysis');
        }
      }
    } catch (err) {
      console.error('Analysis exception:', err);
      setAnalysisError('Server connection error. Is the Python AI service running?');
    } finally {
      if (isRegeneration) {
        setRegenerating(false);
      } else {
        setAnalyzing(false);
      }
    }
  };

  // Initial analysis check and generation
  useEffect(() => {
    const handleAnalysis = async () => {
      try {
        const checkRes = await fetch(`/api/activities/${activity.id}/analysis`);
        if (checkRes.ok) {
          const data = await checkRes.json();
          setAnalysis(data);
        } else {
          await generateSummary(false);
        }
      } catch (err) {
        console.error('Analysis check error:', err);
        setAnalysisError('Failed to check for existing analysis');
      }
    };

    if (activeTab === 'coach' && !analysis && !analyzing && !analysisError) {
      handleAnalysis();
    }
  }, [activeTab, activity.id, analysis, analyzing, analysisError]);

  // Handle regeneration
  const handleRegenerate = async () => {
    await generateSummary(true);
  };


  // Handle version selection
  const handleSelectVersion = async (versionNumber) => {
    try {
      const response = await fetch(`/api/activities/${activity.id}/analysis/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionNumber })
      });

      if (response.ok) {
        const data = await response.json();
        setAnalysis(data);
        setActiveVersion(versionNumber);
        setShowConfirmModal(false);
      } else {
        setAnalysisError('Failed to select version');
      }
    } catch (err) {
      console.error('Selection error:', err);
      setAnalysisError('Failed to select version');
    }
  };

  if (!activity) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-card w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-[#0f172a]/95 backdrop-blur-md p-6 border-b border-white/10 flex items-center justify-between z-10 shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-white">{activity.raw?.name || activity.type}</h2>
            <p className="text-sm text-slate-400 flex items-center gap-2 mt-1">
              <Calendar className="w-4 h-4" />
              {activity.date}
            </p>
          </div>


          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-6 h-6 text-slate-400" />
          </button>
        </div>



        {/* Tabs */}
        <div className="flex border-b border-white/10 px-6 shrink-0 bg-[#0f172a]/50">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-4 px-5 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'overview' ? 'border-[#f97415] text-[#f97415]' : 'border-transparent text-slate-400 hover:text-white'}`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('zones')}
            className={`py-4 px-5 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'zones' ? 'border-[#f97415] text-[#f97415]' : 'border-transparent text-slate-400 hover:text-white'}`}
          >
            Zones & Analysis
          </button>
          <button
            onClick={() => setActiveTab('coach')}
            className={`py-4 px-5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'coach' ? 'border-[#f97415] text-[#f97415]' : 'border-transparent text-slate-400 hover:text-white'}`}
          >
            <Flame className="w-4 h-4" />
            AI Coach
          </button>
        </div>



        <div className="p-6 space-y-8 overflow-y-auto grow">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Map with glassmorphism overlay */}
              {details && details.map && (
                <div className="relative">
                  <ActivityMap mapPolyline={details.map.summary_polyline || details.map.polyline} />
                  {/* Floating Metric Bar */}
                  <div className="absolute -bottom-6 left-4 right-4 glass-metric rounded-xl p-4 flex justify-around items-center">
                    <div className="text-center">
                      <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">Elevation</p>
                      <p className="text-xl font-bold text-white">{activity.elevation}<span className="text-slate-400 text-xs ml-1">m</span></p>
                    </div>


                    <div className="w-px h-10 bg-white/10" />
                    <div className="text-center">
                      <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">Avg HR</p>
                      <p className="text-xl font-bold text-white">{activity.heartRate}<span className="text-slate-400 text-xs ml-1">bpm</span></p>
                    </div>


                    <div className="w-px h-10 bg-white/10" />
                    <div className="text-center">
                      <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">Calories</p>
                      <p className="text-xl font-bold text-[#f97415]">{activity.raw?.calories || '--'}<span className="text-slate-400 text-xs ml-1">kcal</span></p>
                    </div>


                  </div>


                </div>


              )}

              {/* Quick Stats Grid */}
              <div className="grid grid-cols-3 gap-4 mt-12">
                <div className="glass-card p-5 rounded-xl border-l-4 border-l-[#f97415]">
                  <div className="flex justify-between items-start">
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Distance</p>
                    <Zap className="w-4 h-4 text-[#f97415]" />
                  </div>


                  <p className="text-3xl font-black text-white mt-2">{activity.distance}</p>
                  <p className="text-xs text-slate-500 mt-1">kilometers</p>
                </div>


                <div className="glass-card p-5 rounded-xl border-l-4 border-l-emerald-500">
                  <div className="flex justify-between items-start">
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Avg Pace</p>
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                  </div>


                  <p className="text-3xl font-black text-white mt-2">{activity.pace}</p>
                  <p className="text-xs text-slate-500 mt-1">per kilometer</p>
                </div>


                <div className="glass-card p-5 rounded-xl border-l-4 border-l-blue-500">
                  <div className="flex justify-between items-start">
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Time</p>
                    <Clock className="w-4 h-4 text-blue-500" />
                  </div>


                  <p className="text-3xl font-black text-white mt-2">{activity.duration}</p>
                  <p className="text-xs text-slate-500 mt-1">moving time</p>
                </div>


              </div>



              {/* Secondary Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="glass-card rounded-xl p-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/20">
                      <TrendingUp className="w-5 h-5 text-emerald-500" />
                    </div>


                    <div>
                      <p className="text-slate-400 text-xs">Elevation Gain</p>
                      <p className="text-lg font-bold text-white">{activity.elevation} m</p>
                    </div>


                  </div>


                </div>


                <div className="glass-card rounded-xl p-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-rose-500/20">
                      <Activity className="w-5 h-5 text-rose-500" />
                    </div>


                    <div>
                      <p className="text-slate-400 text-xs">Avg Heart Rate</p>
                      <p className="text-lg font-bold text-white">{activity.heartRate} bpm</p>
                    </div>


                  </div>


                </div>


              </div>


            </div>


          )}


          {/* Zones Tab */}
          {activeTab === 'zones' && (
            <div className="space-y-6">
              {loading ? (
                <div className="flex justify-center py-10">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#f97415]"></div>
                </div>


              ) : details && details.streams ? (
                <>
                  {/* Heart Rate Chart */}
                  {details.streams.heartrate && details.streams.heartrate.data && (
                    <div className="glass-card rounded-xl p-6">
                      <h3 className="font-bold text-lg mb-4 text-white flex items-center gap-2">
                        <Activity className="w-5 h-5 text-rose-500" />
                        Heart Rate Over Time
                      </h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={(() => {
                          const timeData = details.streams.time?.data || [];
                          const hrData = details.streams.heartrate?.data || [];
                          return timeData.map((t, i) => ({
                            time: Math.floor(t / 60), // Convert to minutes
                            heartrate: hrData[i] || 0
                          }));
                        })()}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="time"
                            label={{ value: 'Time (min)', position: 'insideBottom', offset: -5 }}
                          />
                          <YAxis
                            label={{ value: 'Heart Rate (bpm)', angle: -90, position: 'insideLeft' }}
                          />
                          <Tooltip />
                          <Legend />
                          <ReferenceLine
                            y={activity.heartRate !== 'N/A' ? activity.heartRate : null}
                            stroke="#ff6b6b"
                            strokeDasharray="5 5"
                            label="Avg"
                          />
                          <Line
                            type="monotone"
                            dataKey="heartrate"
                            stroke="#ef4444"
                            dot={false}
                            name="Heart Rate"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>


                  )}

                  {/* Pace Chart */}
                  {details.streams.velocity_smooth && details.streams.velocity_smooth.data && (
                    <div className="glass-card rounded-xl p-6">
                      <h3 className="font-bold text-lg mb-4 text-white flex items-center gap-2">
                        <Zap className="w-5 h-5 text-emerald-500" />
                        Pace Over Time
                      </h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={(() => {
                          const timeData = details.streams.time?.data || [];
                          const velocityData = details.streams.velocity_smooth?.data || [];
                          // Convert m/s to min/km: pace = 1000 / (velocity * 60)
                          return timeData.map((t, i) => {
                            const velocity = velocityData[i];
                            const paceMinPerKm = velocity > 0 ? (1000 / 60) / velocity : 0;
                            return {
                              time: Math.floor(t / 60),
                              pace: paceMinPerKm
                            };
                          });
                        })()}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="time"
                            label={{ value: 'Time (min)', position: 'insideBottom', offset: -5 }}
                          />
                          <YAxis
                            reversed
                            label={{ value: 'Pace (min/km)', angle: -90, position: 'insideLeft' }}
                          />
                          <Tooltip
                            formatter={(value) => {
                              const mins = Math.floor(value);
                              const secs = Math.floor((value - mins) * 60);
                              return `${mins}:${secs.toString().padStart(2, '0')}`;
                            }}
                          />
                          <Legend />
                          <ReferenceLine
                            y={(() => {
                              // Calculate average pace from activity.pace (format: "M:SS")
                              const [m, s] = activity.pace.split(':').map(Number);
                              return m + (s / 60);
                            })()}
                            stroke="#3b82f6"
                            strokeDasharray="5 5"
                            label="Avg"
                          />
                          <Line
                            type="monotone"
                            dataKey="pace"
                            stroke="#3b82f6"
                            dot={false}
                            name="Pace"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>


                  )}

                  {/* Heart Rate Zone Summary with Gradient Bar */}
                  {details && details.zones && details.zones.length > 0 && (
                    <div className="glass-card rounded-xl p-6">
                      <h3 className="font-bold text-lg mb-6 text-white flex items-center gap-2">
                        <Activity className="w-5 h-5 text-rose-500" />
                        Heart Rate Zone Distribution
                      </h3>
                      {/* HR Gradient Bar with Average Marker */}
                      <div className="mb-6">
                        <div className="relative">
                          {/* HR Bar */}
                          <div className="h-6 w-full rounded-full hr-gradient flex overflow-hidden">
                            {details.zones.find(z => z.type === 'heartrate')?.distribution_buckets?.map((bucket, idx) => (
                              <div
                                key={idx}
                                className="h-full border-r border-slate-900/30 last:border-r-0"
                                style={{ width: `${(bucket.time / activity.raw.moving_time * 100) || 0}%` }}
                              />
                            ))}
                          </div>


                          {/* Average HR Marker */}
                          {activity.heartRate && activity.heartRate !== 'N/A' && (() => {
                            // Calculate position of average HR on the gradient
                            const hrZone = details.zones.find(z => z.type === 'heartrate');
                            if (!hrZone) return null;
                            const buckets = hrZone.distribution_buckets || [];
                            const minHR = buckets[0]?.min || 100;
                            const maxHR = buckets[buckets.length - 1]?.max || 200;
                            const avgHR = parseInt(activity.heartRate);
                            // Clamp between 0 and 100
                            const position = Math.min(100, Math.max(0, ((avgHR - minHR) / (maxHR === -1 ? 220 - minHR : maxHR - minHR)) * 100));
                            return (
                              <div
                                className="absolute top-0 transform -translate-x-1/2"
                                style={{ left: `${position}%` }}
                              >
                                {/* Pointer Arrow */}
                                <div className="flex flex-col items-center">
                                  <div className="w-0 h-0 border-l-[8px] border-r-[8px] border-t-[10px] border-l-transparent border-r-transparent border-t-white drop-shadow-lg"></div>
                                  <div className="h-8 w-1 bg-white/80 rounded-b-full"></div>
                                </div>


                                {/* Average Label */}
                                <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                                  <span className="text-[10px] font-bold text-white bg-slate-800/80 px-2 py-0.5 rounded-full">
                                    AVG {avgHR} bpm
                                  </span>
                                </div>


                              </div>


                            );
                          })()}
                        </div>


                      </div>


                      <div className="space-y-3">
                        {details.zones.map((zone) => {
                          if (zone.type === 'heartrate') {
                            return zone.distribution_buckets.map((bucket, idx) => {
                              const zoneColors = ['text-blue-400', 'text-emerald-400', 'text-yellow-400', 'text-orange-400', 'text-rose-500'];
                              const bgColors = ['bg-blue-500', 'bg-emerald-500', 'bg-yellow-500', 'bg-orange-500', 'bg-rose-500'];
                              return (
                                <div key={idx} className="flex justify-between items-center text-sm">
                                  <div className="flex items-center gap-2">
                                    <span className={`size-2 rounded-full ${bgColors[idx]}`}></span>
                                    <span className="text-slate-400 font-mono">Z{idx + 1}</span>
                                    <span className="text-slate-500 text-xs">({bucket.min}-{bucket.max === -1 ? '>' : bucket.max} bpm)</span>
                                  </div>


                                  <span className={`font-mono font-bold ${zoneColors[idx]}`}>{formatDuration(bucket.time)}</span>
                                </div>


                              );
                            });
                          }
                          return null;
                        })}
                      </div>


                    </div>


                  )}
                </>
              ) : (
                <div className="text-center text-slate-500 py-10">No detailed stream data available.</div>
              )}
            </div>


          )}

          {/* Coach Tab */}
          {activeTab === 'coach' && (
            <div className="space-y-6">
              {analyzing ? (
                <SparklesLoader />
              ) : analysisError ? (
                <div className="glass-card rounded-xl p-6 text-center border border-rose-500/20">
                  <Flame className="w-10 h-10 text-rose-500 mx-auto mb-4" />
                  <h3 className="font-bold text-white">Analysis Unavailable</h3>
                  <p className="text-rose-400 text-sm mb-4">{analysisError}</p>
                  <button
                    onClick={() => { setAnalysisError(null); }}
                    className="text-white bg-rose-600 hover:bg-rose-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Try Again
                  </button>
                </div>


              ) : analysis ? (
                <div className="ai-pulse-border">
                  <div className="glass-card rounded-xl overflow-hidden">
                    {/* Header with gradient */}
                    <div className="bg-gradient-to-r from-[#818CF8] to-[#4f46e5] p-6 text-white">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center">
                            <Flame className="w-7 h-7" />
                          </div>


                          <div>
                            <h3 className="font-bold text-xl">AI Coach Insight</h3>
                            <p className="text-white/70 text-xs">
                              {analysis.versions ? `${analysis.versions.length} version${analysis.versions.length > 1 ? 's' : ''}` : 'Generated'} by {analysis.versions?.[activeVersion - 1]?.model || 'Local LLM'}
                            </p>
                          </div>


                        </div>



                        {/* Action Buttons */}
                        <div className="flex gap-2">
                          {/* Regenerate Button (creates versions) */}
                          {(!analysis.selectedVersion && (!analysis.versions || analysis.versions.length < 3)) && (
                            <button
                              onClick={handleRegenerate}
                              disabled={regenerating}
                              className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                              <RefreshCw className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
                              {regenerating ? 'Generating...' : `Regenerate (${3 - (analysis.versions?.length || 1)} left)`}
                            </button>
                          )}

                          {/* Replace Summary Button (overwrites) */}
                          <button
                            onClick={async () => {
                              if (confirm('This will delete the current summary and generate a new one. Continue?')) {
                                try {
                                  // Delete old summary
                                  await fetch(`/api/activities/${activity.id}/analysis`, {
                                    method: 'DELETE',
                                    credentials: 'include'
                                  });
                                  // Clear state and regenerate
                                  setAnalysis(null);
                                  setActiveVersion(1);
                                  await generateSummary(false);
                                } catch (err) {
                                  console.error('Replace failed:', err);
                                  setAnalysisError('Failed to replace summary');
                                }
                              }
                            }}
                            disabled={analyzing || regenerating}
                            className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2 text-rose-300"
                          >
                            <X className="w-4 h-4" />
                            Replace
                          </button>
                        </div>


                      </div>


                    </div>



                    {/* Version Tabs */}
                    {analysis.versions && analysis.versions.length > 1 && !analysis.selectedVersion && (
                      <div className="flex gap-2 px-6 py-3 bg-slate-900/50 border-b border-white/10">
                        {analysis.versions.map((v) => (
                          <button
                            key={v.versionNumber}
                            onClick={() => setActiveVersion(v.versionNumber)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeVersion === v.versionNumber
                              ? 'bg-[#818CF8] text-white'
                              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                              }`}
                          >
                            V{v.versionNumber}
                          </button>
                        ))}
                      </div>


                    )}

                    <div className="p-8">
                      {(() => {
                        // Get the active version data
                        const currentVersion = analysis.versions
                          ? analysis.versions.find(v => v.versionNumber === activeVersion) || analysis.versions[0]
                          : analysis;

                        const versionText = currentVersion.text || analysis.text;

                        try {
                          const analysisData = JSON.parse(versionText);

                          // Check if it's structured JSON or plain text
                          if (analysisData.runType && analysisData.relativeEffort) {
                            return (
                              <div className="space-y-6">
                                {/* Badges for Run Type and Effort */}
                                <div className="flex gap-3 flex-wrap">
                                  <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#818CF8]/20 text-[#818CF8] rounded-full font-bold text-[10px] uppercase tracking-widest border border-[#818CF8]/30 badge-glow-indigo">
                                    <Activity className="w-3.5 h-3.5" />
                                    {analysisData.runType}
                                  </span>
                                  <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full font-bold text-[10px] uppercase tracking-widest border ${analysisData.relativeEffort === 'Low' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 badge-glow-emerald' :
                                    analysisData.relativeEffort === 'Moderate' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30 badge-glow-amber' :
                                      analysisData.relativeEffort === 'High' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
                                        'bg-rose-500/20 text-rose-400 border-rose-500/30'
                                    }`}>
                                    <Flame className="w-3.5 h-3.5" />
                                    {analysisData.relativeEffort} Effort
                                  </span>
                                </div>



                                {/* Performance Insights */}
                                <div>
                                  <h4 className="text-lg font-bold text-white mb-4">Performance Insights</h4>
                                  <p className="text-slate-400 leading-relaxed">{analysisData.summary}</p>
                                </div>



                                {/* Highlight */}
                                <div className="glass-card rounded-xl p-5 border-l-4 border-l-emerald-500">
                                  <h4 className="font-bold text-emerald-400 mb-2 flex items-center gap-2">
                                    <Trophy className="w-4 h-4" />
                                    Highlight
                                  </h4>
                                  <p className="text-slate-300">{analysisData.highlight}</p>
                                </div>



                                {/* Suggestion */}
                                <div className="glass-card rounded-xl p-5 border-l-4 border-l-[#f97415]">
                                  <h4 className="font-bold text-[#f97415] mb-2 flex items-center gap-2">
                                    <Target className="w-4 h-4" />
                                    Suggestion
                                  </h4>
                                  <p className="text-slate-300">{analysisData.suggestion}</p>
                                </div>


                              </div>


                            );
                          } else if (analysisData.text) {
                            // Fallback to plain text
                            return (
                              <div className="prose prose-invert max-w-none">
                                {analysisData.text.split('\n').map((line, i) => (
                                  <p key={i} className="text-slate-400 leading-relaxed mb-4 last:mb-0">
                                    {line}
                                  </p>
                                ))}
                              </div>


                            );
                          }
                        } catch (e) {
                          // If JSON parsing fails, display as plain text
                          return (
                            <div className="prose prose-invert max-w-none">
                              {analysis.text.split('\n').map((line, i) => (
                                <p key={i} className="text-slate-400 leading-relaxed mb-4 last:mb-0">
                                  {line}
                                </p>
                              ))}
                            </div>


                          );
                        }
                      })()}

                      {/* Choose Version Button */}
                      {analysis.versions && analysis.versions.length > 1 && !analysis.selectedVersion && (
                        <div className="mt-6 pt-6 border-t border-white/10">
                          <button
                            onClick={() => {
                              setVersionToSelect(activeVersion);
                              setShowConfirmModal(true);
                            }}
                            className="w-full px-6 py-3 bg-[#818CF8] hover:bg-[#6366f1] text-white rounded-lg font-medium transition-colors"
                          >
                            Choose This Version (V{activeVersion})
                          </button>
                          <p className="text-xs text-slate-500 text-center mt-2">
                            Other versions will be permanently deleted
                          </p>
                        </div>


                      )}

                      <div className="mt-8 pt-8 border-t border-white/10 flex items-center justify-between text-xs text-slate-500">
                        <span>Analyzed on {new Date(analysis.versions?.[activeVersion - 1]?.generatedAt || analysis.generatedAt).toLocaleDateString()}</span>
                        <div className="flex gap-2">
                          <span className="px-2 py-1 bg-slate-800 rounded text-slate-400">Running Expert</span>
                          <span className="px-2 py-1 bg-slate-800 rounded text-slate-400">Local AI</span>
                        </div>


                      </div>


                    </div>


                  </div>


                </div>


              ) : (
                <div className="text-center py-20">
                  <p className="text-slate-500">Preparing analysis...</p>
                </div>


              )}
            </div>


          )}

        </div>


      </div>



      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Confirm Version Selection</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to keep Version {versionToSelect}? All other versions will be permanently deleted.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSelectVersion(versionToSelect)}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Confirm
              </button>
            </div>


          </div>


        </div>


      )}
    </div>



  );
};


class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-red-50 text-red-900">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-2xl w-full">
            <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
            <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
              {this.state.error && this.state.error.toString()}
            </pre>
          </div>


        </div>


      );
    }

    return this.props.children;
  }
}

const RunCoachAppContent = () => {
  const [activeTab, setActiveTab] = useState('daily-plan');
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [viewMode, setViewMode] = useState('tabs'); // 'tabs' | 'activity-detail'
  const [aiAnalysisCache, setAiAnalysisCache] = useState({});
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [user, setUser] = useState(null);
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [goalEditorOpen, setGoalEditorOpen] = useState(false);
  const [currentGoal, setCurrentGoal] = useState(null);
  const [activityDetails, setActivityDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      console.log('Checking authentication status...');
      try {
        const res = await fetch('/api/user', { credentials: 'include' });
        console.log('Auth response status:', res.status);
        if (res.ok) {
          const userData = await res.json();
          console.log('User authenticated:', userData);
          setUser(userData);
          fetchActivities();
        } else {
          console.log('User not authenticated');
          setIsLoading(false);
        }
      } catch (err) {
        console.error("Auth check failed", err);
        setIsLoading(false);
      }
    };
    checkAuth();
  }, []);

  // Fetch goal data
  useEffect(() => {
    const fetchGoal = async () => {
      try {
        const res = await fetch('/api/goals', { credentials: 'include' });
        if (res.ok) setCurrentGoal(await res.json());
      } catch (err) {
        console.error('Failed to fetch goal:', err);
      }
    };
    if (user) fetchGoal();
  }, [user]);

  // Handle viewActivity event from DailyPlanTab
  useEffect(() => {
    const handleViewActivity = (event) => {
      const activity = event.detail;
      if (activity) {
        // Format and show activity detail
        const formatted = {
          id: activity.strava_activity_id || activity.id,
          date: new Date(activity.start_date).toLocaleDateString(),
          distance: (activity.distance / 1000).toFixed(2),
          duration: formatDuration(activity.moving_time),
          pace: formatPace(activity.moving_time, activity.distance / 1000),
          elevation: activity.total_elevation_gain,
          heartRate: activity.average_heartrate ? Math.round(activity.average_heartrate) : 'N/A',
          type: activity.sport_type || activity.type,
          raw: activity
        };
        setSelectedActivity(formatted);
        setViewMode('activity-detail');
      }
    };
    window.addEventListener('viewActivity', handleViewActivity);
    return () => window.removeEventListener('viewActivity', handleViewActivity);
  }, []);



  // Fetch activity details when selected
  useEffect(() => {
    if (!selectedActivity) return;

    const fetchDetails = async () => {
      setLoadingDetails(true);
      try {
        const res = await fetch(`/api/activities/${selectedActivity.id}`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setActivityDetails(data);
        } else {
          // Fallback to summary data if detailed fetch fails (e.g. 404 from Strava)
          console.warn("Falling back to summary data due to fetch error");
          setActivityDetails({
            ...selectedActivity.raw,
            isFallback: true,
            map: selectedActivity.raw.map, // Ensure map is preserved if present
            streams: {}, // No streams available
            zones: []    // No zones available
          });
        }
      } catch (err) {
        console.error("Failed to load activity details", err);
        // Fallback on network error too
        setActivityDetails({
          ...selectedActivity.raw,
          isFallback: true,
          map: selectedActivity.raw.map,
          streams: {},
          zones: []
        });
      } finally {
        setLoadingDetails(false);
      }
    };
    fetchDetails();
  }, [selectedActivity]);

  const getLatestAnalysis = (data) => {
    if (!data) return null;
    if (data.summary && !data.versions) return data;

    if (data.versions && data.versions.length > 0) {
      const v = data.selectedVersion
        ? data.versions.find(v => v.versionNumber === data.selectedVersion)
        : data.versions[data.versions.length - 1];

      if (v && v.text) {
        try {
          return JSON.parse(v.text);
        } catch (e) {
          console.error("Failed to parse AI analysis version", e);
          return null;
        }
      }
    }
    return null;
  };

  // Common function to prepare activity data for AI
  const prepareActivityData = (act, details) => {
    // Calculate HR zone percentages
    let hrZonePercentages = null;
    if (details?.zones && details.zones.length > 0) {
      const hrZone = details.zones.find(z => z.type === 'heartrate');
      if (hrZone && hrZone.distribution_buckets) {
        const totalTime = hrZone.distribution_buckets.reduce((sum, b) => sum + b.time, 0);
        hrZonePercentages = hrZone.distribution_buckets.map(bucket => ({
          zone: bucket.max,
          percentage: totalTime > 0 ? ((bucket.time / totalTime) * 100).toFixed(1) : 0,
          time: bucket.time
        }));
      }
    }

    // Calculate pace zones
    let paceZones = null;
    if (details?.streams?.velocity_smooth?.data) {
      const speeds = details.streams.velocity_smooth.data;
      const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
      const paces = speeds.map(s => s > 0 ? 1000 / (s * 60) : 0);
      const zones = {
        easy: paces.filter(p => p > avgSpeed * 1.1).length,
        moderate: paces.filter(p => p >= avgSpeed * 0.95 && p <= avgSpeed * 1.1).length,
        tempo: paces.filter(p => p < avgSpeed * 0.95).length
      };
      const total = paces.length;
      paceZones = {
        easy: ((zones.easy / total) * 100).toFixed(1),
        moderate: ((zones.moderate / total) * 100).toFixed(1),
        tempo: ((zones.tempo / total) * 100).toFixed(1)
      };
    }

    return {
      ...act,
      id: String(act.id),
      elevation: String(act.elevation),
      title: act.raw?.name || 'Running Activity',
      hrZonePercentages,
      paceZones,
      movingTime: act.raw?.moving_time,
      sufferScore: act.raw?.suffer_score,
      averageCadence: act.raw?.average_cadence,
      maxHeartrate: act.raw?.max_heartrate
    };
  };

  const handleAnalyzeActivity = async (activity, details) => {
    if (!activity || !details) return;

    setLoadingAnalysis(true);
    const activityDataForAI = prepareActivityData(activity, details);

    try {
      const response = await fetch(`/api/activities/${activity.id}/analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityData: activityDataForAI })
      });

      if (response.ok) {
        const data = await response.json();
        setAiAnalysisCache(prev => {
          const newCache = { ...prev, [activity.id]: data };
          localStorage.setItem('ai-analysis-cache', JSON.stringify(newCache));
          return newCache;
        });
      }
    } catch (err) {
      console.error('Analysis failed:', err);
    } finally {
      setLoadingAnalysis(false);
    }
  };

  // Load cached analyses
  useEffect(() => {
    const loadCache = async () => {
      try {
        const result = localStorage.getItem('ai-analysis-cache');
        if (result) {
          setAiAnalysisCache(JSON.parse(result));
        }
      } catch (err) {
        console.log('No cached analyses found');
      }
    };
    loadCache();
  }, []);

  const fetchActivities = async () => {
    console.log('Fetching activities...');
    try {
      const res = await fetch('/api/activities', { credentials: 'include' });
      console.log('Activities response status:', res.status);
      if (res.ok) {
        const data = await res.json();
        console.log('Activities fetched:', data.length);

        const formatted = data.map(a => ({
          id: a.id,
          date: new Date(a.start_date).toLocaleDateString(),
          distance: (a.distance / 1000).toFixed(2),
          duration: formatDuration(a.moving_time),
          pace: formatPace(a.moving_time, a.distance / 1000),
          elevation: a.total_elevation_gain,
          heartRate: a.average_heartrate ? Math.round(a.average_heartrate) : 'N/A',
          type: a.type,
          raw: a
        }));
        setActivities(formatted);
      }
    } catch (err) {
      console.error("Failed to fetch activities", err);
    } finally {
      setIsLoading(false);
    }
  }

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/activities/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullSync: true }),
        credentials: 'include'
      });
      const data = await res.json();
      console.log('Sync Result:', data);
      if (data.success) {
        // Refresh local user data and activities
        const userRes = await fetch('/api/user', { credentials: 'include' });
        const userData = await userRes.json();
        setUser(userData);
        await fetchActivities();
        console.log(`✓ Sync complete: ${data.count} activities`);
      }
    } catch (err) {
      console.error('Sync error:', err);
    } finally {
      setIsSyncing(false);
    }
  };




  // Mock data for today (keep for now until we parse it from specific activity or generated plan)
  const todayWorkout = {
    type: 'Tempo Run',
    duration: '50 min',
    distance: '8-10 km',
    intensity: 'high',
    description: 'Build lactate threshold with sustained effort',
    warmup: '10 min easy pace',
    main: '25 min at threshold pace (4:45-4:55/km)',
    cooldown: '15 min easy pace',
    targetPace: '4:50/km',
    targetHeartRate: '165-175 bpm',
    completed: false
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#0f172a] text-slate-400">Loading...</div>
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0f172a] p-4">
        <div className="flex items-center gap-3 mb-8">
          <div className="bg-[#f97415] p-2 rounded-lg text-white">
            <Zap className="w-6 h-6" />
          </div>


          <div>
            <h1 className="text-2xl font-bold text-white">Eclipse</h1>
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Performance AI</p>
          </div>


        </div>


        <div className="glass-card p-8 rounded-2xl max-w-md w-full text-center">
          <p className="mb-6 text-slate-400">Connect with Strava to sync your activities and get AI-powered coaching.</p>
          <a href="http://localhost:3000/api/auth/strava/login" className="bg-[#FC4C02] text-white px-6 py-3 rounded-lg font-bold w-full block hover:bg-[#e34402] transition-colors">
            Connect with Strava
          </a>
        </div>


      </div>


    )
  }

  // const activities = [...]; // Replaced by state







  const getAIAnalysis = async (activity) => {
    if (aiAnalysisCache[activity.id]) {
      return aiAnalysisCache[activity.id];
    }

    setLoadingAnalysis(true);

    try {
      // Note: Calling Anthropic directly from frontend will hit CORS issues
      // and requires an API key. For testing UI, we'll return a mock if it fails.
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [
            {
              role: "user",
              content: `Analyze this running activity and provide brief, actionable feedback (2-3 sentences max):

Distance: ${activity.distance}km
Duration: ${activity.duration}
Pace: ${activity.pace}/km
Elevation: ${activity.elevation}m
Heart Rate: ${activity.heartRate} bpm
Type: ${activity.type}

Focus on: what went well, one area to improve, and whether the effort level was appropriate for this type of run.`
            }
          ],
        })
      });

      const data = await response.json();
      const analysis = data.content
        .map(item => (item.type === "text" ? item.text : ""))
        .filter(Boolean)
        .join("\n");

      const newCache = { ...aiAnalysisCache, [activity.id]: analysis };
      setAiAnalysisCache(newCache);
      localStorage.setItem('ai-analysis-cache', JSON.stringify(newCache));

      setLoadingAnalysis(false);
      return analysis;
    } catch (error) {
      console.error('AI Analysis error:', error);
      setLoadingAnalysis(false);
      return "Note: AI analysis requires an Anthropic API key and backend setup. This is a placeholder for testing the UI.";
    }
  };



  const TodayTab = () => (
    <div className="p-4 space-y-6 max-w-4xl mx-auto pb-24">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-blue-600 text-white p-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-bold">Today's Workout</h2>
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${todayWorkout.intensity === 'high' ? 'bg-red-500' :
              todayWorkout.intensity === 'medium' ? 'bg-yellow-500' :
                'bg-green-500'
              }`}>
              {todayWorkout.intensity} intensity
            </div>


          </div>


          <p className="text-blue-100">{todayWorkout.description}</p>
        </div>



        <div className="p-6 space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-gray-600 text-sm mb-1">Duration</div>
              <div className="text-2xl font-bold text-gray-900">{todayWorkout.duration}</div>
            </div>


            <div className="text-center">
              <div className="text-gray-600 text-sm mb-1">Distance</div>
              <div className="text-2xl font-bold text-gray-900">{todayWorkout.distance}</div>
            </div>


            <div className="text-center">
              <div className="text-gray-600 text-sm mb-1">Type</div>
              <div className="text-xl font-bold text-blue-600">{todayWorkout.type}</div>
            </div>


          </div>



          <div className="border-t pt-6">
            <h3 className="font-semibold text-lg mb-4 text-black">Workout Structure</h3>
            <div className="space-y-3">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <Clock className="w-6 h-6 text-green-600" />
                </div>


                <div className="flex-1">
                  <div className="font-medium text-gray-900">Warm Up</div>
                  <div className="text-sm text-gray-600">{todayWorkout.warmup}</div>
                </div>


              </div>



              <div className="flex gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <Zap className="w-6 h-6 text-red-600" />
                </div>


                <div className="flex-1">
                  <div className="font-medium text-gray-900">Main Set</div>
                  <div className="text-sm text-gray-600">{todayWorkout.main}</div>
                </div>


              </div>



              <div className="flex gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <Activity className="w-6 h-6 text-blue-600" />
                </div>


                <div className="flex-1">
                  <div className="font-medium text-gray-900">Cool Down</div>
                  <div className="text-sm text-gray-600">{todayWorkout.cooldown}</div>
                </div>


              </div>


            </div>


          </div>



          <div className="border-t pt-6">
            <h3 className="font-semibold text-lg mb-4 text-black">Target Zones</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                <div className="text-blue-600 text-sm mb-1">Target Pace</div>
                <div className="text-xl font-bold text-gray-900">{todayWorkout.targetPace}</div>
              </div>


              <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                <div className="text-red-600 text-sm mb-1">Heart Rate</div>
                <div className="text-xl font-bold text-gray-900">{todayWorkout.targetHeartRate}</div>
              </div>


            </div>


          </div>



          <button className="w-full bg-blue-600 text-white font-semibold py-4 rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
            <CheckCircle className="w-5 h-5" />
            Mark as Complete
          </button>
        </div>


      </div>



      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <h3 className="font-semibold text-lg mb-4 flex items-center gap-2 text-black">
          <Target className="w-5 h-5 text-blue-600" />
          This Week's Plan
        </h3>
        <div className="space-y-2">
          {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, idx) => {
            const workouts = {
              0: { type: 'Rest Day', completed: true },
              1: { type: 'Easy Run - 6km', completed: true },
              2: { type: 'Tempo Run - 8km', completed: false, today: true },
              3: { type: 'Easy Run - 5km', completed: false },
              4: { type: 'Intervals - 7km', completed: false },
              5: { type: 'Rest Day', completed: false },
              6: { type: 'Long Run - 15km', completed: false }
            };
            const workout = workouts[idx];
            return (
              <div
                key={day}
                className={`flex items-center justify-between p-3 rounded-lg border-2 ${workout.today ? 'border-blue-600 bg-blue-50' :
                  workout.completed ? 'border-green-200 bg-green-50' :
                    'border-gray-200 bg-gray-50'
                  }`}
              >
                <div className="flex items-center gap-3">
                  {workout.completed ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <Circle className="w-5 h-5 text-gray-400" />
                  )}
                  <div>
                    <div className={`font-medium ${workout.today ? 'text-blue-600' : 'text-gray-900'}`}>
                      {day}
                    </div>


                    <div className="text-sm text-gray-600">{workout.type}</div>
                  </div>


                </div>


                {workout.today && (
                  <div className="text-blue-600 text-sm font-medium">Today</div>
                )}
              </div>


            );
          })}
        </div>


      </div>


    </div>



  );

  const ActivitiesTab = () => {
    // Extract unique activity types
    const activityTypes = ['All Activities', ...new Set(activities.map(a => a.type))];
    const [activeFilter, setActiveFilter] = useState('All Activities');

    // Filter activities based on selection
    const filteredActivities = activeFilter === 'All Activities'
      ? activities
      : activities.filter(a => a.type === activeFilter);

    return (
      <div className="p-6 space-y-6 max-w-4xl mx-auto pb-24">
        {/* Page Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-black tracking-tight text-white mb-2">Recent Activities</h2>
          <p className="text-slate-400 text-sm">Your latest training sessions and AI insights</p>
        </div>



        {/* Activity Filter Tabs */}
        <div className="flex gap-3 mb-6 overflow-x-auto pb-2">
          {activityTypes.map((type) => (
            <button
              key={type}
              onClick={() => setActiveFilter(type)}
              className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-all ${activeFilter === type
                ? 'bg-[#f97415] text-white'
                : 'bg-white/5 hover:bg-white/10 text-slate-400'
                }`}
            >
              {type === 'All Activities' && <Activity className="w-4 h-4" />}
              {type}
            </button>
          ))}
        </div>



        {filteredActivities.length === 0 ? (
          <div className="glass-card rounded-xl p-12 text-center">
            <Activity className="w-12 h-12 text-slate-500 mx-auto mb-4" />
            <p className="text-slate-400 text-lg">No activities found</p>
            <p className="text-slate-500 text-sm mt-2">Try syncing again or go for a run!</p>
          </div>


        ) : (
          <div className="space-y-4">
            {filteredActivities.map((activity) => (
              <button
                key={activity.id}
                onClick={() => {
                  setSelectedActivity(activity);
                  setViewMode('activity-detail');
                }}
                className="w-full text-left glass-card rounded-xl overflow-hidden hover:border-[#f97415]/40 transition-all duration-300 group"
              >
                <div className="p-6">
                  {/* Header Row */}
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-4">
                      {/* Activity Type Icon */}
                      <div className="w-12 h-12 bg-[#f97415]/20 rounded-lg flex items-center justify-center text-[#f97415]">
                        <Zap className="w-6 h-6" />
                      </div>


                      <div>
                        <h4 className="text-lg font-bold text-white group-hover:text-[#f97415] transition-colors">
                          {activity.raw?.name || activity.type}
                        </h4>
                        <p className="text-slate-400 text-sm">{activity.date}</p>
                      </div>


                    </div>


                    {/* AI Analysis Badge */}
                    {/* AI Analysis Badge */}
                    {(() => {
                      const analysis = getLatestAnalysis(aiAnalysisCache[activity.id]);
                      let intensityLabel = 'AI Ready';
                      let intensityColor = 'bg-[#f97415]/10 border-[#f97415]/20 text-[#f97415]';
                      let IntensityIcon = Flame;

                      if (analysis?.intensity_label) {
                        intensityLabel = analysis.intensity_label;
                        const labelLower = intensityLabel.toLowerCase();

                        if (labelLower.includes('recovery') || labelLower.includes('low')) {
                          intensityColor = 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500';
                          IntensityIcon = Battery;
                        } else if (labelLower.includes('moderate') || labelLower.includes('high aerobic')) {
                          intensityColor = 'bg-amber-500/10 border-amber-500/20 text-amber-500';
                          IntensityIcon = Activity;
                        } else if (labelLower.includes('anaerobic') || labelLower.includes('max')) {
                          intensityColor = 'bg-rose-500/10 border-rose-500/20 text-rose-500';
                          IntensityIcon = Zap;
                        }
                      }

                      return (
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${intensityColor}`}>
                          <IntensityIcon className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-bold uppercase tracking-tight">{intensityLabel}</span>
                        </div>


                      );
                    })()}
                  </div>



                  {/* Content Grid: Mini Map + Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Mini Map Preview */}
                    <div className="md:col-span-1 h-32 rounded-lg overflow-hidden relative bg-slate-800/50 border border-white/5">
                      {activity.raw?.map?.summary_polyline ? (
                        <>
                          <div className="absolute inset-0 bg-slate-900 opacity-60" />
                          <svg className="absolute inset-0 w-full h-full glow-path" viewBox="0 0 200 100" preserveAspectRatio="none">
                            <path
                              d="M20 80 Q 50 20, 100 50 T 180 30"
                              fill="none"
                              stroke="#f97415"
                              strokeWidth="3"
                              strokeLinecap="round"
                            />
                          </svg>
                          <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/60 backdrop-blur-md rounded text-[10px] font-bold text-white/80">
                            View Route
                          </div>


                        </>
                      ) : (
                        <div className="flex items-center justify-center h-full text-slate-500">
                          <MapIcon className="w-8 h-8" />
                        </div>


                      )}
                    </div>



                    {/* Stats Grid */}
                    <div className="md:col-span-2 flex flex-col justify-between">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">Distance</p>
                          <p className="text-2xl font-black text-white tracking-tight">
                            {activity.distance} <span className="text-sm font-normal text-slate-400">km</span>
                          </p>
                        </div>


                        <div>
                          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">Time</p>
                          <p className="text-2xl font-black text-white tracking-tight">{activity.duration}</p>
                        </div>


                        <div>
                          <div>
                            <p className="text-emerald-500 text-[10px] font-bold uppercase tracking-widest mb-1 flex items-center gap-1">
                              <Zap className="w-3 h-3 text-emerald-500" />
                              Avg Pace
                            </p>
                            <p className="text-2xl font-black text-emerald-400 tracking-tight">
                              {activity.pace} <span className="text-sm font-normal text-emerald-500/60">/km</span>
                            </p>
                          </div>


                        </div>


                      </div>




                    </div>


                  </div>


                </div>



                {/* Footer */}
                <div className="bg-white/5 px-6 py-3 flex justify-between items-center border-t border-white/5">
                  <div className="flex gap-4 text-slate-500 text-xs font-medium">
                    <span className="flex items-center gap-1 text-rose-500 font-bold">
                      <Heart className="w-3.5 h-3.5 fill-current" />
                      {activity.heartRate} bpm
                    </span>
                    <span className="flex items-center gap-1 text-white font-bold">
                      <TrendingUp className="w-3.5 h-3.5" />
                      {activity.elevation}m
                    </span>
                  </div>


                  <span className="text-[#f97415] text-sm font-bold flex items-center gap-1 group-hover:underline">
                    View Full Analysis
                    <ChevronRight className="w-4 h-4" />
                  </span>
                </div>


              </button>
            ))}
          </div>


        )}
      </div>


    );
  };




  const ProfileTab = () => {
    // Calculate Stats
    const calculateStats = () => {
      const now = new Date();
      // Reset hours to compare dates strictly for older logic if needed, 
      // but for "Last Week" logic using timestamps is often easier.
      // Let's use strict timestamp window for "last 7 days"
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      let totalKm = 0;
      let weeklyKm = 0;
      let monthlyKm = 0;
      let totalTime = 0;

      activities.forEach(a => {
        // Use raw distance (meters) convert to km
        const km = (a.raw.distance || 0) / 1000;
        const activityDate = new Date(a.raw.start_date);

        totalKm += km;
        totalTime += (a.raw.moving_time || 0);

        if (activityDate >= oneWeekAgo && activityDate <= now) {
          weeklyKm += km;
        }
        if (activityDate >= oneMonthAgo && activityDate <= now) {
          monthlyKm += km;
        }
      });

      const avgPaceSeconds = totalKm > 0 ? totalTime / totalKm : 0;
      const avgPace = formatPace(avgPaceSeconds, 1);

      // Streak Calculation
      const uniqueDays = new Set(
        activities.map(a => new Date(a.raw.start_date).toISOString().split('T')[0])
      );

      let currentStreak = 0;
      const todayStr = new Date().toISOString().split('T')[0];

      // Check today
      if (uniqueDays.has(todayStr)) {
        currentStreak++;
      }

      // Check past days
      for (let i = 1; i < 365; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dStr = d.toISOString().split('T')[0];
        if (uniqueDays.has(dStr)) {
          currentStreak++;
        } else {
          // Gap found. If we haven't started counting (today didn't have run), 
          // and yesterday didn't either, then 0.
          // If we are counting, stop.
          if (currentStreak === 0 && i === 1) {
            // No run today or yesterday
            break;
          } else if (currentStreak > 0 && !uniqueDays.has(dStr)) {
            // Streak broken
            break;
          }
          // Be lenient: if today is missed but yesterday valid, we might count it?
          // Strava is strict. Let's be strict: consecutively.
          // If today missed, current streak = 0 unless yesterday present? 
          // Logic above: if today present, started 1. If not, started 0 independently.
          // If i=1 (yesterday) is present, and today wasn't, should we count it?
          // Typically "Current Streak" implies active. If I ran yesterday, streak is active.
          if (i === 1 && currentStreak === 0 && uniqueDays.has(dStr)) {
            currentStreak++;
          }
        }
      }

      return {
        currentStreak,
        longestStreak: currentStreak, // Placeholder
        totalKm: totalKm.toFixed(1),
        weeklyKm: weeklyKm.toFixed(1),
        monthlyKm: monthlyKm.toFixed(1),
        avgPace
      };
    };

    const stats = calculateStats();

    // Calculate Heatmap
    const generateHeatmapData = () => {
      const data = [];
      const today = new Date();

      const activityMap = new Map();
      activities.forEach(a => {
        const d = a.raw.start_date.split('T')[0];
        activityMap.set(d, (activityMap.get(d) || 0) + (a.raw.distance / 1000));
      });

      for (let i = 364; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const km = activityMap.get(dateStr) || 0;

        let level = 0;
        if (km > 0) level = 1;
        if (km > 5) level = 2;
        if (km > 10) level = 3;
        if (km > 20) level = 4;

        data.push({
          date: dateStr,
          level,
          km: km.toFixed(1)
        });
      }
      return data;
    };

    const heatmapData = generateHeatmapData();

    const getHeatmapColor = (level) => {
      const colors = {
        0: 'bg-gray-100',
        1: 'bg-green-200',
        2: 'bg-green-400',
        3: 'bg-green-600',
        4: 'bg-green-800'
      };
      return colors[level] || colors[0];
    };

    // Group heatmap data by weeks
    const weeks = [];
    for (let i = 0; i < heatmapData.length; i += 7) {
      weeks.push(heatmapData.slice(i, i + 7));
    }

    // Month labels logic
    const monthLabels = [];
    // Logic to place month labels approximately over the correct week column
    weeks.forEach((week, idx) => {
      const firstDay = week[0]?.date ? new Date(week[0].date) : null;
      if (firstDay && firstDay.getDate() <= 7) {
        monthLabels.push({
          index: idx,
          label: firstDay.toLocaleDateString('en-US', { month: 'short' })
        });
      }
    });

    // Weekly goal calculation (50km target)
    const weeklyGoal = 50;
    const weeklyProgress = Math.min(100, (parseFloat(stats.weeklyKm) / weeklyGoal) * 100);
    const weeklyRemaining = Math.max(0, weeklyGoal - parseFloat(stats.weeklyKm));

    // Mock fitness and fatigue scores
    const fitnessScore = 78;
    const fatigueLevel = 62;

    // Get 3 most recent activities
    const recentActivities = activities.slice(0, 3);

    // Goal section
    const GoalSection = () => (
      <div className="glass-card p-6 rounded-xl mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-[#f97415]" />
            <h4 className="text-xs font-bold text-white/60 uppercase tracking-widest">Training Goal</h4>
          </div>


          <button
            onClick={() => setGoalEditorOpen(true)}
            className="text-xs font-bold text-[#f97415] hover:underline"
          >
            {currentGoal?.hasGoal ? 'Edit Goal' : 'Set Goal'}
          </button>
        </div>


        {currentGoal?.hasGoal ? (
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-indigo-500/20 rounded-xl flex items-center justify-center">
              <Target className="w-7 h-7 text-indigo-400" />
            </div>


            <div>
              <p className="text-xl font-bold text-white">{currentGoal.goal.type}</p>
              {currentGoal.goal.targetDate && (
                <p className="text-sm text-slate-400">
                  Target: {new Date(currentGoal.goal.targetDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              )}
            </div>


          </div>


        ) : (
          <div className="text-center py-4">
            <p className="text-slate-400 text-sm mb-3">No goal set yet</p>
            <button
              onClick={() => setGoalEditorOpen(true)}
              className="bg-[#f97415] hover:bg-orange-600 text-white font-bold py-2 px-6 rounded-xl transition-all text-sm"
            >
              Set Training Goal
            </button>
          </div>


        )}
      </div>


    );

    return (
      <div className="p-6 space-y-6 max-w-4xl mx-auto pb-24">
        {/* Training Goal Section */}
        <GoalSection />

        {/* Stats Grid */}
        <div className="flex flex-col md:flex-row gap-4">
          {/* Weekly Goal Card */}
          <div className="flex-1 glass-card p-6 rounded-xl flex items-center gap-6">
            <div className="relative w-20 h-20 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="40" cy="40" r="36" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
                <circle
                  cx="40" cy="40" r="36" fill="none" stroke="#f97415" strokeWidth="8"
                  strokeDasharray={`${2 * Math.PI * 36}`}
                  strokeDashoffset={`${2 * Math.PI * 36 * (1 - weeklyProgress / 100)}`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute text-xs font-bold text-white">{Math.round(weeklyProgress)}%</span>
            </div>


            <div>
              <p className="text-white/50 text-xs font-bold uppercase tracking-widest mb-1">Weekly Goal</p>
              <h3 className="text-3xl font-black text-white">{stats.weeklyKm} <span className="text-lg font-normal text-white/60">km</span></h3>
              <p className="text-[#f97415] text-xs font-semibold mt-1">{weeklyRemaining.toFixed(1)} km to go</p>
            </div>


          </div>



          {/* Fitness & Fatigue Cards */}
          <div className="flex-[2] grid grid-cols-2 gap-4">
            <div className="glass-card p-6 rounded-xl border-l-4 border-l-[#f97415]">
              <div className="flex justify-between items-start">
                <p className="text-white/50 text-xs font-bold uppercase tracking-widest">Fitness Score</p>
                <TrendingUp className="w-4 h-4 text-[#f97415]" />
              </div>


              <p className="text-4xl font-black text-white mt-1">{fitnessScore}</p>
              <p className="text-emerald-400 text-xs font-medium mt-1">+2.4 pts this week</p>
            </div>


            <div className="glass-card p-6 rounded-xl border-l-4 border-l-blue-500">
              <div className="flex justify-between items-start">
                <p className="text-white/50 text-xs font-bold uppercase tracking-widest">Fatigue Level</p>
                <Activity className="w-4 h-4 text-blue-500" />
              </div>


              <p className="text-4xl font-black text-white mt-1">{fatigueLevel}</p>
              <p className="text-white/40 text-xs font-medium mt-1">Optimal Recovery Zone</p>
            </div>


          </div>


        </div>



        {/* Activity Heatmap */}
        <div className="glass-card p-6 rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#f97415]" />
              <h4 className="text-xs font-bold text-white/60 uppercase tracking-widest">Activity Consistency</h4>
            </div>


            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/40 uppercase font-bold">Less</span>
              <div className="flex gap-1">
                <div className="w-3 h-3 rounded-sm bg-white/5"></div>
                <div className="w-3 h-3 rounded-sm bg-[#f97415]/20"></div>
                <div className="w-3 h-3 rounded-sm bg-[#f97415]/40"></div>
                <div className="w-3 h-3 rounded-sm bg-[#f97415]/70"></div>
                <div className="w-3 h-3 rounded-sm bg-[#f97415] shadow-[0_0_8px_rgba(249,116,21,0.4)]"></div>
              </div>


              <span className="text-[10px] text-white/40 uppercase font-bold">More</span>
            </div>


          </div>


          <div className="overflow-x-auto pb-2">
            <div className="min-w-[600px] flex gap-1">
              {weeks.slice(-26).map((week, wIdx) => (
                <div key={wIdx} className="flex flex-col gap-1">
                  {week.map((day, dIdx) => {
                    const colors = ['bg-white/5', 'bg-[#f97415]/20', 'bg-[#f97415]/40', 'bg-[#f97415]/70', 'bg-[#f97415]'];
                    return (
                      <div
                        key={dIdx}
                        className={`w-3 h-3 rounded-sm ${colors[day.level]} hover:ring-2 hover:ring-[#f97415] transition-all cursor-pointer`}
                        title={`${day.date}: ${day.km} km`}
                      />
                    );
                  })}
                </div>


              ))}
            </div>


          </div>


        </div>



        {/* Recent Activities */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-white">Recent Activities</h3>
            <button
              onClick={() => {
                setActiveTab('activities');
                setViewMode('tabs');
              }}
              className="text-[#f97415] text-sm font-bold hover:underline flex items-center gap-1"
            >
              View All Activities
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>


          {recentActivities.length === 0 ? (
            <div className="glass-card rounded-xl p-12 text-center">
              <Activity className="w-12 h-12 text-slate-500 mx-auto mb-4" />
              <p className="text-slate-400">No activities yet</p>
            </div>


          ) : (
            <div className="space-y-3">
              {recentActivities.map((activity) => (
                <button
                  key={activity.id}
                  onClick={() => {
                    setSelectedActivity(activity);
                    setViewMode('activity-detail');
                  }}
                  className="w-full glass-card rounded-xl p-4 hover:border-[#f97415]/40 transition-all text-left group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#f97415]/20 rounded-lg flex items-center justify-center text-[#f97415]">
                        <Zap className="w-5 h-5" />
                      </div>


                      <div>
                        <h4 className="text-sm font-bold text-white group-hover:text-[#f97415] transition-colors">
                          {activity.raw?.name || activity.type}
                        </h4>
                        <p className="text-xs text-slate-400">{activity.date}</p>
                      </div>


                    </div>


                    <div className="flex items-center gap-4 text-xs">
                      <div className="text-right">
                        <p className="text-slate-500 flex items-center justify-end gap-1">Distance</p>
                        <p className="font-mono font-bold text-white">{activity.distance} km</p>
                      </div>


                      <div className="text-right">
                        <p className="text-emerald-500 flex items-center justify-end gap-1">
                          <Zap className="w-3 h-3" />
                          Pace
                        </p>
                        <p className="font-mono font-bold text-emerald-400">{activity.pace}</p>
                      </div>


                      <div className="text-right">
                        <p className="text-rose-500 flex items-center justify-end gap-1">
                          <Heart className="w-3 h-3 fill-current" />
                          HR
                        </p>
                        <p className="font-mono font-bold text-rose-400">{activity.heartRate}</p>
                      </div>


                      <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-[#f97415] transition-colors" />
                    </div>


                  </div>


                </button>
              ))}
            </div>


          )}
        </div>


      </div>


    );
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 flex flex-col">
      {/* Top Header with Navigation */}
      <header className="sticky top-0 z-40 bg-[#0f172a]/95 backdrop-blur-md border-b border-white/10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="bg-[#f97415] p-1.5 rounded-lg text-white">
              <Zap className="w-5 h-5" />
            </div>


            <div>
              <h1 className="text-lg font-bold text-white">Eclipse</h1>
              <p className="text-[8px] uppercase tracking-widest text-slate-500 font-semibold">Performance AI</p>
            </div>


          </div>



          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1">
            <button
              onClick={() => {
                setActiveTab('daily-plan');
                setViewMode('tabs');
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'daily-plan' ? 'bg-[#f97415]/20 text-[#f97415]' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            >
              <Sparkles className="w-4 h-4" />
              Daily Plan
            </button>
            <button
              onClick={() => {
                setActiveTab('activities');
                setViewMode('tabs');
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'activities' ? 'bg-[#f97415]/20 text-[#f97415]' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            >
              <Activity className="w-4 h-4" />
              Training History
            </button>
            <button
              onClick={() => {
                setActiveTab('calendar');
                setViewMode('tabs');
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'calendar' ? 'bg-[#f97415]/20 text-[#f97415]' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            >
              <Calendar className="w-4 h-4" />
              Calendar
            </button>
            <button
              onClick={() => {
                setActiveTab('profile');
                setViewMode('tabs');
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'profile' ? 'bg-[#f97415]/20 text-[#f97415]' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            >
              <User className="w-4 h-4" />
              Profile
            </button>
          </nav>

          {/* Sync Status */}
          <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-500 px-3 py-1.5 rounded-full border border-emerald-500/20">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            <span className="text-[10px] font-bold uppercase tracking-wider">Synced</span>
          </div>


        </div>


      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {viewMode === 'activity-detail' && selectedActivity ? (
          <ActivityDetailPage
            activity={selectedActivity}
            details={activityDetails}
            onBack={() => setViewMode('tabs')}
            analyzing={loadingAnalysis}
            loadingDetails={loadingDetails}
            handleAnalyze={() => handleAnalyzeActivity(selectedActivity, activityDetails)}
            aiAnalysis={getLatestAnalysis(aiAnalysisCache[selectedActivity.id])}
          />
        ) : (
          <>
            {activeTab === 'daily-plan' && <DailyPlanTab user={user} onNavigateToCalendar={() => setActiveTab('calendar')} />}
            {activeTab === 'activities' && <ActivitiesTab />}
            {activeTab === 'calendar' && (
              <div className="max-w-4xl mx-auto p-8 text-center">
                <Calendar className="w-16 h-16 text-slate-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">Calendar View</h2>
                <p className="text-slate-400">Full calendar view coming soon!</p>
              </div>


            )}
            {activeTab === 'profile' && <ProfileTab />}
          </>
        )}
      </main>

      {/* Bottom Left Profile with Hover Menu */}
      <div
        className="fixed bottom-6 left-6 z-50 group"
        onMouseEnter={() => setProfileMenuOpen(true)}
        onMouseLeave={() => setProfileMenuOpen(false)}
      >
        {/* Floating Action Buttons */}
        <div className={`absolute bottom-full left-0 mb-3 flex flex-col gap-2 transition-all duration-300 ${profileMenuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
          {/* Sync Button */}
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="glass-card px-4 py-2.5 rounded-xl text-sm font-medium text-white hover:bg-white/20 transition-all shadow-lg border border-white/10 flex items-center gap-2 disabled:opacity-50 hover:scale-105"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-[#f97415]' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync'}
          </button>

          {/* Logout Button */}
          <button
            onClick={async () => {
              try {
                await fetch('/api/logout', { method: 'POST', credentials: 'include' });
                window.location.href = '/';
              } catch (err) {
                console.error('Logout error:', err);
              }
            }}
            className="glass-card px-4 py-2.5 rounded-xl text-sm font-medium text-rose-400 hover:bg-rose-500/20 transition-all shadow-lg border border-white/10 flex items-center gap-2 hover:scale-105"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>



        {/* Profile Avatar - Small Translucent Circle */}
        <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white font-bold text-sm shadow-lg cursor-pointer ring-1 ring-white/20 hover:ring-white/40 transition-all hover:scale-110 hover:bg-white/15">
          {user.firstName?.[0] || 'U'}{user.lastName?.[0] || ''}
        </div>


      </div>





      {/* Goal Editor Modal */}
      <GoalEditorModal
        isOpen={goalEditorOpen}
        onClose={() => setGoalEditorOpen(false)}
        existingGoal={currentGoal?.hasGoal ? currentGoal.goal : null}
        onSave={async (data) => {
          const res = await fetch('/api/goals', { credentials: 'include' });
          if (res.ok) setCurrentGoal(await res.json());
        }}
      />
    </div>


  );
};



const RunCoachApp = () => {
  return (
    <ErrorBoundary>
      <RunCoachAppContent />
    </ErrorBoundary>
  )
}

export default RunCoachApp;
