import { useEffect, useState } from 'react';
import { CanvasStage } from './components/CanvasStage';
import { Toolbar } from './components/Toolbar';
import { LabelPanel } from './components/LabelPanel';
import { LayerPanel } from './components/LayerPanel';
import { ConfirmDialog } from './components/ConfirmDialog';
import { useStore, MIN_VERTICES } from './store';
import { CAMERA_ID, LABELS } from './config';
import {
  buildCalibration,
  downloadCalibration,
  formatTimestamp,
  loadLocal,
  saveLocal,
  toAreas,
} from './lib/persistence';

export default function App() {
  const [toast, setToast] = useState<string | null>(null);

  // Restore the last session's work.
  useEffect(() => {
    const file = loadLocal();
    if (file) useStore.setState({ areas: toAreas(file), lastSavedAt: file.savedAt });
  }, []);

  useKeyboardShortcuts();

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(id);
  }, [toast]);

  const handleSave = () => {
    const { areas } = useStore.getState();
    const savedAt = new Date().toISOString();
    const file = buildCalibration(areas, savedAt);
    saveLocal(file);
    downloadCalibration(file);
    useStore.getState().markSaved(savedAt);

    const missing = LABELS.filter(
      (l) => areas.filter((a) => a.label === l.id).length < l.required,
    );
    const noun = `${areas.length} ${areas.length === 1 ? 'area' : 'areas'}`;
    setToast(
      missing.length
        ? `Saved ${noun} — still incomplete: ${missing.map((m) => m.id).join(', ')}`
        : `Saved ${noun} · calibration complete`,
    );
  };

  return (
    <div className="app">
      <main className="workspace">
        <div className="stage-card">
          <h1 className="stage-card__title">{CAMERA_ID}</h1>
          <CanvasStage />
        </div>
        <Toolbar />
      </main>

      <aside className="sidebar">
        <LabelPanel />
        <LayerPanel />
        <SaveFooter onSave={handleSave} />
      </aside>

      <ConfirmDialog />
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function SaveFooter({ onSave }: { onSave: () => void }) {
  const lastSavedAt = useStore((s) => s.lastSavedAt);
  const areaCount = useStore((s) => s.areas.length);

  return (
    <footer className="footer">
      <div className="footer__meta">
        <span>LAST SAVE:</span>
        <strong>{lastSavedAt ? formatTimestamp(lastSavedAt) : '—'}</strong>
      </div>
      <button className="btn-save" onClick={onSave} disabled={areaCount === 0}>
        Save Calibration
      </button>
    </footer>
  );
}

function useKeyboardShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.isContentEditable) return;

      const s = useStore.getState();
      // The confirmation dialog owns the keyboard while it is open.
      if (s.pendingDelete) return;

      switch (e.key) {
        case 'Escape':
          if (s.draft.length) s.cancelDraft();
          else if (s.editingId) s.setEditing(null);
          else s.select(null);
          break;
        case 'Enter':
          if (s.draft.length >= MIN_VERTICES) s.commitDraft();
          break;
        case 'Backspace':
        case 'Delete':
          if (s.draft.length) s.undoDraftPoint();
          else if (s.selectedId) s.requestDelete({ kind: 'area', id: s.selectedId });
          break;
        case 'v':
        case 'V':
          s.setTool('select');
          break;
        case 'p':
        case 'P':
          s.setTool('polygon');
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
