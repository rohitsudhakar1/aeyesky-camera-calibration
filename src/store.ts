import { create } from 'zustand';
import type { Area, LabelId, Point, Tool } from './types';
import { generateId, translatePolygon, clampPoint } from './lib/geometry';
import { LABELS } from './config';

/** Minimum vertices before a polygon can be closed. */
export const MIN_VERTICES = 3;

interface CalibrationState {
  areas: Area[];
  tool: Tool;
  /** Label applied to the next polygon drawn. */
  activeLabel: LabelId;

  /** Vertices of the polygon currently being drawn (empty when idle). */
  draft: Point[];

  selectedId: string | null;
  /** Selected AND double-clicked — anchor points become draggable. */
  editingId: string | null;
  /** Row hovered in the layer panel, so the canvas can echo the highlight. */
  hoveredId: string | null;

  search: string;
  lastSavedAt: string | null;
  /** Area queued for deletion, awaiting dialog confirmation. */
  pendingDelete: { kind: 'area'; id: string } | { kind: 'label'; label: LabelId } | null;

  setTool: (tool: Tool) => void;
  setActiveLabel: (label: LabelId) => void;
  setSearch: (search: string) => void;

  addDraftPoint: (p: Point) => void;
  undoDraftPoint: () => void;
  cancelDraft: () => void;
  /** Closes the draft into a real Area. No-op below MIN_VERTICES. */
  commitDraft: () => void;

  select: (id: string | null) => void;
  setEditing: (id: string | null) => void;
  setHovered: (id: string | null) => void;

  moveVertex: (areaId: string, index: number, p: Point) => void;
  insertVertex: (areaId: string, index: number, p: Point) => void;
  removeVertex: (areaId: string, index: number) => void;
  moveArea: (areaId: string, dx: number, dy: number) => void;
  relabelArea: (areaId: string, label: LabelId) => void;

  toggleAreaVisible: (areaId: string) => void;
  toggleLabelVisible: (label: LabelId) => void;

  requestDelete: (target: CalibrationState['pendingDelete']) => void;
  confirmDelete: () => void;

  markSaved: (at: string) => void;
}

export const useStore = create<CalibrationState>((set, get) => ({
  areas: [],
  tool: 'select',
  activeLabel: LABELS[0].id,
  draft: [],
  selectedId: null,
  editingId: null,
  hoveredId: null,
  search: '',
  lastSavedAt: null,
  pendingDelete: null,

  setTool: (tool) =>
    set((s) => ({
      tool,
      // Switching away from the pen abandons a half-drawn polygon.
      draft: tool === 'polygon' ? s.draft : [],
      selectedId: tool === 'polygon' ? null : s.selectedId,
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
    set((s) => ({ areas: [...s.areas, area], draft: [], selectedId: area.id }));
  },

  select: (selectedId) => set((s) => ({ selectedId, editingId: s.editingId === selectedId ? s.editingId : null })),
  setEditing: (editingId) => set({ editingId, ...(editingId ? { selectedId: editingId } : {}) }),
  setHovered: (hoveredId) => set({ hoveredId }),

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

  moveArea: (areaId, dx, dy) =>
    set((s) => ({
      areas: s.areas.map((a) =>
        a.id === areaId ? { ...a, points: translatePolygon(a.points, dx, dy) } : a,
      ),
    })),

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
        target.kind === 'area'
          ? s.areas.filter((a) => a.id !== target.id)
          : s.areas.filter((a) => a.label !== target.label);
      const stillExists = (id: string | null) => (id && areas.some((a) => a.id === id) ? id : null);
      return {
        areas,
        pendingDelete: null,
        selectedId: stillExists(s.selectedId),
        editingId: stillExists(s.editingId),
      };
    }),

  markSaved: (lastSavedAt) => set({ lastSavedAt }),
}));

/** Areas of a label, in draw order — the index is the badge number in the UI. */
export const areasByLabel = (areas: Area[], label: LabelId) =>
  areas.filter((a) => a.label === label);
