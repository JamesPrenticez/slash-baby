import {
	type ComponentProps,
	type CSSProperties,
	type ReactNode,
	useCallback,
	useEffect,
	useRef,
	useState
} from "react";
import { createPortal } from "react-dom";

import ChevronDownIcon from "@/assets/icons/chevronDown.svg?react";
import MinusIcon from "@/assets/icons/minus.svg?react";
import PlusIcon from "@/assets/icons/plus.svg?react";
import XIcon from "@/assets/icons/x.svg?react";
import { useClickOutside } from "@/hooks/useClickOutside";
import { useFocusTrap } from "@/hooks/useFocusTrap";

import styles from "./BetInput.module.css";

export type BetInputProps = Omit<ComponentProps<"div">, "onChange" | "children"> & {
	label?: string;
	value: number;
	/** The amounts on offer, ascending. The stepper walks them and the quick-select popup lists them. */
	increments: readonly number[];
	onValueChange: (value: number) => void;
	/** Renders an amount, for the stepper and the popup alike. */
	format?: (value: number) => ReactNode;
	/** Vertical: value beside stacked chevrons. Horizontal: minus, value, plus. */
	orientation?: "horizontal" | "vertical";
	disabled?: boolean;
	decrementLabel?: string;
	incrementLabel?: string;
};

type Anchor = { bottom: number; centerX: number };

/**
 * Stepper with a quick-select popup. The stepper moves to the neighbouring amount below or above `value`, so a
 * value that is not in `increments` still steps sensibly. The component does not restrict what `value` may be.
 */
export function BetInput({
	label,
	value,
	increments,
	onValueChange,
	format = String,
	orientation = "horizontal",
	disabled = false,
	decrementLabel = "Decrease bet",
	incrementLabel = "Increase bet",
	className,
	...props
}: BetInputProps) {
	const [anchor, setAnchor] = useState<Anchor | null>(null);
	const wrapperRef = useRef<HTMLDivElement>(null);
	const closePopup = useCallback(() => setAnchor(null), []);
	useClickOutside(wrapperRef, closePopup);

	// A popup left open when the control gets disabled must not come back when it is enabled again.
	if (disabled && anchor) setAnchor(null);

	const lower = increments.filter(amount => amount < value).at(-1);
	const higher = increments.find(amount => amount > value);
	const vertical = orientation === "vertical";

	const togglePopup = () => {
		const rect = wrapperRef.current?.getBoundingClientRect();
		if (anchor || !rect) {
			closePopup();
		} else {
			setAnchor({ bottom: window.innerHeight - rect.top, centerX: rect.left + rect.width / 2 });
		}
	};

	const valueContent = (
		<>
			{label && <span className={styles.label}>{label}</span>}
			<span className={styles.value}>{format(value)}</span>
		</>
	);

	const valueBlock = disabled ? (
		<div className={styles.valueBlock}>{valueContent}</div>
	) : (
		<button type="button" className={styles.valueBlock} aria-expanded={anchor !== null} onClick={togglePopup}>
			{valueContent}
		</button>
	);

	const decrement = (
		<button
			type="button"
			className={styles.step}
			aria-label={decrementLabel}
			disabled={disabled || lower === undefined}
			onClick={() => lower !== undefined && onValueChange(lower)}
		>
			{vertical ? <ChevronDownIcon aria-hidden="true" /> : <MinusIcon aria-hidden="true" />}
		</button>
	);

	const increment = (
		<button
			type="button"
			className={styles.step}
			aria-label={incrementLabel}
			disabled={disabled || higher === undefined}
			onClick={() => higher !== undefined && onValueChange(higher)}
		>
			{vertical ? <ChevronDownIcon aria-hidden="true" className={styles.up} /> : <PlusIcon aria-hidden="true" />}
		</button>
	);

	return (
		<div
			ref={wrapperRef}
			className={className ? `${styles.bet} ${className}` : styles.bet}
			data-orientation={orientation}
			{...props}
		>
			<div className={styles.stepper}>
				{vertical ? (
					<>
						{valueBlock}
						<div className={styles.stack}>
							{increment}
							<span className={styles.divider} />
							{decrement}
						</div>
					</>
				) : (
					<>
						{decrement}
						{valueBlock}
						{increment}
					</>
				)}
			</div>
			{anchor && (
				<QuickSelect
					label={label}
					amounts={increments}
					value={value}
					format={format}
					anchor={anchor}
					onSelect={amount => {
						onValueChange(amount);
						closePopup();
					}}
					onClose={closePopup}
				/>
			)}
		</div>
	);
}

type QuickSelectProps = {
	label?: string;
	amounts: readonly number[];
	value: number;
	format: (value: number) => ReactNode;
	anchor: Anchor;
	onSelect: (value: number) => void;
	onClose: () => void;
};

function QuickSelect({ label, amounts, value, format, anchor, onSelect, onClose }: QuickSelectProps) {
	const ref = useRef<HTMLDivElement>(null);
	useFocusTrap(ref);

	useEffect(() => {
		ref.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus();
	}, []);

	return createPortal(
		<div
			ref={ref}
			role="group"
			aria-label={label ?? "Amounts"}
			tabIndex={-1}
			className={styles.popup}
			// Lets the stepper's click-outside handler treat a press in this portalled popup as inside.
			data-ignore-click-away
			style={{ "--popup-bottom": `${anchor.bottom}px`, "--popup-left": `${anchor.centerX}px` } as CSSProperties}
			onKeyDown={event => {
				if (event.key !== "Escape") return;
				event.stopPropagation();
				onClose();
			}}
		>
			<div className={styles.popupHeader}>
				{label && <span className={styles.popupTitle}>{label}</span>}
				<button type="button" className={styles.popupClose} aria-label="Close" onClick={onClose}>
					<XIcon aria-hidden="true" />
				</button>
			</div>
			<div className={styles.grid}>
				{amounts.map(amount => (
					<button
						key={amount}
						type="button"
						className={styles.option}
						aria-pressed={amount === value}
						onClick={() => onSelect(amount)}
					>
						{format(amount)}
					</button>
				))}
			</div>
		</div>,
		document.body
	);
}
