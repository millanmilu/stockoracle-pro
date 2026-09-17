import * as m from '../src/components/chart-tools/drawingToolCatalog.js';
import fs from 'node:fs';

const icons = fs.readFileSync(new URL('../src/components/chart-tools/DrawingToolbar.jsx', import.meta.url), 'utf8');
const rend = fs.readFileSync(new URL('../src/components/chart-tools/drawingShapeRenderers.jsx', import.meta.url), 'utf8');
const legacyJsx = fs.readFileSync(new URL('../src/components/chart-tools/DrawingTools.jsx', import.meta.url), 'utf8');

const missing = [];
for (const group of m.DRAWING_TOOL_GROUPS) {
  for (const tool of group.tools) {
    const hasIcon = new RegExp(`^\\s*${tool.id}:`, 'm').test(icons);
    const hasRenderer = new RegExp(`^\\s*${tool.id}:`, 'm').test(rend);
    const inDrawingTools = new RegExp(`'${tool.id}'`).test(legacyJsx);
    const renderOk = tool.kind === 'cursor' ? true : tool.legacy ? inDrawingTools : hasRenderer;
    if (!hasIcon || !renderOk) {
      missing.push(`${group.id}/${tool.id} icon=${hasIcon} rendered=${tool.legacy ? `legacy:${inDrawingTools}` : hasRenderer}`);
    }
  }
}
console.log(`groups=${m.DRAWING_TOOL_GROUPS.length} tools=${m.ALL_DRAWING_TOOLS.length}`);
console.log(`extended=${m.EXTENDED_TOOL_IDS.length} legacy=${m.LEGACY_TOOL_IDS.length} cursors=${m.CURSOR_TOOLS.length}`);
console.log(missing.length ? `MISSING:\n${missing.join('\n')}` : 'COVERAGE OK');
