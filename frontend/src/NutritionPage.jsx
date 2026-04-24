import React, { useState, useEffect, useRef } from 'react';
import { API_BASE_URL } from './config/api';

/* ──────────────────────────────────────────────────────
   Macro Ring — progress arc for protein/carbs/fat
   ────────────────────────────────────────────────────── */
function MacroRing({ value, goal, size = 64, stroke = 6, color = 'var(--color-ignite)', label, unit = 'g' }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(value / goal, 1);
  const dash = c * pct;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 6,
    }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--color-line-hi)" strokeWidth={stroke} fill="none" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${dash} ${c}`}
            strokeLinecap="round"
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-mono)',
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: -0.5, color: 'var(--color-fg)' }}>
            {value}
          </span>
          <span style={{ fontSize: 8, color: 'var(--color-fg-dim)', marginTop: -2 }}>
            /{goal}
            {unit}
          </span>
        </div>
      </div>
      <div
        style={{
          fontSize: 10,
          color: 'var(--color-fg-dim)',
          letterSpacing: 1,
          textTransform: 'uppercase',
          fontWeight: 600,
        }}
      >
        {label}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────
   NutritionChat — modal for AI-powered food logging
   ────────────────────────────────────────────────────── */
function NutritionChat({ open, onClose, onAdd }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "What did you eat? I'll log the macros. Try: '2 scrambled eggs and a slice of sourdough'",
    },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy]);

  async function send() {
    if (!input.trim() || busy) return;

    const userMsg = input.trim();
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: userMsg }]);
    setBusy(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/nutrition/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userMessage: userMsg }),
      });

      const data = await response.json();

      if (data.error || !data.parsed) {
        setMessages((m) => [
          ...m,
          {
            role: 'assistant',
            content: "Didn't catch food in that — try again with what you ate and a rough quantity.",
          },
        ]);
      } else {
        const parsed = data.parsed;
        setMessages((m) => [
          ...m,
          {
            role: 'assistant',
            content: parsed.note || `Logged ${parsed.name}.`,
            card: parsed,
          },
        ]);

        onAdd({
          name: parsed.name,
          kcal: parsed.kcal || 0,
          protein: parsed.protein || 0,
          carbs: parsed.carbs || 0,
          fat: parsed.fat || 0,
          time: 'just now',
        });
      }
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: "Couldn't reach the coach — check your connection." },
      ]);
    }
    setBusy(false);
  }

  if (!open) return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 60,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        animation: 'fadeIn 0.15s ease',
      }}
    >
      <style>{`
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes slideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
        @keyframes pulse { 0%,60%,100%{opacity:.3} 30%{opacity:1} }
      `}</style>

      <div
        style={{
          background: 'var(--color-bg)',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          border: '1px solid var(--color-line)',
          borderBottom: 'none',
          height: '78%',
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideUp 0.22s ease',
        }}
      >
        {/* handle + header */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--color-line-hi)' }} />
        </div>

        <div
          style={{
            padding: '12px 20px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--color-line)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: 'color-mix(in oklch, var(--color-ignite) 12%, transparent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid color-mix(in oklch, var(--color-ignite) 25%, transparent)',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-ignite)" strokeWidth="2">
                <path d="M12 2a7 7 0 00-7 7c0 4 3 7 7 13 4-6 7-9 7-13a7 7 0 00-7-7z" strokeLinejoin="round" />
                <circle cx="12" cy="9" r="2.5" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: -0.2 }}>Food log</div>
              <div style={{ fontSize: 10, color: 'var(--color-fg-dim)', fontFamily: 'var(--font-mono)', letterSpacing: 0.5 }}>
                ON-DEVICE · PARSES & LOGS
              </div>
            </div>
          </div>
          <div
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: 'var(--color-surface)',
              border: '1px solid var(--color-line)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-fg-muted)" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* messages */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '14px 20px' }}>
          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                marginTop: i === 0 ? 0 : 10,
                display: 'flex',
                justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  maxWidth: '82%',
                  padding: '10px 13px',
                  borderRadius: 14,
                  background: m.role === 'user' ? 'var(--color-ignite)' : 'var(--color-surface)',
                  color: m.role === 'user' ? '#fff' : 'var(--color-fg)',
                  fontSize: 13,
                  lineHeight: 1.4,
                  letterSpacing: -0.1,
                  border: m.role === 'user' ? 'none' : '1px solid var(--color-line)',
                }}
              >
                {m.content}
                {m.card && (
                  <div
                    style={{
                      marginTop: 8,
                      padding: 10,
                      borderRadius: 10,
                      background: 'var(--color-bg)',
                      border: '1px solid var(--color-line)',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--color-fg-dim)',
                        letterSpacing: 0.6,
                        textTransform: 'uppercase',
                        fontWeight: 600,
                      }}
                    >
                      Logged
                    </div>
                    <div style={{ marginTop: 3, fontSize: 14, fontWeight: 600, color: 'var(--color-fg)' }}>
                      {m.card.name}
                    </div>
                    <div style={{ marginTop: 6, display: 'flex', gap: 10, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                      <span style={{ color: 'var(--color-ignite)' }}>{m.card.kcal} kcal</span>
                      <span style={{ color: 'var(--color-fg-muted)' }}>P {m.card.protein}</span>
                      <span style={{ color: 'var(--color-fg-muted)' }}>C {m.card.carbs}</span>
                      <span style={{ color: 'var(--color-fg-muted)' }}>F {m.card.fat}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          {busy && (
            <div style={{ marginTop: 10, display: 'flex', gap: 4, paddingLeft: 6 }}>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    background: 'var(--color-fg-dim)',
                    animation: `pulse 1.2s ${i * 0.15}s infinite ease`,
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* input */}
        <div
          style={{
            padding: '10px 16px 22px',
            borderTop: '1px solid var(--color-line)',
            display: 'flex',
            gap: 8,
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') send();
            }}
            placeholder="e.g. chicken bowl with rice and avocado"
            style={{
              flex: 1,
              height: 42,
              padding: '0 14px',
              borderRadius: 12,
              background: 'var(--color-surface-2)',
              color: 'var(--color-fg)',
              border: '1px solid var(--color-line)',
              outline: 'none',
              fontFamily: 'var(--font-display)',
              fontSize: 13,
              letterSpacing: -0.1,
            }}
          />
          <button
            onClick={send}
            disabled={busy || !input.trim()}
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              border: 'none',
              background: input.trim() && !busy ? 'var(--color-ignite)' : 'var(--color-surface-2)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: input.trim() && !busy ? 'pointer' : 'default',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2">
              <path d="M5 12l7-7 7 7M12 5v15" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────
   ManualEntry — modal for manual nutrition logging
   ────────────────────────────────────────────────────── */
function ManualEntry({ open, onClose, onAdd, recipes = [], onSaveRecipe, onDeleteRecipe }) {
  const [tab, setTab] = useState('new'); // 'new' | 'saved'
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [saveAsRecipe, setSaveAsRecipe] = useState(false);

  function reset() {
    setName('');
    setKcal('');
    setProtein('');
    setCarbs('');
    setFat('');
    setSaveAsRecipe(false);
  }

  function save() {
    if (!name.trim()) return;

    const entry = {
      name: name.trim(),
      kcal: parseInt(kcal) || 0,
      protein: parseInt(protein) || 0,
      carbs: parseInt(carbs) || 0,
      fat: parseInt(fat) || 0,
      time: 'just now',
    };

    onAdd(entry);
    if (saveAsRecipe && onSaveRecipe) onSaveRecipe(entry);
    reset();
    onClose();
  }

  function logRecipe(r) {
    onAdd({
      name: r.name,
      kcal: r.kcal,
      protein: r.protein,
      carbs: r.carbs,
      fat: r.fat,
      time: 'just now',
    });
    onClose();
  }

  if (!open) return null;

  const fieldStyle = {
    height: 40,
    padding: '0 12px',
    borderRadius: 10,
    background: 'var(--color-surface-2)',
    color: 'var(--color-fg)',
    border: '1px solid var(--color-line)',
    outline: 'none',
    fontFamily: 'var(--font-mono)',
    fontSize: 13,
    width: '100%',
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 60,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}
    >
      <style>{`
        @keyframes slideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
      `}</style>
      <div
        style={{
          background: 'var(--color-bg)',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          border: '1px solid var(--color-line)',
          borderBottom: 'none',
          animation: 'slideUp 0.22s ease',
          padding: '14px 20px 24px',
          maxHeight: '86%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--color-line-hi)' }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: -0.3 }}>Add manually</div>
          <div
            onClick={onClose}
            style={{
              fontSize: 12,
              color: 'var(--color-fg-dim)',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              letterSpacing: 0.3,
            }}
          >
            CANCEL
          </div>
        </div>

        {/* tabs */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            background: 'var(--color-surface)',
            borderRadius: 10,
            padding: 3,
            gap: 2,
            border: '1px solid var(--color-line)',
            marginBottom: 14,
          }}
        >
          {[
            { id: 'new', l: 'New entry' },
            { id: 'saved', l: `Saved · ${recipes.length}` },
          ].map((o) => (
            <div
              key={o.id}
              onClick={() => setTab(o.id)}
              style={{
                padding: '8px 0',
                borderRadius: 8,
                textAlign: 'center',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: 0.4,
                textTransform: 'uppercase',
                cursor: 'pointer',
                background: tab === o.id ? 'var(--color-surface-2)' : 'transparent',
                color: tab === o.id ? 'var(--color-fg)' : 'var(--color-fg-dim)',
                border: tab === o.id ? '1px solid var(--color-line-hi)' : '1px solid transparent',
              }}
            >
              {o.l}
            </div>
          ))}
        </div>

        {tab === 'new' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
            <div>
              <div
                style={{
                  fontSize: 10,
                  color: 'var(--color-fg-dim)',
                  letterSpacing: 0.8,
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                Food
              </div>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Greek yogurt & berries"
                style={{ ...fieldStyle, fontFamily: 'var(--font-display)' }}
              />
            </div>

            <div>
              <div
                style={{
                  fontSize: 10,
                  color: 'var(--color-fg-dim)',
                  letterSpacing: 0.8,
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                Calories
              </div>
              <input
                value={kcal}
                onChange={(e) => setKcal(e.target.value.replace(/\D/g, ''))}
                placeholder="0"
                style={fieldStyle}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <div>
                <div
                  style={{
                    fontSize: 10,
                    color: 'var(--color-mint)',
                    letterSpacing: 0.8,
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    marginBottom: 4,
                  }}
                >
                  Protein
                </div>
                <input
                  value={protein}
                  onChange={(e) => setProtein(e.target.value.replace(/\D/g, ''))}
                  placeholder="0g"
                  style={fieldStyle}
                />
              </div>
              <div>
                <div
                  style={{
                    fontSize: 10,
                    color: 'var(--color-gold)',
                    letterSpacing: 0.8,
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    marginBottom: 4,
                  }}
                >
                  Carbs
                </div>
                <input
                  value={carbs}
                  onChange={(e) => setCarbs(e.target.value.replace(/\D/g, ''))}
                  placeholder="0g"
                  style={fieldStyle}
                />
              </div>
              <div>
                <div
                  style={{
                    fontSize: 10,
                    color: 'var(--color-sky)',
                    letterSpacing: 0.8,
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    marginBottom: 4,
                  }}
                >
                  Fat
                </div>
                <input
                  value={fat}
                  onChange={(e) => setFat(e.target.value.replace(/\D/g, ''))}
                  placeholder="0g"
                  style={fieldStyle}
                />
              </div>
            </div>

            {/* save-as-recipe toggle */}
            <div
              onClick={() => setSaveAsRecipe((v) => !v)}
              style={{
                marginTop: 4,
                padding: '10px 12px',
                borderRadius: 10,
                background: saveAsRecipe
                  ? 'color-mix(in oklch, var(--color-ignite) 12%, transparent)'
                  : 'var(--color-surface)',
                border: saveAsRecipe
                  ? '1px solid color-mix(in oklch, var(--color-ignite) 25%, transparent)'
                  : '1px solid var(--color-line)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 5,
                  background: saveAsRecipe ? 'var(--color-ignite)' : 'transparent',
                  border: `1.5px solid ${saveAsRecipe ? 'var(--color-ignite)' : 'var(--color-line-hi)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {saveAsRecipe && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                    <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: saveAsRecipe ? 'var(--color-ignite)' : 'var(--color-fg)' }}>
                  Save as recipe
                </div>
                <div style={{ fontSize: 10, color: 'var(--color-fg-dim)', marginTop: 1 }}>Reuse in one tap next time</div>
              </div>
            </div>

            <button
              onClick={save}
              disabled={!name.trim()}
              style={{
                marginTop: 6,
                height: 46,
                borderRadius: 12,
                border: 'none',
                background: name.trim() ? 'var(--color-ignite)' : 'var(--color-surface-2)',
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
                fontFamily: 'var(--font-display)',
                letterSpacing: -0.1,
                cursor: name.trim() ? 'pointer' : 'default',
              }}
            >
              {saveAsRecipe ? 'Log & save recipe' : 'Log entry'}
            </button>
          </div>
        )}

        {tab === 'saved' && (
          <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 4 }}>
            {recipes.length === 0 ? (
              <div
                style={{
                  padding: 28,
                  textAlign: 'center',
                  background: 'var(--color-surface)',
                  borderRadius: 14,
                  border: '1px dashed var(--color-line-hi)',
                  color: 'var(--color-fg-dim)',
                  fontSize: 12,
                }}
              >
                No saved recipes yet.
                <br />
                <span style={{ color: 'var(--color-fg-muted)' }}>Tick "Save as recipe" when you add a new entry.</span>
              </div>
            ) : (
              recipes.map((r, i) => (
                <div
                  key={i}
                  style={{
                    padding: '12px 14px',
                    background: 'var(--color-surface)',
                    borderRadius: 12,
                    border: '1px solid var(--color-line)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: 'color-mix(in oklch, var(--color-ignite) 12%, transparent)',
                      border: '1px solid color-mix(in oklch, var(--color-ignite) 25%, transparent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-ignite)" strokeWidth="2">
                      <path d="M4 19V5a1 1 0 011-1h11l4 4v11a1 1 0 01-1 1H5a1 1 0 01-1-1z" />
                      <path d="M15 4v5h5M8 13h8M8 17h5" strokeLinecap="round" />
                    </svg>
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        letterSpacing: -0.2,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {r.name}
                    </div>
                    <div style={{ marginTop: 3, display: 'flex', gap: 8, fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--color-fg-dim)' }}>
                      <span style={{ color: 'var(--color-ignite)' }}>{r.kcal} kcal</span>
                      <span>P {r.protein}</span>
                      <span>C {r.carbs}</span>
                      <span>F {r.fat}</span>
                    </div>
                  </div>

                  <div
                    onClick={() => onDeleteRecipe && onDeleteRecipe(i)}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: 'var(--color-surface-2)',
                      border: '1px solid var(--color-line)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-fg-dim)" strokeWidth="2">
                      <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M5 6l1 14a1 1 0 001 1h10a1 1 0 001-1l1-14" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>

                  <button
                    onClick={() => logRecipe(r)}
                    style={{
                      padding: '7px 12px',
                      borderRadius: 9,
                      border: 'none',
                      background: 'var(--color-ignite)',
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: 0.4,
                      textTransform: 'uppercase',
                      fontFamily: 'var(--font-display)',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    Log
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────
   NutritionPage — main Fuel screen
   ────────────────────────────────────────────────────── */
function NutritionPage() {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [totals, setTotals] = useState({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
  const [goals, setGoals] = useState({ kcal: 2600, protein: 180, carbs: 300, fat: 80 });
  const [chatOpen, setChatOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [recipes, setRecipes] = useState([]);

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const token = localStorage.getItem('authToken');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        // Fetch today's nutrition data
        const todayRes = await fetch(`${API_BASE_URL}/api/nutrition/today`, { headers });
        if (todayRes.ok) {
          const todayData = await todayRes.json();
          setEntries(todayData.entries || []);
          setTotals(todayData.totals || { kcal: 0, protein: 0, carbs: 0, fat: 0 });
        }

        // Fetch nutrition goals
        const goalsRes = await fetch(`${API_BASE_URL}/api/nutrition/goals`, { headers });
        if (goalsRes.ok) {
          const goalsData = await goalsRes.json();
          setGoals(goalsData || { kcal: 2600, protein: 180, carbs: 300, fat: 80 });
        }
      } catch (e) {
        console.error('Failed to load nutrition data', e);
      }
      setLoading(false);
    };

    loadData();

    // Load saved recipes from localStorage
    const savedRecipes = localStorage.getItem('nutrition_recipes') || '[]';
    try {
      setRecipes(JSON.parse(savedRecipes));
    } catch {
      setRecipes([]);
    }
  }, []);

  // Add entry handler
  const addEntry = async (entry) => {
    const newEntry = {
      ...entry,
      time: entry.time || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      meal: entry.meal || currentMeal(),
    };

    // Optimistic update
    setEntries((prev) => [newEntry, ...prev]);
    setTotals((prev) => ({
      kcal: prev.kcal + newEntry.kcal,
      protein: prev.protein + newEntry.protein,
      carbs: prev.carbs + newEntry.carbs,
      fat: prev.fat + newEntry.fat,
    }));

    // Persist via API if needed
    try {
      const token = localStorage.getItem('authToken');
      if (token) {
        await fetch(`${API_BASE_URL}/api/nutrition/log`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(newEntry),
        });
      }
    } catch (e) {
      console.error('Failed to save entry', e);
    }
  };

  // Save recipe handler
  const saveRecipe = (recipe) => {
    const updated = [...recipes, recipe];
    setRecipes(updated);
    localStorage.setItem('nutrition_recipes', JSON.stringify(updated));
  };

  // Delete recipe handler
  const deleteRecipe = (index) => {
    const updated = recipes.filter((_, i) => i !== index);
    setRecipes(updated);
    localStorage.setItem('nutrition_recipes', JSON.stringify(updated));
  };

  // Helper: determine current meal type
  const currentMeal = () => {
    const h = new Date().getHours();
    if (h < 11) return 'Breakfast';
    if (h < 15) return 'Lunch';
    if (h < 18) return 'Snack';
    return 'Dinner';
  };

  // Get date string
  const getTodayInfo = () => {
    const now = new Date();
    const dayMap = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthMap = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return {
      dayName: dayMap[now.getDay()].toUpperCase(),
      date: now.getDate(),
      month: monthMap[now.getMonth()].toUpperCase(),
    };
  };

  const { dayName, date, month } = getTodayInfo();
  const kcalPct = Math.min(totals.kcal / goals.kcal, 1);
  const kcalLeft = Math.max(goals.kcal - totals.kcal, 0);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: 'var(--color-bg)',
        color: 'var(--color-fg)',
        fontFamily: 'var(--font-display)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Header */}
      <div style={{ padding: '4px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: -0.5 }}>Fuel</div>
          <div style={{ fontSize: 11, color: 'var(--color-fg-dim)', fontFamily: 'var(--font-mono)', letterSpacing: 0.5, marginTop: 2 }}>
            {dayName} · {month} {date}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: 'var(--color-surface)',
              border: '1px solid var(--color-line)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-fg-muted)" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" strokeLinecap="round" />
            </svg>
          </div>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: 'var(--color-surface)',
              border: '1px solid var(--color-line)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-fg-muted)" strokeWidth="2">
              <circle cx="12" cy="5" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="19" r="1.5" />
            </svg>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 130 }}>
        {/* Calorie hero card */}
        <div
          style={{
            margin: '16px 20px 0',
            padding: 20,
            background: 'var(--color-surface)',
            borderRadius: 20,
            border: '1px solid var(--color-line)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {/* Big calorie ring */}
            <div style={{ position: 'relative', width: 128, height: 128, flexShrink: 0 }}>
              <svg width="128" height="128" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="64" cy="64" r="56" stroke="var(--color-line-hi)" strokeWidth="8" fill="none" />
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="var(--color-ignite)"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 56 * kcalPct} ${2 * Math.PI * 56}`}
                  strokeLinecap="round"
                />
              </svg>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 26,
                    fontWeight: 600,
                    letterSpacing: -1,
                    color: 'var(--color-fg)',
                  }}
                >
                  {totals.kcal}
                </div>
                <div
                  style={{
                    fontSize: 9,
                    color: 'var(--color-fg-dim)',
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    fontWeight: 600,
                    marginTop: -2,
                  }}
                >
                  EATEN
                </div>
              </div>
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: 'var(--color-fg-dim)', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 600 }}>
                Remaining
              </div>
              <div style={{ marginTop: 2, display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 32,
                    fontWeight: 600,
                    letterSpacing: -1,
                    color: 'var(--color-fg)',
                  }}
                >
                  {kcalLeft}
                </span>
                <span style={{ fontSize: 12, color: 'var(--color-fg-dim)', fontFamily: 'var(--font-mono)' }}>kcal</span>
              </div>
              <div style={{ marginTop: 10, display: 'flex', gap: 14, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-fg-muted)' }}>
                <div>
                  <span style={{ color: 'var(--color-fg-dim)' }}>GOAL </span>
                  <span style={{ color: 'var(--color-fg)' }}>{goals.kcal}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--color-fg-dim)' }}>BURN </span>
                  <span style={{ color: 'var(--color-mint)' }}>684</span>
                </div>
              </div>
              <div
                style={{
                  marginTop: 12,
                  padding: '5px 8px',
                  borderRadius: 4,
                  background: 'color-mix(in oklch, var(--color-ignite) 12%, transparent)',
                  color: 'var(--color-ignite)',
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  display: 'inline-block',
                }}
              >
                {kcalPct >= 1 ? 'At goal' : kcalPct > 0.7 ? 'On track' : 'Fuel up'}
              </div>
            </div>
          </div>

          {/* Macro rings */}
          <div
            style={{
              marginTop: 18,
              paddingTop: 16,
              borderTop: '1px solid var(--color-line)',
              display: 'flex',
              justifyContent: 'space-around',
            }}
          >
            <MacroRing value={totals.protein} goal={goals.protein} color="var(--color-mint)" label="Protein" />
            <MacroRing value={totals.carbs} goal={goals.carbs} color="var(--color-gold)" label="Carbs" />
            <MacroRing value={totals.fat} goal={goals.fat} color="var(--color-sky)" label="Fat" />
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ margin: '14px 20px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button
            onClick={() => setChatOpen(true)}
            style={{
              height: 52,
              borderRadius: 14,
              border: '1px solid color-mix(in oklch, var(--color-ignite) 25%, transparent)',
              background: 'color-mix(in oklch, var(--color-ignite) 12%, transparent)',
              color: 'var(--color-ignite)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              fontFamily: 'var(--font-display)',
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: -0.1,
              cursor: 'pointer',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-ignite)" strokeWidth="2">
              <path d="M21 12a9 9 0 11-3.5-7.1M21 4v5h-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Log with AI
          </button>
          <button
            onClick={() => setManualOpen(true)}
            style={{
              height: 52,
              borderRadius: 14,
              border: '1px solid var(--color-line)',
              background: 'var(--color-surface)',
              color: 'var(--color-fg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              fontFamily: 'var(--font-display)',
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: -0.1,
              cursor: 'pointer',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-fg)" strokeWidth="2">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            Add manually
          </button>
        </div>

        {/* Macro split bars */}
        <div
          style={{
            margin: '14px 20px 0',
            padding: 16,
            background: 'var(--color-surface)',
            borderRadius: 16,
            border: '1px solid var(--color-line)',
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: 'var(--color-fg-dim)',
              letterSpacing: 1,
              textTransform: 'uppercase',
              fontWeight: 600,
            }}
          >
            Macro split
          </div>
          {[
            { l: 'Protein', v: totals.protein, g: goals.protein, c: 'var(--color-mint)' },
            { l: 'Carbs', v: totals.carbs, g: goals.carbs, c: 'var(--color-gold)' },
            { l: 'Fat', v: totals.fat, g: goals.fat, c: 'var(--color-sky)' },
          ].map((m) => (
            <div key={m.l} style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div style={{ fontSize: 12, color: 'var(--color-fg)', fontWeight: 500 }}>{m.l}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-fg-muted)' }}>
                  <span style={{ color: m.c }}>{m.v}g</span>
                  <span style={{ color: 'var(--color-fg-dim)' }}> / {m.g}g</span>
                </div>
              </div>
              <div style={{ marginTop: 6, height: 6, borderRadius: 3, background: 'var(--color-line-hi)', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${Math.min((m.v / m.g) * 100, 100)}%`,
                    height: '100%',
                    background: m.c,
                    borderRadius: 3,
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Today's log */}
        <div style={{ margin: '18px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: -0.2 }}>Today's log</div>
          <div style={{ fontSize: 10, color: 'var(--color-fg-dim)', fontFamily: 'var(--font-mono)', letterSpacing: 0.5 }}>
            {entries.length} ENTRIES
          </div>
        </div>

        <div style={{ margin: '8px 20px 0' }}>
          {entries.length === 0 ? (
            <div
              style={{
                padding: 22,
                textAlign: 'center',
                background: 'var(--color-surface)',
                borderRadius: 14,
                border: '1px dashed var(--color-line-hi)',
                color: 'var(--color-fg-dim)',
                fontSize: 12,
              }}
            >
              Nothing logged yet. Tap "Log with AI" to start.
            </div>
          ) : (
            entries.map((e, i) => (
              <div
                key={i}
                style={{
                  padding: '12px 14px',
                  marginBottom: 6,
                  background: 'var(--color-surface)',
                  borderRadius: 12,
                  border: '1px solid var(--color-line)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: 'var(--color-surface-2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    fontWeight: 600,
                    color: 'var(--color-ignite)',
                    letterSpacing: 0.5,
                  }}
                >
                  {e.meal ? e.meal[0] : '—'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      letterSpacing: -0.2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {e.name}
                  </div>
                  <div style={{ marginTop: 3, display: 'flex', gap: 8, fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--color-fg-dim)', letterSpacing: 0.3 }}>
                    <span>{e.time}</span>
                    <span>·</span>
                    <span style={{ color: 'var(--color-mint)' }}>P {e.protein}</span>
                    <span style={{ color: 'var(--color-gold)' }}>C {e.carbs}</span>
                    <span style={{ color: 'var(--color-sky)' }}>F {e.fat}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600, color: 'var(--color-fg)', letterSpacing: -0.3 }}>
                    {e.kcal}
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--color-fg-dim)', letterSpacing: 0.5 }}>kcal</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modals */}
      <NutritionChat open={chatOpen} onClose={() => setChatOpen(false)} onAdd={addEntry} />
      <ManualEntry
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        onAdd={addEntry}
        recipes={recipes}
        onSaveRecipe={saveRecipe}
        onDeleteRecipe={deleteRecipe}
      />
    </div>
  );
}

export { NutritionPage, NutritionChat, ManualEntry };
export default NutritionPage;
