import type { LabelDef } from './types';

/**
 * The label catalogue. In a real deployment this would come from the backend
 * per table type (blackjack / baccarat / roulette …) — it is data-driven here
 * so adding a category is a one-line change with no component edits.
 */
export const LABELS: LabelDef[] = [
  {
    id: 'main_bet',
    displayName: 'Main Bet',
    required: 7, // a blackjack table has seven betting spots
    color: '#4338CA',
    tint: '#E0E1FC',
  },
  {
    id: 'chip_tray',
    displayName: 'Chip Tray',
    required: 1,
    color: '#22C1DE',
    tint: '#D2F3F9',
  },
];

export const CAMERA_ID = 'DSH-4532';

/** Background frame captured from the camera being calibrated. */
export const TABLE_IMAGE = {
  source: '/table.jpg',
  width: 1293,
  height: 893,
};

export const getLabel = (id: string): LabelDef =>
  LABELS.find((l) => l.id === id) ?? LABELS[0];
