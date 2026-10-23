/// <reference types="vite/client" />

declare module "*.svg?react" {
	import { FunctionComponent, SVGProps } from "react";
	const ReactComponent: FunctionComponent<SVGProps<SVGSVGElement>>;
	export default ReactComponent;
}
