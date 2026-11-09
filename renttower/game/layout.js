// Structural metrics of the cross-section, in building-local units.
// Local origin: x = 0 at the building's left edge, y = 0 at the ground line; floors stack toward -y.
// The elevator tower stands against the left wall, from x = -LIFT.w to 0.
export const M = {
  roomW: 88, roomH: 88, gap: 26, side: 6, slab: 9,
  lobby: 66, sidewalk: 7, roof: 30,
};
export const LIFT = { w: 36, carW: 30, carH: 64 };
export const BUILDING_W = 2 * M.side + 4 * M.roomW + M.gap;
/** Everything drawn side by side: elevator tower + building. */
export const FULL_W = BUILDING_W + LIFT.w;
/** x of the elevator car's centre line. */
export const LIFT_X = -LIFT.w / 2;
export const FLOOR_H = M.slab + M.roomH;
const BASE = M.sidewalk + M.lobby;
/** y of the slab top edge of floor f (0 = first residential floor). */
export const floorTop = (f        ) => -BASE - (f + 1) * FLOOR_H;
/** x of the left edge of room column c (0..3); the stair well sits between columns 1 and 2. */
export const colX = (c        ) => M.side + c * M.roomW + (c >= 2 ? M.gap : 0);
export const BAY_X = M.side + 2 * M.roomW;
export const buildingHeight = (floors        ) => BASE + floors * FLOOR_H + M.roof + 10;

/** Elevator stop levels: 0 = lobby, 1..floors = residential floor f-1, floors+1 = roof. */
export const LOBBY_Y = -M.sidewalk;
export const levelY = (level        , floors        ) =>
  level <= 0 ? LOBBY_Y : level > floors ? floorTop(floors - 1) : floorTop(level - 1) + FLOOR_H;

/** Screen-space bands the building must stay clear of (the UI layer occupies these). */
export const INSETS = { top: 92, bottom: 88, side: 8 };

/** Second mansion: floors 500..999 render as a twin tower to the right of the first (2026-11-24 user request). */
export const TOWER_FLOORS = 500;
export const SECOND_X = BUILDING_W + LIFT.w + 28;
export const towerIndex = (f        ) => Math.floor(f / TOWER_FLOORS);
export const towerX = (f        ) => towerIndex(f) * SECOND_X;
export const towerFloorTop = (f        ) => floorTop(f - towerIndex(f) * TOWER_FLOORS);
/** Full building-local span incl. the elevator tower: single = FULL_W, twin = extra tower added. */
export const spanW = (floors        ) => FULL_W + (floors > TOWER_FLOORS ? SECOND_X : 0);
export const spanMidX = (floors        ) => -LIFT.w + spanW(floors) / 2;
