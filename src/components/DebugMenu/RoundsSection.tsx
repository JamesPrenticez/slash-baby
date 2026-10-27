import { useEffect, useId, useState } from "react";

import { getDebugRound, getDebugState, setForce, setSeed } from "@/api/debug";
import { getRound } from "@/api/roundClient";
import { PRESENTATION_MAPS } from "@/constants/presentationMaps";
import { usePresentationStore } from "@/stores/presentationStore";
import { useRoundStore } from "@/stores/roundStore";
import type { DebugForce, DebugState } from "@/types/debug";
import type { OutcomeCategory } from "@/types/round";
import { roundMachine } from "@/utils/roundMachine";

import styles from "./DebugMenu.module.css";
import { describeFailure } from "./describeFailure";

const ANY = "";

type Form = { fixtureId: string; category: string; policy: string; sticky: boolean };

const forceOf = ({ fixtureId, category, policy, sticky }: Form): DebugForce => ({
	fixtureId: fixtureId || null,
	category: (category || null) as OutcomeCategory | null,
	policy: (policy || null) as DebugForce["policy"],
	sticky
});

/**
 * Round controls (debug routes only): force the outcome of the next round or every later one, set the seed, replay a
 * round's presentation by id, show a round's JSON, and read the client's round state. Forcing changes which outcome a new
 * round gets on the server; replay only plays a plan, so none of it can change money.
 */
export function RoundsSection() {
	const round = useRoundStore(state => state.round);
	const local = useRoundStore(state => state.local);
	const pending = useRoundStore(state => state.pending);
	const [server, setServer] = useState<DebugState | null>(null);
	const [form, setForm] = useState<Form>({ fixtureId: ANY, category: ANY, policy: ANY, sticky: false });
	const [seed, setSeedText] = useState("");
	const [roundId, setRoundId] = useState("");
	const [json, setJson] = useState("");
	const [note, setNote] = useState("");
	const ids = { fixture: useId(), category: useId(), policy: useId(), seed: useId(), round: useId() };

	useEffect(() => {
		let live = true;
		getDebugState()
			.then(state => live && setServer(state))
			.catch(() => {
				// The menus stay empty and the controls still report their refusals.
			});
		return () => {
			live = false;
		};
	}, []);

	const run = (label: string, call: () => Promise<void>) => async () => {
		setNote(`${label}...`);
		try {
			await call();
			setNote(`${label}: ok`);
		} catch (error) {
			setNote(`${label}: ${describeFailure(error)}`);
		}
	};

	const fixtures = server?.fixtures ?? [];
	const categories = [...new Set(fixtures.map(fixture => fixture.category))];
	const targetId = roundId || round?.roundId || "";
	const { state } = roundMachine(round, local);
	const force = server?.force;

	return (
		<fieldset className={styles.group}>
			<legend className={styles.legend}>Rounds</legend>

			<div className={styles.field}>
				<label htmlFor={ids.fixture}>Fixture</label>
				<select
					id={ids.fixture}
					className={styles.select}
					value={form.fixtureId}
					onChange={event => setForm({ ...form, fixtureId: event.target.value })}
				>
					<option value={ANY}>any</option>
					{fixtures.map(fixture => (
						<option key={fixture.fixtureId} value={fixture.fixtureId}>
							{`${fixture.fixtureId} (${fixture.eventPlanId})`}
						</option>
					))}
				</select>
			</div>
			<div className={styles.field}>
				<label htmlFor={ids.category}>Category</label>
				<select
					id={ids.category}
					className={styles.select}
					value={form.category}
					onChange={event => setForm({ ...form, category: event.target.value })}
				>
					<option value={ANY}>any</option>
					{categories.map(category => (
						<option key={category} value={category}>
							{category}
						</option>
					))}
				</select>
			</div>
			<div className={styles.field}>
				<label htmlFor={ids.policy}>Policy</label>
				<select
					id={ids.policy}
					className={styles.select}
					value={form.policy}
					onChange={event => setForm({ ...form, policy: event.target.value })}
				>
					<option value={ANY}>any</option>
					<option value="fixed">fixed</option>
					<option value="choice_constrained">choice_constrained</option>
				</select>
			</div>
			<label className={styles.field}>
				<span>Sticky (every later round)</span>
				<input
					type="checkbox"
					checked={form.sticky}
					onChange={event => setForm({ ...form, sticky: event.target.checked })}
				/>
			</label>
			<div className={styles.buttons}>
				<button
					type="button"
					className={styles.action}
					onClick={run("Force", async () => setServer(await setForce(forceOf(form))))}
				>
					Force
				</button>
				<button
					type="button"
					className={styles.action}
					onClick={run("Clear force", async () => setServer(await setForce(null)))}
				>
					Clear force
				</button>
			</div>

			<div className={styles.field}>
				<label htmlFor={ids.seed}>Seed</label>
				<input
					id={ids.seed}
					type="text"
					className={styles.select}
					value={seed}
					onChange={event => setSeedText(event.target.value)}
				/>
			</div>
			<div className={styles.buttons}>
				<button
					type="button"
					className={styles.action}
					disabled={!seed}
					onClick={run("Set seed", async () => setServer(await setSeed(seed)))}
				>
					Set seed
				</button>
				<button
					type="button"
					className={styles.action}
					onClick={run("Default seed", async () => setServer(await setSeed(null)))}
				>
					Default seed
				</button>
			</div>

			<div className={styles.field}>
				<label htmlFor={ids.round}>Round id</label>
				<input
					id={ids.round}
					type="text"
					className={styles.select}
					placeholder={round?.roundId ?? ""}
					value={roundId}
					onChange={event => setRoundId(event.target.value)}
				/>
			</div>
			<div className={styles.buttons}>
				<button
					type="button"
					className={styles.action}
					disabled={!targetId}
					onClick={run("Replay", async () => {
						const { round: found } = await getRound(targetId);
						const plan = PRESENTATION_MAPS[found.eventPlanId];
						if (!plan) throw new Error(`no plan for ${found.eventPlanId}`);
						usePresentationStore.getState().play(plan);
					})}
				>
					Replay
				</button>
				<button
					type="button"
					className={styles.action}
					disabled={!targetId}
					onClick={run("Copy round JSON", async () => {
						const text = JSON.stringify(await getDebugRound(targetId), null, 2);
						setJson(text);
						await navigator.clipboard?.writeText(text);
					})}
				>
					Copy round JSON
				</button>
			</div>
			{json && (
				<textarea
					aria-label="Round JSON"
					data-testid="round-json"
					className={styles.select}
					readOnly
					rows={6}
					value={json}
				/>
			)}

			<p aria-live="polite" className={styles.note}>
				{note}
			</p>

			<dl className={styles.readouts}>
				<div className={styles.readout}>
					<dt>client state</dt>
					<dd data-testid="round-state">{state}</dd>
				</div>
				<div className={styles.readout}>
					<dt>server status</dt>
					<dd data-testid="round-status">{round?.status ?? "—"}</dd>
				</div>
				<div className={styles.readout}>
					<dt>round</dt>
					<dd data-testid="round-id">{round?.roundId ?? "—"}</dd>
				</div>
				<div className={styles.readout}>
					<dt>event plan</dt>
					<dd data-testid="round-plan">{round?.eventPlanId ?? "—"}</dd>
				</div>
				<div className={styles.readout}>
					<dt>pending</dt>
					<dd data-testid="round-pending">{pending ? pending.action : "—"}</dd>
				</div>
				<div className={styles.readout}>
					<dt>force</dt>
					<dd data-testid="round-force">{force ? JSON.stringify(force) : "—"}</dd>
				</div>
				<div className={styles.readout}>
					<dt>seed</dt>
					<dd data-testid="round-seed">{server ? `${server.seed} (#${server.roundsPlayed})` : "—"}</dd>
				</div>
			</dl>
		</fieldset>
	);
}
