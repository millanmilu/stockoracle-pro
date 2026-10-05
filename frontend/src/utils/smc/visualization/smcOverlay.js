export function buildSMCOverlay(analysis = {}) {
  const overlays = [
    ...(analysis.liquidity?.levels || []),
    ...(analysis.fvgs?.gaps || []),
    ...(analysis.orderBlocks?.blocks || []),
  ];

  return overlays.map((item, idx) => ({
    ...item,
    id: `${item.type || 'overlay'}-${idx}`,
    visible: true,
  }));
}
