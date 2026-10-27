/** Placeholder monsters: every id draws the same sprite until real art arrives. */
export type MonsterSpec = { alias: string; heightPx: number };

const DEFAULT_MONSTER: MonsterSpec = { alias: "monster", heightPx: 90 };

export const monsterFor = (_id: string): MonsterSpec => DEFAULT_MONSTER;

/** Tint of a monster that has been struck. */
export const HIT_TINT = 0xff6666;
export const NO_TINT = 0xffffff;
