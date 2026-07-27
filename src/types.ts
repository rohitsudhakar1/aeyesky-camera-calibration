/**
 * A point in NORMALISED image space.
 *
 *   x ∈ [0, 1] measured left → right from the image's left edge
 *   y ∈ [0, 1] measured top  → bottom from the image's top edge
 *
 * Normalised (rather than pixel) coordinates are stored so a calibration stays
 * valid if the same camera feed is later delivered at a different resolution,
 * and so the editor can be resized/zoomed without rewriting the data.
 * To convert to pixels: px = x * image.width, py = y * image.height.
 */
export type Point = { x: number; y: number };

export type LabelId = string;

/** A label category an operator can assign to a region. */
export interface LabelDef {
  id: LabelId;
  /** Human readable name used in dialogs, e.g. "Main Bet". */
  displayName: string;
  /** How many regions of this label a complete calibration needs. */
  required: number;
  /** Accent colour — the left bar on the chip and the polygon stroke. */
  color: string;
  /** Chip background tint. */
  tint: string;
}

/** One labelled region drawn on the table image. */
export interface Area {
  id: string;
  label: LabelId;
  /** Polygon vertices in draw order. Implicitly closed (last → first). */
  points: Point[];
  /** Layer visibility toggle — purely an editor concern, but persisted. */
  visible: boolean;
  createdAt: string;
}

export type Tool = 'select' | 'polygon';

/** Shape of the file produced by "Save Calibration". */
export interface CalibrationFile {
  version: 1;
  cameraId: string;
  savedAt: string;
  image: { source: string; width: number; height: number };
  coordinateSystem: {
    space: 'normalized';
    origin: 'top-left';
    xAxis: 'left-to-right';
    yAxis: 'top-to-bottom';
    range: [0, 1];
    note: string;
  };
  areas: Array<{
    id: string;
    label: LabelId;
    polygon: Array<[number, number]>;
    visible: boolean;
    createdAt: string;
  }>;
}
