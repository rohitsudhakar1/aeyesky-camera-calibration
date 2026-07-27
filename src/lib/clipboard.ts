import type { ClipboardRegion } from '../store';
import { LABELS } from '../config';

/**
 * Regions are mirrored to the OS clipboard as JSON so they can be pasted into
 * another tab, another session, or a text editor. The in-app clipboard remains
 * the source of truth — everything here is best-effort and degrades silently,
 * because clipboard access depends on permissions and focus that a calibration
 * operator should never have to think about.
 */
interface ClipboardEnvelope {
  aeyeskyRegions: 1;
  regions: Array<{ label: string; polygon: Array<[number, number]> }>;
}

const KNOWN_LABELS = new Set(LABELS.map((l) => l.id));

export const serializeRegions = (regions: ClipboardRegion[]): string =>
  JSON.stringify(
    {
      aeyeskyRegions: 1,
      regions: regions.map((r) => ({
        label: r.label,
        polygon: r.points.map((p) => [p.x, p.y] as [number, number]),
      })),
    } satisfies ClipboardEnvelope,
    null,
    2,
  );

/** Parses text off the clipboard, returning null for anything unrecognised. */
export const parseRegions = (text: string): ClipboardRegion[] | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }

  const envelope = parsed as Partial<ClipboardEnvelope>;
  if (envelope?.aeyeskyRegions !== 1 || !Array.isArray(envelope.regions)) return null;

  const regions = envelope.regions.flatMap<ClipboardRegion>((entry) => {
    if (!entry || !Array.isArray(entry.polygon)) return [];

    const points = entry.polygon
      .filter(
        (p): p is [number, number] =>
          Array.isArray(p) &&
          p.length === 2 &&
          p.every((n) => typeof n === 'number' && isFinite(n)),
      )
      .map(([x, y]) => ({ x, y }));
    if (points.length < 3) return [];

    // An unknown label would render with fallback styling and break the counts,
    // so regions from a different label catalogue are dropped.
    if (typeof entry.label !== 'string' || !KNOWN_LABELS.has(entry.label)) return [];

    return [{ label: entry.label, points }];
  });

  return regions.length ? regions : null;
};

export const writeToSystemClipboard = async (regions: ClipboardRegion[]): Promise<void> => {
  try {
    await navigator.clipboard?.writeText(serializeRegions(regions));
  } catch {
    /* denied or unavailable — the in-app clipboard still holds the regions */
  }
};

export const readFromSystemClipboard = async (): Promise<ClipboardRegion[] | null> => {
  try {
    const text = await navigator.clipboard?.readText();
    return text ? parseRegions(text) : null;
  } catch {
    return null;
  }
};
