import { INDEX_CONSTITUENTS } from '../../constants/screenerConfig';

export const ALL_UNIVERSE = 'ALL NSE';
export const UNIVERSE_IDS = [ALL_UNIVERSE, ...Object.keys(INDEX_CONSTITUENTS)];
export const COLS_KEY = 'stockoracle_screener_cols_v1';
