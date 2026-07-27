import { useRef } from 'react';
import { useStore, areasByLabel } from '../store';
import { LABELS } from '../config';
import { EyeIcon, EyeOffIcon, SearchIcon, TrashIcon } from './icons';

/**
 * The LABELLED AREA section: every drawn region, grouped by label, with
 * per-row visibility and delete, and two-way selection sync with the canvas.
 * Supports Cmd/Ctrl+click to toggle and Shift+click to extend a range, so
 * several regions can be deleted in one action.
 */
export function LayerPanel() {
  const areas = useStore((s) => s.areas);
  const search = useStore((s) => s.search);
  const selectedIds = useStore((s) => s.selectedIds);
  const setSearch = useStore((s) => s.setSearch);
  const select = useStore((s) => s.select);
  const selectMany = useStore((s) => s.selectMany);
  const clearSelection = useStore((s) => s.clearSelection);
  const setHovered = useStore((s) => s.setHovered);
  const toggleAreaVisible = useStore((s) => s.toggleAreaVisible);
  const toggleLabelVisible = useStore((s) => s.toggleLabelVisible);
  const requestDelete = useStore((s) => s.requestDelete);
  const setTool = useStore((s) => s.setTool);

  /** Anchor for Shift+click ranges — the last row clicked without Shift. */
  const anchorId = useRef<string | null>(null);

  const query = search.trim().toLowerCase();
  const groups = LABELS.map((label) => {
    const all = areasByLabel(areas, label.id);
    return {
      label,
      all,
      // Index badges stay tied to draw order, so filtering must not renumber.
      matches: all
        .map((area, index) => ({ area, index }))
        .filter(
          ({ area }) =>
            !query ||
            area.id.toLowerCase().includes(query) ||
            label.id.includes(query) ||
            label.displayName.toLowerCase().includes(query),
        ),
    };
  }).filter((g) => g.matches.length > 0);

  /** Rows in the order they appear, so Shift+click can span groups. */
  const visibleOrder = groups.flatMap((g) => g.matches.map((m) => m.area.id));

  const handleRowClick = (e: React.MouseEvent, id: string) => {
    setTool('select');

    if (e.shiftKey && anchorId.current) {
      const from = visibleOrder.indexOf(anchorId.current);
      const to = visibleOrder.indexOf(id);
      if (from !== -1 && to !== -1) {
        const [lo, hi] = from < to ? [from, to] : [to, from];
        selectMany(visibleOrder.slice(lo, hi + 1));
        return;
      }
    }

    if (e.metaKey || e.ctrlKey) {
      select(id, 'toggle');
    } else {
      select(id);
    }
    anchorId.current = id;
  };

  const deleteFromRow = (id: string) => {
    // Deleting a row that is part of a multi-selection removes the whole
    // selection — otherwise the trash icon would contradict the highlight.
    const ids = selectedIds.length > 1 && selectedIds.includes(id) ? selectedIds : [id];
    requestDelete({ kind: 'areas', ids });
  };

  return (
    <section className="section">
      <header className="section__header">LABELLED AREA</header>
      <div className="section__body">
        <div className="search">
          <SearchIcon />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search All"
            aria-label="Search labelled areas"
          />
        </div>

        {selectedIds.length > 1 && (
          <div className="selection-bar">
            <span>{selectedIds.length} selected</span>
            <button onClick={clearSelection}>Clear</button>
            <button
              className="selection-bar__delete"
              onClick={() => requestDelete({ kind: 'areas', ids: selectedIds })}
            >
              Delete
            </button>
          </div>
        )}

        {areas.length === 0 && (
          <p className="empty">
            No areas yet. Pick a label above, then draw a polygon on the table image with the
            polygon tool.
          </p>
        )}

        {areas.length > 0 && groups.length === 0 && (
          <p className="empty">No areas match “{search}”.</p>
        )}

        {groups.map(({ label, all, matches }) => {
          const groupVisible = all.some((a) => a.visible);

          return (
            <div className="layer-group" key={label.id}>
              <div className="layer-row">
                <button
                  className={`icon-btn ${groupVisible ? '' : 'icon-btn--muted'}`}
                  onClick={() => toggleLabelVisible(label.id)}
                  aria-label={`${groupVisible ? 'Hide' : 'Show'} all ${label.displayName} areas`}
                  title={`${groupVisible ? 'Hide' : 'Show'} all`}
                >
                  {groupVisible ? <EyeIcon /> : <EyeOffIcon />}
                </button>
                <span className="layer-row__name">
                  <button
                    className="chip chip--button"
                    style={{ background: label.tint }}
                    onClick={() => selectMany(all.map((a) => a.id))}
                    title={`Select all ${label.displayName} areas`}
                  >
                    <span className="chip__bar" style={{ background: label.color }} />
                    {label.id}
                  </button>
                </span>
                <button
                  className="icon-btn icon-btn--delete"
                  onClick={() => requestDelete({ kind: 'label', label: label.id })}
                  aria-label={`Delete all ${label.displayName} areas`}
                  title="Delete all areas with this label"
                >
                  <TrashIcon />
                </button>
              </div>

              {matches.map(({ area, index }) => {
                const selected = selectedIds.includes(area.id);
                return (
                  <div
                    key={area.id}
                    className={[
                      'layer-row',
                      'layer-row--area',
                      selected ? 'layer-row--selected' : '',
                      area.visible ? '' : 'layer-row--hidden',
                    ].join(' ')}
                    // Selection and index badge take the label's own colour, so a
                    // chip_tray row highlights in its blue rather than main_bet's indigo.
                    style={
                      {
                        '--row-accent': label.color,
                        '--row-tint': label.tint,
                      } as React.CSSProperties
                    }
                    onClick={(e) => handleRowClick(e, area.id)}
                    onMouseEnter={() => setHovered(area.id)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    <button
                      className={`icon-btn ${area.visible ? '' : 'icon-btn--muted'}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleAreaVisible(area.id);
                      }}
                      aria-label={`${area.visible ? 'Hide' : 'Show'} area ${area.id}`}
                    >
                      {area.visible ? <EyeIcon /> : <EyeOffIcon />}
                    </button>
                    <span className="index">{index + 1}</span>
                    <span className="layer-row__name">{area.id}</span>
                    <button
                      className="icon-btn icon-btn--delete"
                      disabled={!area.visible}
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteFromRow(area.id);
                      }}
                      aria-label={`Delete area ${area.id}`}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </section>
  );
}
