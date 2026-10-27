import { type ReactNode, useEffect, useId, useRef } from "react";

import { CloseButton } from "@/components/CloseButton";
import { useFocusTrap } from "@/hooks/useFocusTrap";

import styles from "./Modal.module.css";

export type ModalProps = {
	open: boolean;
	title: string;
	subtitle?: string;
	/** Called by the close button, Escape and a click on the backdrop. */
	onClose: () => void;
	/** Dims and blurs the page behind. NGU's modals leave it clear and rely on their own dark panel. */
	dimmed?: boolean;
	/** Applied to the panel, for per-modal sizing. */
	className?: string;
	children?: ReactNode;
};

export function Modal({ open, title, subtitle, onClose, dimmed = false, className, children }: ModalProps) {
	const panelRef = useRef<HTMLDivElement>(null);
	const titleId = useId();
	useFocusTrap(panelRef, open);

	// The overlay handles Escape while focus is inside the panel. When the focused control is removed (LOAD MORE gone,
	// a button disabled) focus falls to the page, so the topmost modal listens on the document as well.
	useEffect(() => {
		if (!open) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape" || panelRef.current?.contains(document.activeElement)) return;
			const panels = document.querySelectorAll("[aria-modal=true]");
			if (panels[panels.length - 1] === panelRef.current) onClose();
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [open, onClose]);

	if (!open) return null;

	return (
		<div
			className={styles.overlay}
			data-dimmed={dimmed ? "" : undefined}
			onClick={onClose}
			onKeyDown={event => {
				if (event.key !== "Escape") return;
				event.stopPropagation();
				onClose();
			}}
		>
			<div
				ref={panelRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				tabIndex={-1}
				className={className ? `${styles.panel} ${className}` : styles.panel}
				onClick={event => event.stopPropagation()}
			>
				<header className={styles.header}>
					<div className={styles.titles}>
						<h2 id={titleId} className={styles.title}>
							{title}
						</h2>
						{subtitle && <p className={styles.subtitle}>{subtitle}</p>}
					</div>
					<CloseButton onClick={onClose} />
				</header>
				{children}
			</div>
		</div>
	);
}
