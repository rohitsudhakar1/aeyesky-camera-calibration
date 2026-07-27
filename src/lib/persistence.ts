import type { Area, CalibrationFile } from '../types';
import { CAMERA_ID, TABLE_IMAGE } from '../config';

const STORAGE_KEY = 'aeyesky.calibration.v1';

/** Rounded to ~0.1px at 4K — plenty of precision, far more readable output. */
const round = (n: number) => Math.round(n * 1e5) / 1e5;

export const buildCalibration = (areas: Area[], savedAt: string): CalibrationFile => ({
  version: 1,
  cameraId: CAMERA_ID,
  savedAt,
  image: { ...TABLE_IMAGE },
  coordinateSystem: {
    space: 'normalized',
    origin: 'top-left',
    xAxis: 'left-to-right',
    yAxis: 'top-to-bottom',
    range: [0, 1],
    note: 'Polygon vertices are fractions of the source image. Multiply x by image.width and y by image.height for pixels. Vertices are in draw order and the ring is implicitly closed (last connects to first).',
  },
  areas: areas.map((a) => ({
    id: a.id,
    label: a.label,
    polygon: a.points.map((p) => [round(p.x), round(p.y)] as [number, number]),
    visible: a.visible,
    createdAt: a.createdAt,
  })),
});

/** Stands in for a POST to the calibration service. */
export const downloadCalibration = (file: CalibrationFile) => {
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `calibration-${file.cameraId}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

/**
 * Local persistence so a reload doesn't lose an operator's work. A real build
 * would reconcile this against the server copy on load.
 */
export const saveLocal = (file: CalibrationFile) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(file));
  } catch {
    // Storage may be unavailable (private mode, quota) — saving the file is
    // the operation that matters, so a failure here is not surfaced.
  }
};

export const loadLocal = (): CalibrationFile | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CalibrationFile;
    return parsed?.version === 1 && Array.isArray(parsed.areas) ? parsed : null;
  } catch {
    return null;
  }
};

export const toAreas = (file: CalibrationFile): Area[] =>
  file.areas.map((a) => ({
    id: a.id,
    label: a.label,
    points: a.polygon.map(([x, y]) => ({ x, y })),
    visible: a.visible ?? true,
    createdAt: a.createdAt,
  }));

export const formatTimestamp = (iso: string) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}, ${d
    .getHours()
    .toString()
    .padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};
