/** Logical animation name to the Spine animation name. Swapping the character is a change here. */
export const ASSASSIN_ANIMATIONS = {
	idle: "idle",
	run: "run",
	jump: "jump",
	hit: "hit",
	die: "death",
	attack: "shoot"
} as const;

export type AssassinAnimation = keyof typeof ASSASSIN_ANIMATIONS;
