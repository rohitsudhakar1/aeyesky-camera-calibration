import { useStore } from '../store';
import { CursorIcon, PolygonIcon } from './icons';

export function Toolbar() {
  const tool = useStore((s) => s.tool);
  const setTool = useStore((s) => s.setTool);

  return (
    <div className="toolbar" role="toolbar" aria-label="Canvas tools">
      <button
        className="tool"
        aria-pressed={tool === 'select'}
        aria-label="Select tool (V)"
        title="Select — move, reshape and relabel areas (V)"
        onClick={() => setTool('select')}
      >
        <CursorIcon />
      </button>
      <button
        className="tool"
        aria-pressed={tool === 'polygon'}
        aria-label="Polygon tool (P)"
        title="Polygon — draw a new labelled area (P)"
        onClick={() => setTool('polygon')}
      >
        <PolygonIcon />
      </button>
    </div>
  );
}
