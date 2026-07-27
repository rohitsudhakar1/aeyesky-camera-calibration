import { create } from 'zustand';
import type { Area, LabelId, Point, Tool } from './types';
import { generateId, translatePolygon, clampPoint, clampGroupDelta } from './lib/geometry';
import { LABELS } from './config';

/** Minimum vertices before a polygon can be closed. */
export const MIN_VERTICES = 3;

/** How far each successive paste is offset, so copies don't hide underneath. */
const PASTE_OFFSET = 0.02;

/** A region on the clipboard: geometry and label, but no identity. */
export interface ClipboardRegion {
  label: LabelId;
  points: Point[];
}

/** How a click combines with the existing selection. */
export type SelectMode = 'replace' | 'toggle';

export type DeleteTarget =
  | { kind: 'areas'; ids: string[] }
  | { kind: 'label'; label: LabelId };

interface CalibrationState {
  areas: Area[];
  tool: Tool;
  /** Label applied to the next polygon drawn. */
  activeLabel: LabelId;

  /** Vertices of the polygon currently being drawn (empty when idle). */
  draft: Point[];

  /** Every selected region, in the order they were added to the selection. */
  selectedIds: string[];
  /** Selected AND double-clicked — anchor points become draggable. Single only. */
  editingId: string | null;
  /** Row hovered in the layer panel, so the canvas can echo the highlight. */
  hoveredId: string | null;

  search: string;
  lastSavedAt: string | null;
  /** Copied regions, held in-app so paste works without clipboard permissions. */
  clipboard: ClipboardRegion[] | null;
  /** Consecutive pastes of the same clipboard, used to cascade the offset. */
  pasteCount: number;
  pendingDelete: DeleteTarget | null;

  setTool: (tool: Tool) => void;
  setActiveLabel: (label: LabelId) => void;
  setSearch: (search: string) => void;

  addDraftPoint: (p: Point) => void;
  undoDraftPoint: () => void;
  cancelDraft: () => void;
  /** Closes the draft into a real Area. No-op below MIN_VERTICES. */
  commitDraft: () => void;

  /** Selects one region. `toggle` adds/removes it, keeping the rest. */
  select: (id: string | null, mode?: SelectMode) => void;
  /** Replaces the selection wholesale — used for range and select-all. */
  selectMany: (ids: string[]) => void;
  clearSelection: () => void;
  setEditing: (id: string | null) => void;
  setHovered: (id: string | null) => void;

  /** Copies every selected region. Returns them for the OS clipboard. */
  copySelected: () => ClipboardRegion[] | null;
  /** Pastes `regions` (or the in-app clipboard). Returns the new ids. */
  paste: (regions?: ClipboardRegion[]) => string[];
  duplicateSelected: () => string[];

  moveVertex: (areaId: string, index: number, p: Point) => void;
  insertVertex: (areaId: string, index: number, p: Point) => void;
  removeVertex: (areaId: string, index: number) => void;
  /** Moves the whole selection together. */
  moveSelected: (dx: number, dy: number) => void;
  relabelArea: (areaId: string, label: LabelId) => void;

  toggleAreaVisible: (areaId: string) => void;
  toggleLabelVisible: (label: LabelId) => void;

  requestDelete: (target: DeleteTarget | null) => void;
  confirmDelete: () => void;

  markSaved: (at: string) => void;
}

export const useStore = create<CalibrationState>((set, get) => ({
  areas: [],
  tool: 'select',
  activeLabel: LABELS[0].id,
  draft: [],
  selectedIds: [],
  editingId: null,
  hoveredId: null,
  search: '',
  lastSavedAt: null,
  clipboard: null,
  pasteCount: 0,
  pendingDelete: null,

  setTool: (tool) =>
    set((s) => ({
      tool,
      // Switching away from the pen abandons a half-drawn polygon.
      draft: tool === 'polygon' ? s.draft : [],
      selectedIds: tool === 'polygon' ? [] : s.selectedIds,
      editingId: null,
    })),

  setActiveLabel: (activeLabel) => set({ activeLabel }),
  setSearch: (search) => set({ search }),

  addDraftPoint: (p) => set((s) => ({ draft: [...s.draft, clampPoint(p)] })),
  undoDraftPoint: () => set((s) => ({ draft: s.draft.slice(0, -1) })),
  cancelDraft: () => set({ draft: [] }),

  commitDraft: () => {
    const { draft, activeLabel } = get();
    if (draft.length < MIN_VERTICES) return;
    const area: Area = {
      id: generateId(),
      label: activeLabel,
      points: draft,
      visible: true,
      createdAt: new Date().toISOString(),
    };
    // Stay on the pen: operators draw several regions of the same label in a row.
    set((s) => ({ areas: [...s.areas, area], draft: [], selectedIds: [area.id] }));
  },

  select: (id, mode = 'replace') =>
    set((s) => {
      if (id === null) return { selectedIds: [], editingId: null };
      if (mode === 'toggle') {
        const next = s.selectedIds.includes(id)
          ? s.selectedIds.filter((x) => x !== id)
          : [...s.selectedIds, id];
        return { selectedIds: next, editingId: null };
      }
      // Re-clicking inside an existing multi-selection keeps it, so a drag can
      // move the whole group rather than collapsing it to the clicked region.
      if (s.selectedIds.length > 1 && s.selectedIds.includes(id)) return {};
      return { selectedIds: [id], editingId: s.editingId === id ? s.editingId : null };
    }),

  selectMany: (ids) => set({ selectedIds: ids, editingId: null }),
  clearSelection: () => set({ selectedIds: [], editingId: null }),

  setEditing: (editingId) =>
    set((s) => ({
      editingId,
      // Anchor editing is single-region, so entering it narrows the selection.
      selectedIds: editingId ? [editingId] : s.selectedIds,
    })),

  setHovered: (hoveredId) => set({ hoveredId }),

  copySelected: () => {
    const { areas, selectedIds } = get();
    const regions = areas
      .filter((a) => selectedIds.includes(a.id))
      .map((a) => ({ label: a.label, points: a.points }));
    if (!regions.length) return null;
    set({ clipboard: regions, pasteCount: 0 });
    return regions;
  },

  paste: (regions) => {
    const source = regions ?? get().clipboard;
    if (!source?.length) return [];

    // Each paste steps further from the original so stacked copies stay
    // individually clickable. An external paste starts the cascade over.
    const step = regions ? 1 : get().pasteCount + 1;
    const offset = PASTE_OFFSET * step;

    const created = source
      .filter((r) => r.points.length >= MIN_VERTICES)
      .map<Area>((r) => ({
        id: generateId(),
        label: r.label,
        points: translatePolygon(r.points.map(clampPoint), offset, offset),
        visible: true,
        createdAt: new Date().toISOString(),
      }));
    if (!created.length) return [];

    set((s) => ({
      areas: [...s.areas, ...created],
      // Pasting external regions also loads them into the in-app clipboard, so
      // repeat pastes cascade from them rather than from whatever was copied here.
      clipboard: regions ?? s.clipboard,
      pasteCount: step,
      selectedIds: created.map((a) => a.id),
      editingId: null,
      tool: 'select',
      draft: [],
    }));
    return created.map((a) => a.id);
  },

  duplicateSelected: () => (get().copySelected() ? get().paste() : []),

  moveVertex: (areaId, index, p) =>
    set((s) => ({
      areas: s.areas.map((a) =>
        a.id === areaId
          ? { ...a, points: a.points.map((pt, i) => (i === index ? clampPoint(p) : pt)) }
          : a,
      ),
    })),

  insertVertex: (areaId, index, p) =>
    set((s) => ({
      areas: s.areas.map((a) => {
        if (a.id !== areaId) return a;
        const points = [...a.points];
        points.splice(index + 1, 0, clampPoint(p));
        return { ...a, points };
      }),
    })),

  removeVertex: (areaId, index) =>
    set((s) => ({
      areas: s.areas.map((a) =>
        a.id === areaId && a.points.length > MIN_VERTICES
          ? { ...a, points: a.points.filter((_, i) => i !== index) }
          : a,
      ),
    })),

  moveSelected: (dx, dy) =>
    set((s) => {
      const selected = s.areas.filter((a) => s.selectedIds.includes(a.id));
      if (!selected.length) return {};
      // One shared clamp across the group, so relative positions are preserved.
      const delta = clampGroupDelta(
        selected.map((a) => a.points),
        dx,
        dy,
      );
      if (delta.dx === 0 && delta.dy === 0) return {};
      return {
        areas: s.areas.map((a) =>
          s.selectedIds.includes(a.id)
            ? { ...a, points: a.points.map((p) => ({ x: p.x + delta.dx, y: p.y + delta.dy })) }
            : a,
        ),
      };
    }),

  relabelArea: (areaId, label) =>
    set((s) => ({ areas: s.areas.map((a) => (a.id === areaId ? { ...a, label } : a)) })),

  toggleAreaVisible: (areaId) =>
    set((s) => ({
      areas: s.areas.map((a) => (a.id === areaId ? { ...a, visible: !a.visible } : a)),
    })),

  toggleLabelVisible: (label) =>
    set((s) => {
      const group = s.areas.filter((a) => a.label === label);
      // The group toggle mirrors the design's header eye: if anything in the
      // group is visible, hide all; otherwise reveal all.
      const nextVisible = !group.some((a) => a.visible);
      return {
        areas: s.areas.map((a) => (a.label === label ? { ...a, visible: nextVisible } : a)),
      };
    }),

  requestDelete: (pendingDelete) => set({ pendingDelete }),

  confirmDelete: () =>
    set((s) => {
      const target = s.pendingDelete;
      if (!target) return { pendingDelete: null };
      const areas =
        target.kind === 'areas'
          ? s.areas.filter((a) => !target.ids.includes(a.id))
          : s.areas.filter((a) => a.label !== target.label);
      const alive = new Set(areas.map((a) => a.id));
      return {
        areas,
        pendingDelete: null,
        selectedIds: s.selectedIds.filter((id) => alive.has(id)),
        editingId: s.editingId && alive.has(s.editingId) ? s.editingId : null,
      };
    }),

  markSaved: (lastSavedAt) => set({ lastSavedAt }),
}));

/** Areas of a label, in draw order — the index is the badge number in the UI. */
export const areasByLabel = (areas: Area[], label: LabelId) =>
  areas.filter((a) => a.label === label);
