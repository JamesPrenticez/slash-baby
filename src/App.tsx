import { type ComponentType, lazy, Suspense, useState } from "react";

import { ErrorScreen } from "@/components/ErrorScreen";
import { GameCanvas } from "@/components/GameCanvas";
import { LoadingScreen } from "@/components/LoadingScreen";
import { UserInterface } from "@/components/UserInterface";
import { useGameSession } from "@/hooks/useGameSession";
import type { DebugControls } from "@/stores/debugStore";

import styles from "./App.module.css";

type DebugMenuProps = {
	running: boolean;
	onRunningChange: (running: boolean) => void;
	onControls: (controls: DebugControls) => void;
};

// A dynamic import behind a build-time constant: a production build drops the branch and the chunk with it.
const DebugMenu: ComponentType<DebugMenuProps> | null =
	import.meta.env.VITE_DEBUG === "true"
		? lazy(() => import("@/components/DebugMenu").then(m => ({ default: m.DebugMenu })))
		: null;

function App() {
	const session = useGameSession();
	const [running, setRunning] = useState(false);
	const [debug, setDebug] = useState<DebugControls | undefined>();

	if (session.status === "loading") return <LoadingScreen />;
	if (session.status === "error") return <ErrorScreen message={session.message} onRetry={session.retry} />;

	return (
		<main className={styles.app}>
			<GameCanvas
				key={debug?.canvasKey ?? 0}
				running={running}
				animation={debug?.animation}
				speedMultiplier={debug?.speedMultiplier}
			/>
			<UserInterface />
			{DebugMenu && (
				<Suspense fallback={null}>
					<DebugMenu running={running} onRunningChange={setRunning} onControls={setDebug} />
				</Suspense>
			)}
		</main>
	);
}

export default App;
