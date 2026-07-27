import { useStore, areasByLabel } from '../store';
import { LABELS } from '../config';
import { EyeIcon, EyeOffIcon, SearchIcon, TrashIcon } from './icons';

/**
 * The LABELLED AREA section: every drawn region, grouped by label, with
 * per-row visibility and delete, and two-way selection sync with the canvas.
 */
export function LayerPanel() {
  const areas = useStore((s) => s.areas);
  const search = useStore((s) => s.search);
  const selectedId = useStore((s) => s.selectedId);
  const setSearch = useStore((s) => s.setSearch);
  const select = useStore((s) => s.select);
  const setHovered = useStore((s) => s.setHovered);
  const toggleAreaVisible = useStore((s) => s.toggleAreaVisible);
  const toggleLabelVisible = useStore((s) => s.toggleLabelVisible);
  const requestDelete = useStore((s) => s.requestDelete);
  const setTool = useStore((s) => s.setTool);

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
                  <span className="chip" style={{ background: label.tint }}>
                    <span className="chip__bar" style={{ background: label.color }} />
                    {label.id}
                  </span>
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
                const selected = area.id === selectedId;
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
                    onClick={() => {
                      select(area.id);
                      setTool('select');
                    }}
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
                        requestDelete({ kind: 'area', id: area.id });
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
