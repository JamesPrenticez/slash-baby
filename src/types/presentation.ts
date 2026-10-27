// Client-only (never on the wire). Contract section 12, BUILD-PLAN 7.2 starting set.
export type PresentationEvent =
	| { type: "run_intro"; durationMs: number }
	| { type: "coin_trail"; durationMs: number; intensity: number }
	| { type: "monster_wave"; durationMs: number; monsterIds: string[] }
	| { type: "weapon_upgrade"; durationMs: number; upgradeId: string }
	| { type: "trap_hit"; durationMs: number; severity: "minor" | "major" }
	| { type: "decision_point"; decisionPointId: string }
	| { type: "boss_encounter"; durationMs: number; bossId: string }
	| { type: "outcome_reveal"; durationMs: number }; // presentationId comes from ResolvedOutcome, see contract section 7

export type PresentationPlan = { planId: string; version: string; events: PresentationEvent[] };

/**
 * What events ask of the world, written imperatively (never React state) and read each frame by `ParallaxWorld` and
 * `Assassin`. `null` leaves the choice to the `running` prop and the debug animation.
 */
export type WorldControl = {
	/** Target run speed as a fraction of the full run speed. */
	runSpeed: number | null;
	animation: "idle" | "run" | "jump" | "hit" | "die" | "attack" | null;
};
