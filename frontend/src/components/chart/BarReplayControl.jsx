import React from 'react';
import { RotateCcw, Play, Pause, SkipForward } from 'lucide-react';
import toast from 'react-hot-toast';

export default function BarReplayControl({
  isReplayMode = false,
  setIsReplayMode = () => {},
  isReplayPlaying = false,
  setIsReplayPlaying = () => {},
  replayIndex = 0,
  setReplayIndex = () => {},
  replaySpeed = 1,
  setReplaySpeed = () => {},
  rawHistory = null,
}) {
  if (!isReplayMode) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '6px 14px', background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.95))',
      border: '1px solid rgba(99, 102, 241, 0.4)', borderRadius: 8,
      boxShadow: '0 8px 24px rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)',
      flexShrink: 0, gap: 10, zIndex: 40, flexWrap: 'wrap',
    }}>
      {/* Left Title & Current Date/Bar Info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#818CF8', display: 'flex', alignItems: 'center', gap: 5 }}>
          <RotateCcw size={14} className={isReplayPlaying ? 'broker-spin' : ''} />
          <span>BAR REPLAY</span>
        </span>
        <div style={{
          fontSize: '0.7rem', color: '#CBD5E1', fontFamily: 'JetBrains Mono, monospace',
          background: 'rgba(0,0,0,0.4)', padding: '2px 8px', borderRadius: 4,
          border: '1px solid rgba(255,255,255,0.06)'
        }}>
          📅 {rawHistory && rawHistory[replayIndex - 1] ? (rawHistory[replayIndex - 1].date || rawHistory[replayIndex - 1].time) : 'Live'}
          <span style={{ color: '#64748B', marginLeft: 6 }}>({replayIndex || 0}/{rawHistory?.length || 0} bars)</span>
        </div>
      </div>

      {/* Center Playback Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {/* Rewind to Start */}
        <button
          onClick={() => {
            setIsReplayPlaying(false);
            setReplayIndex(5);
            toast('Rewound to oldest candle');
          }}
          title="Jump to oldest candle"
          style={{ padding: '4px 8px', borderRadius: 5, background: '#1E293B', border: '1px solid rgba(255,255,255,0.1)', color: '#CBD5E1', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 700 }}
        >
          ⏮ Start
        </button>

        {/* Step Back -10 */}
        <button
          onClick={() => {
            setIsReplayPlaying(false);
            setReplayIndex(prev => Math.max(5, (prev || 10) - 10));
          }}
          title="Jump back 10 bars"
          style={{ padding: '4px 8px', borderRadius: 5, background: '#1E293B', border: '1px solid rgba(255,255,255,0.1)', color: '#CBD5E1', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 700 }}
        >
          ⏪ -10
        </button>

        {/* Play / Pause Auto Play Button */}
        <button
          onClick={() => {
            if (!isReplayPlaying) {
              const total = rawHistory?.length || 100;
              if (!replayIndex || replayIndex >= total - 1) {
                setReplayIndex(Math.max(5, total - 60));
              }
              setIsReplayPlaying(true);
            } else {
              setIsReplayPlaying(false);
            }
          }}
          style={{
            padding: '5px 16px', borderRadius: 6,
            background: isReplayPlaying ? 'linear-gradient(135deg, #EF4444, #DC2626)' : 'linear-gradient(135deg, #10B981, #059669)',
            color: '#FFF', border: 'none', fontWeight: 800, fontSize: '0.76rem',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            boxShadow: isReplayPlaying ? '0 2px 10px rgba(239,68,68,0.4)' : '0 2px 10px rgba(16,185,129,0.4)',
            transition: 'all 0.15s ease'
          }}
        >
          {isReplayPlaying ? <Pause size={14} /> : <Play size={14} />}
          {isReplayPlaying ? 'PAUSE' : 'AUTO PLAY'}
        </button>

        {/* Step Forward +1 */}
        <button
          onClick={() => {
            setIsReplayPlaying(false);
            setReplayIndex(prev => Math.min((rawHistory?.length || 100), (prev || 10) + 1));
          }}
          title="Step forward 1 bar"
          style={{ padding: '4px 9px', borderRadius: 5, background: '#1E293B', border: '1px solid rgba(255,255,255,0.1)', color: '#CBD5E1', fontSize: '0.72rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700 }}
        >
          <SkipForward size={13} /> +1
        </button>

        {/* Step Forward +10 */}
        <button
          onClick={() => {
            setIsReplayPlaying(false);
            setReplayIndex(prev => Math.min((rawHistory?.length || 100), (prev || 10) + 10));
          }}
          title="Jump forward 10 bars"
          style={{ padding: '4px 8px', borderRadius: 5, background: '#1E293B', border: '1px solid rgba(255,255,255,0.1)', color: '#CBD5E1', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 700 }}
        >
          ⏩ +10
        </button>

        {/* Speed Selector Pills */}
        <div style={{ display: 'flex', gap: 2, background: 'rgba(0,0,0,0.4)', padding: '2px 4px', borderRadius: 5, border: '1px solid rgba(255,255,255,0.08)' }}>
          {[0.5, 1, 2, 3, 5, 10].map(spd => (
            <button
              key={spd}
              onClick={() => setReplaySpeed(spd)}
              style={{
                padding: '3px 6px', borderRadius: 3, border: 'none',
                background: replaySpeed === spd ? '#6366F1' : 'transparent',
                color: replaySpeed === spd ? '#FFF' : '#94A3B8',
                fontSize: '0.68rem', fontWeight: 800, cursor: 'pointer'
              }}
            >
              {spd}x
            </button>
          ))}
        </div>

        {/* Scrubber Timeline Slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 4 }}>
          <input
            type="range"
            min="5"
            max={rawHistory?.length || 100}
            value={replayIndex || (rawHistory?.length || 100)}
            onChange={(e) => {
              setIsReplayPlaying(false);
              setReplayIndex(Number(e.target.value));
            }}
            style={{ width: 140, cursor: 'pointer', accentColor: '#818CF8' }}
          />
        </div>
      </div>

      {/* Exit Button */}
      <button
        onClick={() => {
          setIsReplayMode(false);
          setIsReplayPlaying(false);
        }}
        style={{
          padding: '4px 10px', borderRadius: 5,
          background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
          color: '#EF4444', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer'
        }}
      >
        ✕ Exit Replay
      </button>
    </div>
  );
}
