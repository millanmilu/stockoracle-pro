import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Crosshair } from 'lucide-react';
import CandleCountdown from '../chart/CandleCountdown';
import ReplayBar from '../chart/ReplayBar';
import VolumeProfileOverlay from '../chart/VolumeProfileOverlay';
import { loadSmcDisplay, subscribeSmcDisplay } from '../../utils/smcDisplayPrefs';
import { analyzeSMC } from '../../utils/smc/engine/smcEngine';
import { formatReplayBarLabel } from './format';

function SmcProSummaryCard({ candles }) {
  const [collapsed, setCollapsed] = useState(false);
  const [position, setPosition] = useState({ left: 12, top: 12 });
  const dragRef = useRef(null);
  const summary = useMemo(() => {
    if (!Array.isArray(candles) || candles.length < 20) return null;
    return analyzeSMC(candles);
  }, [candles]);
  const bias = String(summary?.mtf?.bias || 'neutral').toLowerCase();
  const biasLabel = bias === 'bullish' ? 'Bullish' : bias === 'bearish' ? 'Bearish' : 'Neutral';
  const latestBreak = summary?.swings?.bos?.[summary.swings.bos.length - 1];
  const structure = latestBreak?.type
    ? String(latestBreak.type).toUpperCase()
    : summary?.swings?.structure?.at(-1)?.label || 'No break';
  const zone = String(summary?.premiumDiscount?.zone || '').toLowerCase();
  const phase = zone === 'premium' ? 'Premium' : zone === 'discount' ? 'Discount' : zone === 'equilibrium' ? 'Equilibrium' : '—';
  const session = String(summary?.session || 'unknown')
    .replace('asian', 'Asia')
    .replace('newYork', 'New York')
    .replace('london', 'London')
    .replace('overnight', 'Overnight');
  const scoreValue = Number(summary?.score?.score);
  const score = Number.isFinite(scoreValue) ? `${Math.round(scoreValue)}/100` : '—';
  const isWaiting = !summary;
  const onDragStart = (event) => {
    if (event.target.closest('button')) return;
    event.preventDefault();
    dragRef.current = {
      x: event.clientX, y: event.clientY,
      left: position.left, top: position.top,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onDragMove = (event) => {
    if (!dragRef.current) return;
    const container = event.currentTarget.parentElement?.parentElement?.getBoundingClientRect();
    const card = event.currentTarget.parentElement?.getBoundingClientRect();
    const left = dragRef.current.left + event.clientX - dragRef.current.x;
    const top = dragRef.current.top + event.clientY - dragRef.current.y;
    setPosition({
      left: Math.max(4, Math.min(left, Math.max(4, (container?.width || left + (card?.width || 0)) - (card?.width || 0) - 4))),
      top: Math.max(4, Math.min(top, Math.max(4, (container?.height || top + (card?.height || 0)) - (card?.height || 0) - 4))),
    });
  };
  const onDragEnd = () => { dragRef.current = null; };

  return (
    <div
      style={{
        position: 'absolute',
        top: position.top,
        left: position.left,
        zIndex: 25,
        minWidth: collapsed ? 104 : 172,
        padding: '7px 9px',
        borderRadius: 10,
        background: 'linear-gradient(180deg, rgba(10,15,24,0.94), rgba(15,21,34,0.86))',
        border: `1px solid ${isWaiting ? 'rgba(148, 163, 184, 0.22)' : 'rgba(96, 165, 250, 0.26)'}`,
        boxShadow: '0 8px 20px rgba(2, 6, 23, 0.34)',
        backdropFilter: 'blur(8px)',
        color: '#E5F1FF',
      }}
    >
      <div
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: collapsed ? 0 : 6, cursor: 'grab', touchAction: 'none' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: isWaiting ? '#94A3B8' : bias === 'bullish' ? '#34D399' : bias === 'bearish' ? '#F87171' : '#FBBF24', display: 'inline-block' }} />
          <span style={{ fontSize: '0.59rem', fontWeight: 800, letterSpacing: '0.11em', color: '#9ECBFF', textTransform: 'uppercase' }}>SMC Pro</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          {collapsed && <span style={{ fontSize: '0.59rem', color: '#FBBF24', fontWeight: 800 }}>{score}</span>}
          <span style={{ fontSize: '0.59rem', color: isWaiting ? '#94A3B8' : bias === 'bullish' ? '#34D399' : bias === 'bearish' ? '#F87171' : '#FBBF24', fontWeight: 800 }}>{collapsed ? biasLabel.toUpperCase() : biasLabel}</span>
          <button
            type="button"
            aria-label={collapsed ? 'Expand SMC Pro panel' : 'Collapse SMC Pro panel'}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => setCollapsed((value) => !value)}
            style={{ border: 0, background: 'transparent', color: '#8AA0C2', padding: 0, fontSize: 12, lineHeight: 1, cursor: 'pointer' }}
          >{collapsed ? '+' : '−'}</button>
        </div>
      </div>

      {!collapsed && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '2px 9px', fontSize: '0.58rem', lineHeight: 1.4 }}>
          <span style={{ color: '#8AA0C2' }}>Bias</span>
          <span style={{ color: isWaiting ? '#CBD5E1' : bias === 'bullish' ? '#34D399' : bias === 'bearish' ? '#F87171' : '#FBBF24', fontWeight: 700, textAlign: 'right' }}>{isWaiting ? 'Waiting' : biasLabel}</span>
          <span style={{ color: '#8AA0C2' }}>Structure</span>
          <span style={{ color: '#E2E8F0', fontWeight: 600, textAlign: 'right' }}>{isWaiting ? 'Awaiting data' : structure}</span>
          <span style={{ color: '#8AA0C2' }}>Phase</span>
          <span style={{ color: '#E2E8F0', fontWeight: 600, textAlign: 'right' }}>{phase}</span>
          <span style={{ color: '#8AA0C2' }}>Session</span>
          <span style={{ color: '#E2E8F0', fontWeight: 600, textAlign: 'right' }}>{session}</span>
          <span style={{ color: '#8AA0C2' }}>Score</span>
          <span style={{ color: isWaiting ? '#CBD5E1' : '#FBBF24', fontWeight: 700, textAlign: 'right' }}>{score}</span>
        </div>
      )}
    </div>
  );
}

/**
 * ChartFloaters — floating overlays layered above the main chart pane:
 * Bar Replay watermark, jump-to-bar guide banner, candle countdown badge,
 * the replay transport bar and the volume-profile overlay.
 */
export default function ChartFloaters({
  isReplaying,
  isJumpMode,
  showCountdown,
  chartCanvasRef,
  activeCandleRef,
  symbol,
  interval,
  currentPrice,
  chartCandles,
  totalCandles,
  replayIndex,
  replayPlaying,
  replaySpeed,
  onPlayPause,
  onStep,
  onSeek,
  onSpeed,
  onExit,
  isMobile,
  drawingChartRef,
  drawingCandleRef,
  activeIndicators,
  hiddenIndicators,
  indicatorParamOverrides,
}) {
  const [smcPrefs, setSmcPrefs] = useState(() => loadSmcDisplay());
  useEffect(() => subscribeSmcDisplay(setSmcPrefs), []);
  return (
    <>
      {activeIndicators.includes('smc_pro') && smcPrefs.scoreCard !== false && (
        <SmcProSummaryCard candles={chartCandles} />
      )}

      {/* Replay Simulation Watermark */}
      {isReplaying && (
        <div style={{
          position: 'absolute',
          top: 40,
          right: 68,
          zIndex: 15,
          pointerEvents: 'none',
          opacity: 0.35,
          fontSize: '0.72rem',
          fontWeight: 700,
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, sans-serif",
          letterSpacing: '0.12em',
          color: '#2962FF',
          userSelect: 'none',
        }}>
          BAR REPLAY
        </div>
      )}

      {/* Interactive Jump-to-Bar floating guide banner */}
      {isJumpMode && (
        <div style={{
          position: 'absolute',
          top: 40,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 60,
          background: '#2962FF',
          color: '#FFFFFF',
          padding: '6px 14px',
          borderRadius: 4,
          fontSize: '0.76rem',
          fontWeight: 500,
          letterSpacing: '0.01em',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          pointerEvents: 'none',
        }}>
          <Crosshair size={14} />
          Click any candle on the chart to set cut point (Esc to cancel)
        </div>
      )}

      {!isReplaying && showCountdown && (
        <CandleCountdown
          chartRef={chartCanvasRef}
          activeCandleRef={activeCandleRef}
          selectedSymbol={symbol}
          interval={interval}
          currentPrice={currentPrice}
        />
      )}
      {isReplaying && (
        <ReplayBar
          index={replayIndex}
          total={totalCandles}
          playing={replayPlaying}
          speed={replaySpeed}
          barLabel={formatReplayBarLabel(chartCandles[chartCandles.length - 1]?.time)}
          onPlayPause={onPlayPause}
          onStep={onStep}
          onSeek={onSeek}
          onSpeed={onSpeed}
          onExit={onExit}
          isMobile={isMobile}
        />
      )}
      {activeIndicators.includes('volume_profile') && (
        <VolumeProfileOverlay
          chartRef={drawingChartRef}
          candleRef={drawingCandleRef}
          candles={chartCandles}
          active
          hidden={hiddenIndicators.includes('volume_profile')}
          rows={indicatorParamOverrides['volume_profile']?.rows ?? 24}
          valueAreaPercent={indicatorParamOverrides['volume_profile']?.value_area ?? 70}
          isMobile={isMobile}
        />
      )}
    </>
  );
}
