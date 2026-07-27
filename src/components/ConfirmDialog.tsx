import { useEffect } from 'react';
import { useStore, areasByLabel } from '../store';
import { getLabel } from '../config';
import { TrashIcon } from './icons';

export function ConfirmDialog() {
  const pending = useStore((s) => s.pendingDelete);
  const areas = useStore((s) => s.areas);
  const confirmDelete = useStore((s) => s.confirmDelete);
  const requestDelete = useStore((s) => s.requestDelete);

  const cancel = () => requestDelete(null);

  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancel();
      if (e.key === 'Enter') confirmDelete();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!pending) return null;

  let message: string;
  if (pending.kind === 'areas') {
    const targets = areas.filter((a) => pending.ids.includes(a.id));
    if (!targets.length) return null;
    message =
      targets.length === 1
        ? `Are you sure you want to delete ${getLabel(targets[0].label).displayName} ${
            targets[0].id
          } now?`
        : `Are you sure you want to delete these ${targets.length} labelled areas now?`;
  } else {
    const label = getLabel(pending.label);
    const count = areasByLabel(areas, pending.label).length;
    message = `Are you sure you want to delete all ${count} ${label.displayName} ${
      count === 1 ? 'area' : 'areas'
    } now?`;
  }

  return (
    <div className="scrim" onClick={cancel}>
      <div
        className="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-label="Delete labelled area"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog__head">
          <span className="dialog__icon">
            <TrashIcon size={17} />
          </span>
          <h2 className="dialog__title">Delete Labeled Area?</h2>
        </div>
        <p className="dialog__body">{message}</p>
        <div className="dialog__actions">
          <button className="btn btn--ghost" onClick={cancel}>
            Cancel
          </button>
          <button className="btn btn--danger" onClick={confirmDelete} autoFocus>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
