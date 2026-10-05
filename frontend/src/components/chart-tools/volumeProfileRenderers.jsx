import React from 'react';
import * as G from '../../utils/drawingGeometry';
import { computeVolumeProfile } from '../../utils/volumeProfile';
import {
  AnchorDots,
  HitPath,
  LABEL_FONT,
  Label,
  tint,
} from './drawingShapeParts';
import { rangeFill, rangeStroke } from './rangeRenderers';

function VPBadge({ x, y, label, price, color, currency = '', surface, showPrice = true }) {
  if (price == null || !Number.isFinite(Number(price))) return null;
  const text = showPrice ? `${label}: ${currency}${Number(price).toFixed(2)}` : label;
  const width = text.length * 6.2 + 10;
  let posX = x;
  if (surface?.width && posX + width > surface.width - 10) {
    posX = Math.max(10, posX - width - 8);
  }
  return (
    <g style={{ pointerEvents: 'none' }}>
      <rect x={posX} y={y - 9} width={width} height={18} rx={3} fill={color || '#2962FF'} />
      <text
        x={posX + width / 2}
        y={y + 4}
        textAnchor="middle"
        fill="#FFFFFF"
        style={{ font: LABEL_FONT, fontWeight: 700 }}
      >
        {text}
      </text>
    </g>
  );
}

function timeToMs(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.abs(value) < 1e12 ? value * 1000 : value;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function profileSummary(slice, profile, drawing, timeframeMs, currency) {
  const parts = [];
  if (drawing.showStatsBars !== false) parts.push(`${slice.length} bars`);

  const firstTime = timeToMs(slice[0]?.time);
  const lastTime = timeToMs(slice[slice.length - 1]?.time);
  const durationMs = firstTime != null && lastTime != null
    ? Math.abs(lastTime - firstTime)
    : Math.abs(Number(slice[slice.length - 1]?.logical) - Number(slice[0]?.logical)) * timeframeMs;
  if (drawing.showStatsTime !== false && durationMs > 0) {
    parts.push(G.formatDuration(durationMs));
  }

  const range = profile.maxPrice - profile.minPrice;
  if (drawing.showStatsPrice !== false) {
    parts.push(`Range ${G.formatSignedPrice(range, currency)}`);
  }
  if (drawing.showStatsPercent !== false && profile.minPrice > 0) {
    parts.push(G.formatSignedPercent((range / profile.minPrice) * 100));
  }

  const vaShare = profile.totalVolume > 0
    ? Math.round((profile.valueAreaVolume / profile.totalVolume) * 100)
    : 0;
  parts.push(`Vol ${G.formatVolumeCompact(profile.totalVolume)}`);
  parts.push(`VA ${G.formatVolumeCompact(profile.valueAreaVolume)} (${vaShare}%)`);
  return parts.join(' · ');
}

function renderFixedRangeVolumeProfile({ points, handlers, drawing, candles, toX, toY, currency, surface, timeframeMs }) {
  const [a, b] = points;
  if (!a) return null;
  if (!b) {
    return <AnchorDots points={[a]} color={drawing.color || '#38BDF8'} />;
  }

  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const rangeW = Math.max(1, maxX - minX);

  const slice = G.sliceCandlesByRange(candles, a, b);

  // When slice is empty (e.g. no candles or during placement), render baseline box
  if (slice.length === 0) {
    const rect = G.normalizeRect(a, b);
    return (
      <>
        <HitPath
          d={G.polygonPath([a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }])}
          onDown={handlers?.onBodyDown}
          onDoubleClick={handlers?.onDoubleClick}
        />
        <rect
          x={rect.x}
          y={rect.y}
          width={rect.width}
          height={rect.height}
          fill={rangeFill(drawing, 0.04)}
          stroke={rangeStroke(drawing)}
          strokeWidth={drawing.borderWidth ?? drawing.strokeWidth ?? 1}
          strokeDasharray="3 3"
          style={{ pointerEvents: 'none' }}
        />
        <AnchorDots points={points} color={drawing.color || '#38BDF8'} />
      </>
    );
  }

  const rowsCount = Math.max(4, Math.min(100, Math.round(Number(drawing.rows) || 70)));
  const vaPct = Math.max(10, Math.min(99, Number(drawing.valueAreaPercent) || 70));
  const profile = computeVolumeProfile(slice, { rows: rowsCount, valueAreaPercent: vaPct });

  if (!profile || !Array.isArray(profile.rows) || profile.rows.length === 0) {
    const rect = G.normalizeRect(a, b);
    return (
      <>
        <HitPath
          d={G.polygonPath([a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }])}
          onDown={handlers?.onBodyDown}
          onDoubleClick={handlers?.onDoubleClick}
        />
        <rect
          x={rect.x}
          y={rect.y}
          width={rect.width}
          height={rect.height}
          fill={rangeFill(drawing, 0.04)}
          stroke={rangeStroke(drawing)}
          strokeWidth={drawing.borderWidth ?? drawing.strokeWidth ?? 1}
          strokeDasharray="3 3"
          style={{ pointerEvents: 'none' }}
        />
        <AnchorDots points={points} color={drawing.color || '#38BDF8'} />
      </>
    );
  }

  // Vertical screen coordinates matching price scale
  const pyTop = toY ? toY(profile.maxPrice) : null;
  const pyBottom = toY ? toY(profile.minPrice) : null;
  const yMin = (pyTop != null && pyBottom != null) ? Math.min(pyTop, pyBottom) : Math.min(a.y, b.y);
  const yMax = (pyTop != null && pyBottom != null) ? Math.max(pyTop, pyBottom) : Math.max(a.y, b.y);
  const totalH = Math.max(10, yMax - yMin);

  // Profile bar width
  const profileWidthPercent = Math.max(10, Math.min(100, Number(drawing.profileWidthPercent) || 40));
  const maxAllowedWidth = Math.max(12, (rangeW * profileWidthPercent) / 100);
  const maxVol = profile.poc?.volume || 1;

  // Colors
  const baseUp = drawing.upColor || '#26A69A';
  const baseDown = drawing.downColor || '#EF5350';
  const vaUpFill = tint(baseUp, 0.85);
  const vaDownFill = tint(baseDown, 0.85);
  const nonVaUpFill = tint(baseUp, 0.32);
  const nonVaDownFill = tint(baseDown, 0.32);

  // POC coordinate
  const pocY = toY && profile.poc?.price != null ? (toY(profile.poc.price) ?? (yMin + yMax) / 2) : (yMin + yMax) / 2;

  // VAH / VAL coordinates
  const vahY = toY && profile.vah != null ? (toY(profile.vah) ?? yMin) : yMin;
  const valY = toY && profile.val != null ? (toY(profile.val) ?? yMax) : yMax;

  // Top summary label
  const summaryText = profileSummary(slice, profile, drawing, timeframeMs, currency);
  const showPrices = drawing.showPrices !== false;

  return (
    <>
      {/* Interactive hit path for dragging and double-click */}
      <HitPath
        d={G.polygonPath([
          { x: minX, y: yMin },
          { x: maxX, y: yMin },
          { x: maxX, y: yMax },
          { x: minX, y: yMax },
        ])}
        onDown={handlers?.onBodyDown}
        onDoubleClick={handlers?.onDoubleClick}
      />

      {/* Range bounding box */}
      <rect
        x={minX}
        y={yMin}
        width={rangeW}
        height={totalH}
        fill={rangeFill(drawing, 0.04)}
        stroke={rangeStroke(drawing)}
        strokeWidth={drawing.borderWidth ?? drawing.strokeWidth ?? 1}
        strokeDasharray="3 3"
        style={{ pointerEvents: 'none' }}
      />

      {/* Histogram bars */}
      {profile.rows.map((row, i) => {
        const y1 = toY ? toY(row.high) : null;
        const y0 = toY ? toY(row.low) : null;
        const rTop = (y0 != null && y1 != null) ? Math.min(y0, y1) : yMin + (profile.rows.length - 1 - i) * (totalH / profile.rows.length);
        const rBottom = (y0 != null && y1 != null) ? Math.max(y0, y1) : rTop + (totalH / profile.rows.length);
        const rHeight = Math.max(1, rBottom - rTop);

        const rowVol = row.volume || 0;
        const barTotalW = maxVol > 0 ? (rowVol / maxVol) * maxAllowedWidth : 0;
        const upW = rowVol > 0 ? (row.upVolume / rowVol) * barTotalW : 0;
        const downW = Math.max(0, barTotalW - upW);

        const isVA = row.low >= (profile.val - 1e-6) && row.high <= (profile.vah + 1e-6);
        const upFill = isVA ? vaUpFill : nonVaUpFill;
        const downFill = isVA ? vaDownFill : nonVaDownFill;

        return (
          <g key={`vp-row-${i}`} style={{ pointerEvents: 'none' }}>
            {upW > 0 && (
              <rect
                x={minX}
                y={rTop}
                width={upW}
                height={Math.max(1, rHeight - 0.5)}
                fill={upFill}
              />
            )}
            {downW > 0 && (
              <rect
                x={minX + upW}
                y={rTop}
                width={downW}
                height={Math.max(1, rHeight - 0.5)}
                fill={downFill}
              />
            )}
          </g>
        );
      })}

      {/* Value Area High (VAH) line & badge */}
      {drawing.showVahVal !== false && (
        <>
          <line
            x1={minX}
            y1={vahY}
            x2={maxX}
            y2={vahY}
            stroke={drawing.vahValColor || '#38BDF8'}
            strokeWidth={1}
            strokeDasharray="4 3"
            style={{ pointerEvents: 'none' }}
          />
          <VPBadge
            x={maxX + 4}
            y={vahY}
            label="VAH"
            price={profile.vah}
            color={drawing.vahValColor || '#38BDF8'}
            currency={currency}
            surface={surface}
            showPrice={showPrices}
          />
        </>
      )}

      {/* Value Area Low (VAL) line & badge */}
      {drawing.showVahVal !== false && (
        <>
          <line
            x1={minX}
            y1={valY}
            x2={maxX}
            y2={valY}
            stroke={drawing.vahValColor || '#38BDF8'}
            strokeWidth={1}
            strokeDasharray="4 3"
            style={{ pointerEvents: 'none' }}
          />
          <VPBadge
            x={maxX + 4}
            y={valY}
            label="VAL"
            price={profile.val}
            color={drawing.vahValColor || '#38BDF8'}
            currency={currency}
            surface={surface}
            showPrice={showPrices}
          />
        </>
      )}

      {/* Point of Control (POC) line & badge */}
      {drawing.showPoc !== false && profile.poc && (
        <>
          <line
            x1={minX}
            y1={pocY}
            x2={maxX}
            y2={pocY}
            stroke={drawing.pocColor || '#EA580C'}
            strokeWidth={1.8}
            style={{ pointerEvents: 'none' }}
          />
          <VPBadge
            x={maxX + 4}
            y={pocY}
            label="POC"
            price={profile.poc.price}
            color={drawing.pocColor || '#EA580C'}
            currency={currency}
            surface={surface}
            showPrice={showPrices}
          />
        </>
      )}

      {/* Summary readout header */}
      {drawing.showProfileSummary !== false && (
        <Label
          x={(minX + maxX) / 2}
          y={yMin - 12}
          text={summaryText}
          color={drawing.color || '#38BDF8'}
          align="center"
          bold
        />
      )}

      {/* Anchor handle dots */}
      <AnchorDots points={points} color={drawing.color || '#38BDF8'} />
    </>
  );
}

export { renderFixedRangeVolumeProfile };
