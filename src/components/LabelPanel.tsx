import { useStore, areasByLabel } from '../store';
import { LABELS } from '../config';
import { AlertIcon } from './icons';

/**
 * The LABEL section: picks the category applied to the next polygon and shows
 * progress towards a complete calibration (drawn / required).
 */
export function LabelPanel() {
  const areas = useStore((s) => s.areas);
  const activeLabel = useStore((s) => s.activeLabel);
  const setActiveLabel = useStore((s) => s.setActiveLabel);
  const setTool = useStore((s) => s.setTool);

  return (
    <section className="section">
      <header className="section__header">LABEL</header>
      <div className="section__body">
        {LABELS.map((label) => {
          const count = areasByLabel(areas, label.id).length;
          const incomplete = count < label.required;
          const active = label.id === activeLabel;

          return (
            <button
              key={label.id}
              className="label-row"
              aria-pressed={active}
              onClick={() => {
                setActiveLabel(label.id);
                setTool('polygon');
              }}
              title={`Draw a new ${label.displayName} area`}
            >
              <span className="chip" style={{ background: active ? label.tint : 'transparent' }}>
                <span className="chip__bar" style={{ background: label.color }} />
                {label.id}
              </span>
              <span className={`count ${incomplete ? 'count--incomplete' : ''}`}>
                {incomplete && <AlertIcon />}
                {count}/{label.required}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
