import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useStore, MIN_VERTICES } from '../store';
import { getLabel, TABLE_IMAGE, LABELS } from '../config';
import type { Area, Point } from '../types';
import { boundingBox, distance, edgeMidpoints, pointInPolygon } from '../lib/geometry';

/** Pointer proximity, in screen px, for grabbing a handle or closing a polygon. */
const HIT_RADIUS = 9;
/** Pointer travel, in screen px, above which a click counts as a drag. */
const DRAG_THRESHOLD = 3;

/**
 * Keep receiving move/up events even if the pointer leaves the SVG mid-drag.
 * Throws if the pointer was already released, which is harmless here.
 */
const capturePointer = (e: React.PointerEvent<SVGSVGElement>) => {
  try {
    e.currentTarget.setPointerCapture(e.pointerId);
  } catch {
    /* pointer already gone — the drag will simply end on the next pointerup */
  }
};

type DragState =
  | { kind: 'vertex'; areaId: string; index: number }
  | { kind: 'move'; last: Point; moved: boolean }
  | { kind: 'marquee'; origin: Point; additive: boolean }
  | null;

/** Normalised rect between two corners, in either drag direction. */
const rectBetween = (a: Point, b: Point) => ({
  x: Math.min(a.x, b.x),
  y: Math.min(a.y, b.y),
  width: Math.abs(a.x - b.x),
  height: Math.abs(a.y - b.y),
});

const polygonIntersectsRect = (points: Point[], r: ReturnType<typeof rectBetween>) => {
  const box = boundingBox(points);
  // Bounding-box overlap is the right test here: an operator dragging a marquee
  // expects to catch anything it touches, not only fully-enclosed regions.
  return (
    box.x < r.x + r.width &&
    box.x + box.width > r.x &&
    box.y < r.y + r.height &&
    box.y + box.height > r.y
  );
};

export function CanvasStage() {
  const areas = useStore((s) => s.areas);
  const tool = useStore((s) => s.tool);
  const draft = useStore((s) => s.draft);
  const selectedIds = useStore((s) => s.selectedIds);
  const editingId = useStore((s) => s.editingId);
  const hoveredId = useStore((s) => s.hoveredId);
  const activeLabel = useStore((s) => s.activeLabel);

  const frameRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [cursor, setCursor] = useState<Point | null>(null);
  const [labelMenu, setLabelMenu] = useState<{ areaId: string; x: number; y: number } | null>(null);
  const [marquee, setMarquee] = useState<{ origin: Point; current: Point } | null>(null);
  const drag = useRef<DragState>(null);

  // The image is laid out with `max-width/height: 100%`, so its rendered size
  // is only known after layout — measure it and convert coordinates in JS
  // rather than relying on an SVG viewBox (which would also scale strokes).
  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const toPx = useCallback(
    (p: Point) => ({ x: p.x * size.width, y: p.y * size.height }),
    [size.width, size.height],
  );

  const toNorm = useCallback(
    (e: { clientX: number; clientY: number }): Point => {
      const rect = frameRef.current!.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      };
    },
    [],
  );

  const pxDistance = useCallback(
    (a: Point, b: Point) => distance(toPx(a), toPx(b)),
    [toPx],
  );

  const visibleAreas = areas.filter((a) => a.visible);
  const drawing = tool === 'polygon';
  /** True while the pointer is close enough to the first vertex to close the shape. */
  const canClose =
    drawing && draft.length >= MIN_VERTICES && !!cursor && pxDistance(cursor, draft[0]) <= HIT_RADIUS;

  // ── Pointer handling ───────────────────────────────────────────────────

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    const p = toNorm(e);

    if (drawing) {
      if (canClose) useStore.getState().commitDraft();
      else useStore.getState().addDraftPoint(p);
      return;
    }

    // Select tool. Topmost polygon wins, matching paint order.
    const hit = [...visibleAreas].reverse().find((a) => pointInPolygon(p, a.points));

    if (editingId) {
      const area = areas.find((a) => a.id === editingId);
      if (area) {
        const vertexIndex = area.points.findIndex((pt) => pxDistance(pt, p) <= HIT_RADIUS);
        if (vertexIndex !== -1) {
          if (e.altKey) useStore.getState().removeVertex(area.id, vertexIndex);
          else {
            drag.current = { kind: 'vertex', areaId: area.id, index: vertexIndex };
            capturePointer(e);
          }
          return;
        }
        const midIndex = edgeMidpoints(area.points).findIndex(
          (m) => pxDistance(m, p) <= HIT_RADIUS,
        );
        if (midIndex !== -1) {
          useStore.getState().insertVertex(area.id, midIndex, p);
          drag.current = { kind: 'vertex', areaId: area.id, index: midIndex + 1 };
          capturePointer(e);
          return;
        }
        // Clicking outside the edited polygon leaves anchor-edit mode.
        if (hit?.id !== editingId) useStore.getState().setEditing(null);
      }
    }

    // Shift or Cmd/Ctrl extends the selection, matching every design tool.
    const additive = e.shiftKey || e.metaKey || e.ctrlKey;

    if (!hit) {
      // Empty space: start a marquee rather than only clearing the selection.
      if (!additive) useStore.getState().clearSelection();
      drag.current = { kind: 'marquee', origin: p, additive };
      setMarquee({ origin: p, current: p });
      capturePointer(e);
      return;
    }

    useStore.getState().select(hit.id, additive ? 'toggle' : 'replace');
    // A toggle that removed the region shouldn't then drag it.
    if (useStore.getState().selectedIds.includes(hit.id)) {
      drag.current = { kind: 'move', last: p, moved: false };
      capturePointer(e);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const p = toNorm(e);
    setCursor(p);

    const d = drag.current;
    if (!d) return;

    if (d.kind === 'vertex') {
      useStore.getState().moveVertex(d.areaId, d.index, p);
      return;
    }

    if (d.kind === 'marquee') {
      setMarquee({ origin: d.origin, current: p });
      return;
    }

    const dx = p.x - d.last.x;
    const dy = p.y - d.last.y;
    if (!d.moved && distance(toPx(p), toPx(d.last)) < DRAG_THRESHOLD) return;
    d.moved = true;
    d.last = p;
    useStore.getState().moveSelected(dx, dy);
  };

  const handlePointerUp = () => {
    const d = drag.current;
    if (d?.kind === 'marquee' && marquee) {
      const rect = rectBetween(marquee.origin, marquee.current);
      // Ignore an accidental micro-drag: that was a click on empty space.
      if (rect.width * size.width > DRAG_THRESHOLD || rect.height * size.height > DRAG_THRESHOLD) {
        const caught = visibleAreas
          .filter((a) => polygonIntersectsRect(a.points, rect))
          .map((a) => a.id);
        const existing = d.additive ? useStore.getState().selectedIds : [];
        useStore.getState().selectMany([...new Set([...existing, ...caught])]);
      }
    }
    setMarquee(null);
    drag.current = null;
  };

  const handleDoubleClick = (e: React.PointerEvent<SVGSVGElement>) => {
    if (drawing) {
      // A double click finishes an open polygon without returning to the origin.
      if (draft.length >= MIN_VERTICES) useStore.getState().commitDraft();
      return;
    }
    const p = toNorm(e);
    const hit = [...visibleAreas].reverse().find((a) => pointInPolygon(p, a.points));
    if (hit) useStore.getState().setEditing(hit.id);
  };

  useEffect(() => {
    if (!drawing) setCursor(null);
  }, [drawing]);

  // ── Rendering helpers ──────────────────────────────────────────────────

  const pathFor = (points: Point[], close: boolean) => {
    const d = points
      .map(toPx)
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
      .join(' ');
    return close ? `${d} Z` : d;
  };

  const renderArea = (area: Area) => {
    const label = getLabel(area.label);
    const selected = selectedIds.includes(area.id);
    const editing = area.id === editingId;
    const highlighted = selected || area.id === hoveredId;
    // The id badge is only legible on a single selection; a multi-selection
    // would stack badges on top of one another.
    const showBadge = selected && selectedIds.length === 1;
    const box = boundingBox(area.points);
    const topLeft = toPx({ x: box.x, y: box.y });
    const boxSize = { w: box.width * size.width, h: box.height * size.height };

    return (
      <g key={area.id}>
        <path
          className={`poly ${tool === 'select' ? 'poly--interactive' : ''}`}
          d={pathFor(area.points, true)}
          fill={label.color}
          fillOpacity={editing ? 0.36 : highlighted ? 0.26 : 0.16}
          stroke={label.color}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />

        {selected && !editing && (
          <>
            {/* Bounding box with corner handles — the design's "selected" state. */}
            <rect
              x={topLeft.x}
              y={topLeft.y}
              width={boxSize.w}
              height={boxSize.h}
              fill="none"
              stroke="#3f3f46"
              strokeWidth={1}
            />
            {[
              [topLeft.x, topLeft.y],
              [topLeft.x + boxSize.w, topLeft.y],
              [topLeft.x, topLeft.y + boxSize.h],
              [topLeft.x + boxSize.w, topLeft.y + boxSize.h],
            ].map(([x, y], i) => (
              <rect
                key={i}
                x={x - 3}
                y={y - 3}
                width={6}
                height={6}
                fill="#fff"
                stroke="#3f3f46"
                strokeWidth={1}
              />
            ))}

            {/* Id badge. Clicking it switches the region's category (design note 6). */}
            {showBadge && (
            <g
              transform={`translate(${topLeft.x}, ${topLeft.y - 20})`}
              style={{ cursor: 'pointer' }}
              onPointerDown={(e) => {
                e.stopPropagation();
                setLabelMenu({ areaId: area.id, x: e.clientX, y: e.clientY });
              }}
            >
              <rect
                width={area.id.length * 7 + 12}
                height={17}
                rx={2}
                fill={label.color}
              />
              <text className="area-badge" x={6} y={12}>
                {area.id}
              </text>
            </g>
            )}
          </>
        )}

        {editing &&
          area.points.map((pt, i) => {
            const c = toPx(pt);
            return (
              <circle
                key={`v${i}`}
                className="handle"
                cx={c.x}
                cy={c.y}
                r={4}
                fill="#fff"
                stroke={label.color}
                strokeWidth={1.6}
              />
            );
          })}

        {editing &&
          edgeMidpoints(area.points).map((pt, i) => {
            const c = toPx(pt);
            return (
              <circle
                key={`m${i}`}
                className="handle handle--add"
                cx={c.x}
                cy={c.y}
                r={3}
                fill="#fff"
                fillOpacity={0.7}
                stroke={label.color}
                strokeWidth={1.2}
                strokeDasharray="1.5 1.5"
              />
            );
          })}
      </g>
    );
  };

  const draftLabel = getLabel(activeLabel);

  return (
    <div className="stage">
      <div className="stage__frame" ref={frameRef}>
        <img className="stage__image" src={TABLE_IMAGE.source} alt="Table camera frame" draggable={false} />

        <svg
          className={`stage__svg ${drawing ? 'stage__svg--draw' : 'stage__svg--select'}`}
          width={size.width}
          height={size.height}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={() => {
            handlePointerUp();
            setCursor(null);
          }}
          onDoubleClick={handleDoubleClick}
        >
          {visibleAreas.map(renderArea)}

          {/* ── Draft polygon ─────────────────────────────────────────── */}
          {draft.length > 0 && (
            <g pointerEvents="none">
              {draft.length >= MIN_VERTICES && (
                <path d={pathFor(draft, true)} fill={draftLabel.color} fillOpacity={0.12} />
              )}

              {/* Committed segments are solid blue… */}
              <path
                d={pathFor(draft, false)}
                fill="none"
                stroke="#4f46e5"
                strokeWidth={1.5}
                strokeLinejoin="round"
              />

              {/* …the segment tracking the cursor is a lighter "pretend" line. */}
              {cursor && (
                <line
                  x1={toPx(draft[draft.length - 1]).x}
                  y1={toPx(draft[draft.length - 1]).y}
                  x2={toPx(canClose ? draft[0] : cursor).x}
                  y2={toPx(canClose ? draft[0] : cursor).y}
                  stroke={canClose ? '#4f46e5' : '#a5b4fc'}
                  strokeWidth={1.5}
                />
              )}

              {draft.map((pt, i) => {
                const c = toPx(pt);
                const isLast = i === draft.length - 1;
                const isCloseTarget = i === 0 && canClose;
                return (
                  <circle
                    key={i}
                    cx={c.x}
                    cy={c.y}
                    r={isCloseTarget ? 5 : 3.5}
                    // The most recent anchor is filled; earlier ones stay hollow.
                    fill={isLast || isCloseTarget ? '#4f46e5' : '#fff'}
                    stroke={isLast || isCloseTarget ? '#fff' : '#4f46e5'}
                    strokeWidth={1.5}
                  />
                );
              })}
            </g>
          )}

          {/* Marquee selection rectangle. */}
          {marquee &&
            (() => {
              const r = rectBetween(marquee.origin, marquee.current);
              const tl = toPx({ x: r.x, y: r.y });
              return (
                <rect
                  x={tl.x}
                  y={tl.y}
                  width={r.width * size.width}
                  height={r.height * size.height}
                  fill="#4f46e5"
                  fillOpacity={0.08}
                  stroke="#4f46e5"
                  strokeWidth={1}
                  strokeDasharray="4 3"
                  pointerEvents="none"
                />
              );
            })()}

          {/* The anchor that would be placed next. */}
          {drawing && cursor && !canClose && (
            <circle
              cx={toPx(cursor).x}
              cy={toPx(cursor).y}
              r={3.5}
              fill="#fff"
              fillOpacity={0.6}
              stroke="#4f46e5"
              strokeWidth={1.5}
              pointerEvents="none"
            />
          )}
        </svg>
      </div>

      <StageHint
        drawing={drawing}
        draftLength={draft.length}
        editing={!!editingId}
        canClose={canClose}
        selectedCount={selectedIds.length}
      />

      {labelMenu && (
        <LabelMenu
          x={labelMenu.x}
          y={labelMenu.y}
          current={areas.find((a) => a.id === labelMenu.areaId)?.label ?? ''}
          onPick={(labelId) => {
            useStore.getState().relabelArea(labelMenu.areaId, labelId);
            setLabelMenu(null);
          }}
          onClose={() => setLabelMenu(null)}
        />
      )}
    </div>
  );
}

/** Platform-appropriate name for the copy/paste modifier key. */
const MOD = /Mac|iPhone|iPad/i.test(
  typeof navigator === 'undefined' ? '' : navigator.userAgent,
)
  ? '⌘'
  : 'Ctrl';

function StageHint({
  drawing,
  draftLength,
  editing,
  canClose,
  selectedCount,
}: {
  drawing: boolean;
  draftLength: number;
  editing: boolean;
  canClose: boolean;
  selectedCount: number;
}) {
  let content: React.ReactNode = null;

  if (drawing && draftLength === 0) content = <>Click to place the first anchor point</>;
  else if (canClose) content = <>Click the first point to close this area</>;
  else if (drawing && draftLength < MIN_VERTICES)
    content = (
      <>
        Keep clicking to add points · <kbd>Esc</kbd> cancels
      </>
    );
  else if (drawing)
    content = (
      <>
        Click the first point or double-click to close · <kbd>Backspace</kbd> undoes a point
      </>
    );
  else if (editing)
    content = (
      <>
        Drag anchors to reshape · click a dashed midpoint to add · <kbd>Alt</kbd>+click removes
      </>
    );
  else if (selectedCount > 1)
    content = (
      <>
        {selectedCount} selected · drag to move together · <kbd>Delete</kbd> removes all ·{' '}
        <kbd>Esc</kbd> clears
      </>
    );
  else if (selectedCount === 1)
    content = (
      <>
        Drag to move · double-click to reshape · <kbd>Shift</kbd>+click or drag a box to
        multi-select
      </>
    );
  else
    content = (
      <>
        Drag a box to select several regions · <kbd>{MOD}</kbd>
        <kbd>C</kbd>/<kbd>{MOD}</kbd>
        <kbd>V</kbd> to copy and paste
      </>
    );

  if (!content) return null;
  return <div className="hint">{content}</div>;
}

function LabelMenu({
  x,
  y,
  current,
  onPick,
  onClose,
}: {
  x: number;
  y: number;
  current: string;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const close = () => onClose();
    // Deferred so the click that opened the menu doesn't immediately close it.
    const id = window.setTimeout(() => window.addEventListener('pointerdown', close), 0);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('pointerdown', close);
    };
  }, [onClose]);

  return (
    <div
      className="popover"
      style={{ left: x, top: y + 8 }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {LABELS.map((l) => (
        <button key={l.id} className="popover__item" onClick={() => onPick(l.id)}>
          <span className="popover__swatch" style={{ background: l.color }} />
          {l.id}
          {l.id === current && (
            <span className="popover__check">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4.5 12.5l5 5 10-11" />
              </svg>
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
