/// <reference types="vite/client" />
/// <reference types="vitest/globals" />

interface ImportMetaEnv {
	/** API base URL. Absent: the page's own hostname on port 3001. */
	readonly VITE_API_URL?: string;
	/** `"true"` turns on the debug menu and `src/api/debug.ts`. */
	readonly VITE_DEBUG?: string;
}

declare module "*.svg?react" {
	import { FunctionComponent, SVGProps } from "react";
	const ReactComponent: FunctionComponent<SVGProps<SVGSVGElement>>;
	export default ReactComponent;
}
