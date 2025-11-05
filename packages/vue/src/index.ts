import type {
	HeightT,
	Position,
	SwipeDirection,
} from "@shipwright-sh/sonner-core";
import {
	assignOffset,
	cn,
	GAP,
	getDefaultSwipeDirections,
	getDocumentDirection,
	SWIPE_THRESHOLD,
	TIME_BEFORE_UNMOUNT,
	TOAST_LIFETIME,
	TOAST_WIDTH,
	VISIBLE_TOASTS_AMOUNT,
} from "@shipwright-sh/sonner-core";
import type { CSSProperties, PropType, VNode } from "vue";
import {
	computed,
	defineComponent,
	h,
	nextTick,
	onMounted,
	onUnmounted,
	ref,
	Teleport,
	watch,
} from "vue";

import { CloseIcon, getAsset, Loader } from "./assets";
import { useIsDocumentHidden } from "./hooks";
import {
	type Action,
	type ExternalToast,
	type ToastClassnames,
	type ToastIcons,
	ToastState,
	type ToastT,
	type ToastToDismiss,
	type ToastTypes,
	toast,
} from "./state";

import "@shipwright-sh/sonner-core/styles.css";

function isAction(action: Action | VNode): action is Action {
	return (action as Action).label !== undefined;
}

const Toast = defineComponent({
	name: "Toast",
	props: {
		toast: { type: Object as PropType<ToastT>, required: true },
		toasts: { type: Array as PropType<ToastT[]>, required: true },
		index: { type: Number, required: true },
		swipeDirections: { type: Array as PropType<SwipeDirection[]> },
		expanded: { type: Boolean, required: true },
		invert: { type: Boolean, required: true },
		heights: { type: Array as PropType<HeightT[]>, required: true },
		setHeights: {
			type: Function as PropType<(fn: (h: HeightT[]) => HeightT[]) => void>,
			required: true,
		},
		removeToast: {
			type: Function as PropType<(toast: ToastT) => void>,
			required: true,
		},
		gap: { type: Number },
		position: { type: String as PropType<Position>, required: true },
		visibleToasts: { type: Number, required: true },
		expandByDefault: { type: Boolean, required: true },
		closeButton: { type: Boolean, required: true },
		interacting: { type: Boolean, required: true },
		style: { type: Object as PropType<CSSProperties> },
		cancelButtonStyle: { type: Object as PropType<CSSProperties> },
		actionButtonStyle: { type: Object as PropType<CSSProperties> },
		duration: { type: Number },
		class: { type: String, default: "" },
		unstyled: { type: Boolean },
		descriptionClass: { type: String, default: "" },
		loadingIcon: { type: Object as PropType<VNode> },
		classNames: { type: Object as PropType<ToastClassnames> },
		icons: { type: Object as PropType<ToastIcons> },
		closeButtonAriaLabel: { type: String, default: "Close toast" },
		defaultRichColors: { type: Boolean },
	},
	setup(props) {
		const swipeDirection = ref<"x" | "y" | null>(null);
		const swipeOutDirection = ref<"left" | "right" | "up" | "down" | null>(
			null,
		);
		const mounted = ref(false);
		const removed = ref(false);
		const swiping = ref(false);
		const swipeOut = ref(false);
		const isSwiped = ref(false);
		const offsetBeforeRemove = ref(0);
		const initialHeight = ref(0);

		let remainingTime =
			props.toast.duration || props.duration || TOAST_LIFETIME;
		let dragStartTime: Date | null = null;
		const toastRef = ref<HTMLLIElement | null>(null);

		const isFront = computed(() => props.index === 0);
		const isVisible = computed(() => props.index + 1 <= props.visibleToasts);
		const toastType = computed(() => props.toast.type);
		const dismissible = computed(() => props.toast.dismissible !== false);
		const toastClassname = computed(() => props.toast.className || "");
		const toastDescriptionClassname = computed(
			() => props.toast.descriptionClassName || "",
		);

		const heightIndex = computed(
			() =>
				props.heights.findIndex(
					(height) => height.toastId === props.toast.id,
				) || 0,
		);

		const closeButtonComputed = computed(
			() => props.toast.closeButton ?? props.closeButton,
		);

		const durationComputed = computed(
			() => props.toast.duration || props.duration || TOAST_LIFETIME,
		);

		let closeTimerStartTimeRef = 0;
		let offset = 0;
		let lastCloseTimerStartTimeRef = 0;
		let pointerStartRef: { x: number; y: number } | null = null;

		const [y, x] = props.position.split("-");

		const toastsHeightBefore = computed(() => {
			return props.heights.reduce((prev, curr, reducerIndex) => {
				// Calculate offset up until current toast
				if (reducerIndex >= heightIndex.value) {
					return prev;
				}

				return prev + curr.height;
			}, 0);
		});

		const isDocumentHidden = useIsDocumentHidden();
		const invertComputed = computed(() => props.toast.invert || props.invert);
		const disabled = computed(() => toastType.value === "loading");

		watch(
			[heightIndex, toastsHeightBefore, () => props.gap],
			() => {
				offset =
					heightIndex.value * (props.gap || GAP) + toastsHeightBefore.value;
			},
			{ immediate: true },
		);

		watch(durationComputed, () => {
			remainingTime = durationComputed.value;
		});

		onMounted(() => {
			// Trigger enter animation without using CSS animation
			mounted.value = true;
		});

		onMounted(() => {
			const toastNode = toastRef.value;
			if (toastNode) {
				const height = toastNode.getBoundingClientRect().height;
				// Add toast height to heights array after the toast is mounted
				initialHeight.value = height;
				props.setHeights((h) => [
					{ toastId: props.toast.id, height, position: props.toast.position! },
					...h,
				]);
			}
		});

		onUnmounted(() => {
			props.setHeights((h) =>
				h.filter((height) => height.toastId !== props.toast.id),
			);
		});

		// Keep height up to date with the content in case it updates
		watch(
			() => [props.toast.title, props.toast.description, mounted.value],
			async () => {
				if (!mounted.value) return;
				const toastNode = toastRef.value;
				if (!toastNode) return;

				await nextTick();

				const originalHeight = toastNode.style.height;
				toastNode.style.height = "auto";
				const newHeight = toastNode.getBoundingClientRect().height;
				toastNode.style.height = originalHeight;

				initialHeight.value = newHeight;

				props.setHeights((heights) => {
					const alreadyExists = heights.find(
						(height) => height.toastId === props.toast.id,
					);
					if (!alreadyExists) {
						return [
							{
								toastId: props.toast.id,
								height: newHeight,
								position: props.toast.position!,
							},
							...heights,
						];
					} else {
						return heights.map((height) =>
							height.toastId === props.toast.id
								? { ...height, height: newHeight }
								: height,
						);
					}
				});
			},
			{ deep: true },
		);

		const deleteToast = () => {
			// Save the offset for the exit swipe animation
			removed.value = true;
			offsetBeforeRemove.value = offset;
			props.setHeights((h) =>
				h.filter((height) => height.toastId !== props.toast.id),
			);

			setTimeout(() => {
				props.removeToast(props.toast);
			}, TIME_BEFORE_UNMOUNT);
		};

		let timeoutId: NodeJS.Timeout | undefined;

		const pauseTimer = () => {
			if (lastCloseTimerStartTimeRef < closeTimerStartTimeRef) {
				// Get the elapsed time since the timer started
				const elapsedTime = Date.now() - closeTimerStartTimeRef;

				remainingTime = remainingTime - elapsedTime;
			}

			lastCloseTimerStartTimeRef = Date.now();
		};

		const startTimer = () => {
			// setTimeout(, Infinity) behaves as if the delay is 0.
			// As a result, the toast would be closed immediately, giving the appearance that it was never rendered.
			// See: https://github.com/denysdovhan/wtfjs?tab=readme-ov-file#an-infinite-timeout
			if (remainingTime === Infinity) return;

			closeTimerStartTimeRef = Date.now();

			// Let the toast know it has started
			timeoutId = setTimeout(() => {
				props.toast.onAutoClose?.(props.toast);
				deleteToast();
			}, remainingTime);
		};

		watch(
			[
				() => props.expanded,
				() => props.interacting,
				isDocumentHidden,
				() => props.toast.promise,
				toastType,
			],
			() => {
				if (
					(props.toast.promise && toastType.value === "loading") ||
					props.toast.duration === Infinity ||
					props.toast.type === "loading"
				)
					return;

				if (timeoutId) clearTimeout(timeoutId);

				if (props.expanded || props.interacting || isDocumentHidden.value) {
					pauseTimer();
				} else {
					startTimer();
				}
			},
			{ immediate: true },
		);

		onUnmounted(() => {
			if (timeoutId) clearTimeout(timeoutId);
		});

		watch(
			() => props.toast.delete,
			() => {
				if (props.toast.delete) {
					deleteToast();
					props.toast.onDismiss?.(props.toast);
				}
			},
		);

		function getLoadingIcon() {
			if (props.icons?.loading) {
				return h(
					"div",
					{
						class: cn(
							props.classNames?.loader,
							props.toast?.classNames?.loader,
							"sonner-loader",
						),
						"data-visible": toastType.value === "loading",
					},
					props.icons.loading,
				);
			}

			return Loader({
				class: cn(props.classNames?.loader, props.toast?.classNames?.loader),
				visible: toastType.value === "loading",
			});
		}

		const icon = computed(
			() =>
				props.toast.icon ||
				props.icons?.[toastType.value as keyof ToastIcons] ||
				getAsset(toastType.value as ToastTypes),
		);

		const handleDragEnd = () => {
			swiping.value = false;
			swipeDirection.value = null;
			pointerStartRef = null;
		};

		const handlePointerDown = (event: PointerEvent) => {
			if (event.button === 2) return; // Return early on right click
			if (disabled.value || !dismissible.value) return;
			dragStartTime = new Date();
			offsetBeforeRemove.value = offset;
			// Ensure we maintain correct pointer capture even when going outside of the toast (e.g. when swiping)
			(event.target as HTMLElement).setPointerCapture(event.pointerId);
			if ((event.target as HTMLElement).tagName === "BUTTON") return;
			swiping.value = true;
			pointerStartRef = { x: event.clientX, y: event.clientY };
		};

		const handlePointerUp = () => {
			if (swipeOut.value || !dismissible.value) return;

			pointerStartRef = null;
			const swipeAmountX = Number(
				toastRef.value?.style
					.getPropertyValue("--swipe-amount-x")
					.replace("px", "") || 0,
			);
			const swipeAmountY = Number(
				toastRef.value?.style
					.getPropertyValue("--swipe-amount-y")
					.replace("px", "") || 0,
			);
			const timeTaken = Date.now() - (dragStartTime?.getTime() || 0);

			const swipeAmount =
				swipeDirection.value === "x" ? swipeAmountX : swipeAmountY;
			const velocity = Math.abs(swipeAmount) / timeTaken;

			if (Math.abs(swipeAmount) >= SWIPE_THRESHOLD || velocity > 0.11) {
				offsetBeforeRemove.value = offset;

				props.toast.onDismiss?.(props.toast);

				if (swipeDirection.value === "x") {
					swipeOutDirection.value = swipeAmountX > 0 ? "right" : "left";
				} else {
					swipeOutDirection.value = swipeAmountY > 0 ? "down" : "up";
				}

				deleteToast();
				swipeOut.value = true;

				return;
			} else {
				toastRef.value?.style.setProperty("--swipe-amount-x", `0px`);
				toastRef.value?.style.setProperty("--swipe-amount-y", `0px`);
			}
			isSwiped.value = false;
			swiping.value = false;
			swipeDirection.value = null;
		};

		const handlePointerMove = (event: PointerEvent) => {
			if (!pointerStartRef || !dismissible.value) return;

			const isHighlighted = !!window.getSelection()?.toString().length;
			if (isHighlighted) return;

			const yDelta = event.clientY - pointerStartRef.y;
			const xDelta = event.clientX - pointerStartRef.x;

			const swipeDirections =
				props.swipeDirections ?? getDefaultSwipeDirections(props.position);

			// Determine swipe direction if not already locked
			if (
				!swipeDirection.value &&
				(Math.abs(xDelta) > 1 || Math.abs(yDelta) > 1)
			) {
				swipeDirection.value = Math.abs(xDelta) > Math.abs(yDelta) ? "x" : "y";
			}

			const swipeAmount = { x: 0, y: 0 };

			const getDampening = (delta: number) => {
				const factor = Math.abs(delta) / 20;

				return 1 / (1.5 + factor);
			};

			// Only apply swipe in the locked direction
			if (swipeDirection.value === "y") {
				// Handle vertical swipes
				if (
					swipeDirections.includes("top") ||
					swipeDirections.includes("bottom")
				) {
					if (
						(swipeDirections.includes("top") && yDelta < 0) ||
						(swipeDirections.includes("bottom") && yDelta > 0)
					) {
						swipeAmount.y = yDelta;
					} else {
						// Smoothly transition to dampened movement
						const dampenedDelta = yDelta * getDampening(yDelta);
						// Ensure we don't jump when transitioning to dampened movement
						swipeAmount.y =
							Math.abs(dampenedDelta) < Math.abs(yDelta)
								? dampenedDelta
								: yDelta;
					}
				}
			} else if (swipeDirection.value === "x") {
				// Handle horizontal swipes
				if (
					swipeDirections.includes("left") ||
					swipeDirections.includes("right")
				) {
					if (
						(swipeDirections.includes("left") && xDelta < 0) ||
						(swipeDirections.includes("right") && xDelta > 0)
					) {
						swipeAmount.x = xDelta;
					} else {
						// Smoothly transition to dampened movement
						const dampenedDelta = xDelta * getDampening(xDelta);
						// Ensure we don't jump when transitioning to dampened movement
						swipeAmount.x =
							Math.abs(dampenedDelta) < Math.abs(xDelta)
								? dampenedDelta
								: xDelta;
					}
				}
			}

			if (Math.abs(swipeAmount.x) > 0 || Math.abs(swipeAmount.y) > 0) {
				isSwiped.value = true;
			}

			// Apply transform using both x and y values
			toastRef.value?.style.setProperty(
				"--swipe-amount-x",
				`${swipeAmount.x}px`,
			);
			toastRef.value?.style.setProperty(
				"--swipe-amount-y",
				`${swipeAmount.y}px`,
			);
		};

		return () => {
			const children: VNode[] = [];

			// Close button
			if (
				closeButtonComputed.value &&
				!props.toast.jsx &&
				toastType.value !== "loading"
			) {
				children.push(
					h(
						"button",
						{
							"aria-label": props.closeButtonAriaLabel,
							"data-disabled": disabled.value,
							"data-close-button": true,
							onClick:
								disabled.value || !dismissible.value
									? () => {}
									: () => {
											deleteToast();
											props.toast.onDismiss?.(props.toast);
										},
							class: cn(
								props.classNames?.closeButton,
								props.toast?.classNames?.closeButton,
							),
						},
						props.icons?.close ?? CloseIcon,
					),
				);
			}

			// Icon
			if (
				(toastType.value || props.toast.icon || props.toast.promise) &&
				props.toast.icon !== null &&
				(props.icons?.[toastType.value as keyof ToastIcons] !== null ||
					props.toast.icon)
			) {
				children.push(
					h(
						"div",
						{
							"data-icon": "",
							class: cn(props.classNames?.icon, props.toast?.classNames?.icon),
						},
						[
							props.toast.promise ||
							(props.toast.type === "loading" && !props.toast.icon)
								? props.toast.icon || getLoadingIcon()
								: null,
							props.toast.type !== "loading" ? icon.value : null,
						],
					),
				);
			}

			// Content
			children.push(
				h(
					"div",
					{
						"data-content": "",
						class: cn(
							props.classNames?.content,
							props.toast?.classNames?.content,
						),
					},
					[
						h(
							"div",
							{
								"data-title": "",
								class: cn(
									props.classNames?.title,
									props.toast?.classNames?.title,
								),
							},
							props.toast.jsx
								? props.toast.jsx
								: typeof props.toast.title === "function"
									? props.toast.title()
									: props.toast.title,
						),
						props.toast.description
							? h(
									"div",
									{
										"data-description": "",
										class: cn(
											props.descriptionClass,
											toastDescriptionClassname.value,
											props.classNames?.description,
											props.toast?.classNames?.description,
										),
									},
									typeof props.toast.description === "function"
										? props.toast.description()
										: props.toast.description,
								)
							: null,
					],
				),
			);

			// Cancel button
			if (props.toast.cancel) {
				const cancel = props.toast.cancel;
				if (isAction(cancel)) {
					children.push(
						h(
							"button",
							{
								"data-button": true,
								"data-cancel": true,
								style: cancel.actionButtonStyle || props.cancelButtonStyle,
								onClick: (event: MouseEvent) => {
									if (!dismissible.value) return;
									cancel.onClick?.(event);
									deleteToast();
								},
								class: cn(
									props.classNames?.cancelButton,
									props.toast?.classNames?.cancelButton,
								),
							},
							cancel.label,
						),
					);
				} else {
					children.push(cancel);
				}
			}

			// Action button
			if (props.toast.action) {
				const action = props.toast.action;
				if (isAction(action)) {
					children.push(
						h(
							"button",
							{
								"data-button": true,
								"data-action": true,
								style: action.actionButtonStyle || props.actionButtonStyle,
								onClick: (event: MouseEvent) => {
									action.onClick?.(event);
									if (event.defaultPrevented) return;
									deleteToast();
								},
								class: cn(
									props.classNames?.actionButton,
									props.toast?.classNames?.actionButton,
								),
							},
							action.label,
						),
					);
				} else {
					children.push(action);
				}
			}

			return h(
				"li",
				{
					ref: toastRef,
					tabIndex: 0,
					class: cn(
						props.class,
						toastClassname.value,
						props.classNames?.toast,
						props.toast?.classNames?.toast,
						props.classNames?.default,
						props.classNames?.[toastType.value as keyof ToastClassnames],
						props.toast?.classNames?.[toastType.value as keyof ToastClassnames],
					),
					"data-sonner-toast": "",
					"data-rich-colors": props.toast.richColors ?? props.defaultRichColors,
					"data-styled": !(
						props.toast.jsx ||
						props.toast.unstyled ||
						props.unstyled
					),
					"data-mounted": mounted.value,
					"data-promise": Boolean(props.toast.promise),
					"data-swiped": isSwiped.value,
					"data-removed": removed.value,
					"data-visible": isVisible.value,
					"data-y-position": y,
					"data-x-position": x,
					"data-index": props.index,
					"data-front": isFront.value,
					"data-swiping": swiping.value,
					"data-dismissible": dismissible.value,
					"data-type": toastType.value,
					"data-invert": invertComputed.value,
					"data-swipe-out": swipeOut.value,
					"data-swipe-direction": swipeOutDirection.value,
					"data-expanded": Boolean(
						props.expanded || (props.expandByDefault && mounted.value),
					),
					"data-testid": props.toast.testId,
					style: {
						"--index": props.index,
						"--toasts-before": props.index,
						"--z-index": props.toasts.length - props.index,
						"--offset": `${
							removed.value ? offsetBeforeRemove.value : offset
						}px`,
						"--initial-height": props.expandByDefault
							? "auto"
							: `${initialHeight.value}px`,
						...props.style,
						...props.toast.style,
					} as CSSProperties,
					onDragend: handleDragEnd,
					onPointerdown: handlePointerDown,
					onPointerup: handlePointerUp,
					onPointermove: handlePointerMove,
				},
				children,
			);
		};
	},
});

export interface ToasterProps {
	id?: string;
	invert?: boolean;
	theme?: "light" | "dark" | "system";
	position?: Position;
	hotkey?: string[];
	richColors?: boolean;
	expand?: boolean;
	duration?: number;
	gap?: number;
	visibleToasts?: number;
	closeButton?: boolean;
	toastOptions?: {
		className?: string;
		closeButton?: boolean;
		descriptionClassName?: string;
		style?: CSSProperties;
		cancelButtonStyle?: CSSProperties;
		actionButtonStyle?: CSSProperties;
		duration?: number;
		unstyled?: boolean;
		classNames?: ToastClassnames;
		closeButtonAriaLabel?: string;
	};
	class?: string;
	style?: CSSProperties;
	offset?:
		| string
		| number
		| {
				top?: string | number;
				right?: string | number;
				bottom?: string | number;
				left?: string | number;
		  };
	mobileOffset?:
		| string
		| number
		| {
				top?: string | number;
				right?: string | number;
				bottom?: string | number;
				left?: string | number;
		  };
	dir?: "rtl" | "ltr" | "auto";
	swipeDirections?: SwipeDirection[];
	icons?: ToastIcons;
	customAriaLabel?: string;
	containerAriaLabel?: string;
}

export const Toaster = defineComponent({
	name: "Toaster",
	props: {
		id: { type: String },
		invert: { type: Boolean },
		theme: {
			type: String as PropType<"light" | "dark" | "system">,
			default: "light",
		},
		position: { type: String as PropType<Position>, default: "bottom-right" },
		hotkey: {
			type: Array as PropType<string[]>,
			default: () => ["altKey", "KeyT"],
		},
		richColors: { type: Boolean },
		expand: { type: Boolean },
		duration: { type: Number },
		gap: { type: Number, default: GAP },
		visibleToasts: { type: Number, default: VISIBLE_TOASTS_AMOUNT },
		closeButton: { type: Boolean },
		toastOptions: { type: Object as PropType<ToasterProps["toastOptions"]> },
		class: { type: String },
		style: { type: Object as PropType<CSSProperties> },
		offset: {
			type: [String, Number, Object] as PropType<ToasterProps["offset"]>,
		},
		mobileOffset: {
			type: [String, Number, Object] as PropType<ToasterProps["mobileOffset"]>,
		},
		dir: {
			type: String as PropType<"rtl" | "ltr" | "auto">,
			default: () => getDocumentDirection(),
		},
		swipeDirections: { type: Array as PropType<SwipeDirection[]> },
		icons: { type: Object as PropType<ToastIcons> },
		customAriaLabel: { type: String },
		containerAriaLabel: { type: String, default: "Notifications" },
	},
	setup(props) {
		const toasts = ref<ToastT[]>([]);

		const filteredToasts = computed(() => {
			if (props.id) {
				return toasts.value.filter((toast) => toast.toasterId === props.id);
			}
			return toasts.value.filter((toast) => !toast.toasterId);
		});

		const possiblePositions = computed(() => {
			return Array.from(
				new Set(
					[props.position].concat(
						filteredToasts.value
							.filter((toast) => toast.position)
							.map((toast) => toast.position as Position),
					),
				),
			);
		});

		const heights = ref<HeightT[]>([]);
		const expanded = ref(false);
		const interacting = ref(false);
		const actualTheme = ref<"light" | "dark">(
			props.theme !== "system"
				? props.theme
				: typeof window !== "undefined"
					? window.matchMedia?.("(prefers-color-scheme: dark)").matches
						? "dark"
						: "light"
					: "light",
		);

		const listRef = ref<HTMLOListElement | null>(null);
		const hotkeyLabel = props.hotkey
			.join("+")
			.replace(/Key/g, "")
			.replace(/Digit/g, "");
		let lastFocusedElementRef: HTMLElement | null = null;
		let isFocusWithinRef = false;

		const setHeights = (fn: (h: HeightT[]) => HeightT[]) => {
			heights.value = fn(heights.value);
		};

		const removeToast = (toastToRemove: ToastT) => {
			if (
				!toasts.value.find((toast) => toast.id === toastToRemove.id)?.delete
			) {
				ToastState.dismiss(toastToRemove.id);
			}

			toasts.value = toasts.value.filter(({ id }) => id !== toastToRemove.id);
		};

		onMounted(() => {
			const unsubscribe = ToastState.subscribe((toast) => {
				if ((toast as ToastToDismiss).dismiss) {
					// Prevent batching of other state updates
					requestAnimationFrame(() => {
						toasts.value = toasts.value.map((t) =>
							t.id === toast.id ? { ...t, delete: true } : t,
						);
					});
					return;
				}

				// Update or add toast
				setTimeout(() => {
					const indexOfExistingToast = toasts.value.findIndex(
						(t) => t.id === toast.id,
					);

					// Update the toast if it already exists
					if (indexOfExistingToast !== -1) {
						toasts.value = [
							...toasts.value.slice(0, indexOfExistingToast),
							{ ...toasts.value[indexOfExistingToast], ...toast },
							...toasts.value.slice(indexOfExistingToast + 1),
						];
					} else {
						toasts.value = [toast as ToastT, ...toasts.value];
					}
				});
			});

			onUnmounted(unsubscribe);
		});

		watch(
			() => props.theme,
			() => {
				if (props.theme !== "system") {
					actualTheme.value = props.theme;
					return;
				}

				if (props.theme === "system") {
					// check if current preference is dark
					if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
						// it's currently dark
						actualTheme.value = "dark";
					} else {
						// it's not dark
						actualTheme.value = "light";
					}
				}

				if (typeof window === "undefined") return;
				const darkMediaQuery = window.matchMedia(
					"(prefers-color-scheme: dark)",
				);

				const handler = (event: MediaQueryListEvent) => {
					if (event.matches) {
						actualTheme.value = "dark";
					} else {
						actualTheme.value = "light";
					}
				};

				try {
					// Chrome & Firefox
					darkMediaQuery.addEventListener("change", handler);
					onUnmounted(() =>
						darkMediaQuery.removeEventListener("change", handler),
					);
				} catch (_error) {
					// Safari < 14
					darkMediaQuery.addListener(handler);
					onUnmounted(() => darkMediaQuery.removeListener(handler));
				}
			},
			{ immediate: true },
		);

		watch(
			() => toasts.value.length,
			() => {
				// Ensure expanded is always false when no toasts are present / only one left
				if (toasts.value.length <= 1) {
					expanded.value = false;
				}
			},
		);

		onMounted(() => {
			const handleKeyDown = (event: KeyboardEvent) => {
				const isHotkeyPressed =
					props.hotkey.length > 0 &&
					props.hotkey.every(
						// biome-ignore lint/suspicious/noExplicitAny: todo
						(key) => (event as any)[key] || event.code === key,
					);

				if (isHotkeyPressed) {
					expanded.value = true;
					listRef.value?.focus();
				}

				if (
					event.code === "Escape" &&
					(document.activeElement === listRef.value ||
						listRef.value?.contains(document.activeElement))
				) {
					expanded.value = false;
				}
			};
			document.addEventListener("keydown", handleKeyDown);

			onUnmounted(() => document.removeEventListener("keydown", handleKeyDown));
		});

		onUnmounted(() => {
			if (lastFocusedElementRef) {
				lastFocusedElementRef.focus({ preventScroll: true });
				lastFocusedElementRef = null;
				isFocusWithinRef = false;
			}
		});

		return () => {
			return h(
				Teleport,
				{ to: "body" },
				h(
					"section",
					{
						"aria-label":
							props.customAriaLabel ??
							`${props.containerAriaLabel} ${hotkeyLabel}`,
						tabIndex: -1,
						"aria-live": "polite",
						"aria-relevant": "additions text",
						"aria-atomic": "false",
					},
					possiblePositions.value.map((position, index) => {
						const [y, x] = position.split("-");

						const positionFiltered = filteredToasts.value.filter(
							(toast) =>
								(!toast.position && index === 0) || toast.position === position,
						);

						if (positionFiltered.length === 0) return null;

						return h(
							"ol",
							{
								key: position,
								ref: listRef,
								dir: props.dir === "auto" ? getDocumentDirection() : props.dir,
								tabIndex: -1,
								class: props.class,
								"data-sonner-toaster": true,
								"data-sonner-theme": actualTheme.value,
								"data-y-position": y,
								"data-x-position": x,
								style: {
									"--front-toast-height": `${heights.value[0]?.height || 0}px`,
									"--width": `${TOAST_WIDTH}px`,
									"--gap": `${props.gap}px`,
									...props.style,
									...assignOffset(props.offset, props.mobileOffset),
								} as CSSProperties,
								onBlur: (event: FocusEvent) => {
									if (
										isFocusWithinRef &&
										!(event.currentTarget as HTMLElement).contains(
											event.relatedTarget as Node,
										)
									) {
										isFocusWithinRef = false;
										if (lastFocusedElementRef) {
											lastFocusedElementRef.focus({ preventScroll: true });
											lastFocusedElementRef = null;
										}
									}
								},
								onFocus: (event: FocusEvent) => {
									const isNotDismissible =
										event.target instanceof HTMLElement &&
										event.target.dataset.dismissible === "false";

									if (isNotDismissible) return;

									if (!isFocusWithinRef) {
										isFocusWithinRef = true;
										lastFocusedElementRef = event.relatedTarget as HTMLElement;
									}
								},
								onMouseenter: () => {
									expanded.value = true;
								},
								onMousemove: () => {
									expanded.value = true;
								},
								onMouseleave: () => {
									// Avoid setting expanded to false when interacting with a toast, e.g. swiping
									if (!interacting.value) {
										expanded.value = false;
									}
								},
								onDragend: () => {
									expanded.value = false;
								},
								onPointerdown: (event: PointerEvent) => {
									const isNotDismissible =
										event.target instanceof HTMLElement &&
										event.target.dataset.dismissible === "false";

									if (isNotDismissible) return;
									interacting.value = true;
								},
								onPointerup: () => {
									interacting.value = false;
								},
							},
							positionFiltered.map((toast, toastIndex) =>
								h(Toast, {
									key: toast.id,
									toast,
									icons: props.icons,
									index: toastIndex,
									defaultRichColors: props.richColors,
									duration: props.toastOptions?.duration ?? props.duration,
									class: props.toastOptions?.className,
									descriptionClass: props.toastOptions?.descriptionClassName,
									invert: !!props.invert,
									visibleToasts: props.visibleToasts,
									closeButton:
										props.toastOptions?.closeButton ?? !!props.closeButton,
									interacting: interacting.value,
									position,
									style: props.toastOptions?.style,
									unstyled: props.toastOptions?.unstyled,
									classNames: props.toastOptions?.classNames,
									cancelButtonStyle: props.toastOptions?.cancelButtonStyle,
									actionButtonStyle: props.toastOptions?.actionButtonStyle,
									closeButtonAriaLabel:
										props.toastOptions?.closeButtonAriaLabel,
									removeToast,
									toasts: positionFiltered,
									heights: heights.value.filter(
										(h) => h.position === toast.position,
									),
									setHeights,
									expandByDefault: !!props.expand,
									gap: props.gap,
									expanded: expanded.value,
									swipeDirections: props.swipeDirections,
								}),
							),
						);
					}),
				),
			);
		};
	},
});

// useSonner hook to access active toasts
export function useSonner(): { toasts: Readonly<import("vue").Ref<ToastT[]>> } {
	const activeToasts = ref<ToastT[]>([]);

	onMounted(() => {
		const unsubscribe = ToastState.subscribe((toast) => {
			if ((toast as ToastToDismiss).dismiss) {
				setTimeout(() => {
					activeToasts.value = activeToasts.value.filter(
						(t) => t.id !== toast.id,
					);
				});
				return;
			}

			setTimeout(() => {
				const indexOfExistingToast = activeToasts.value.findIndex(
					(t) => t.id === toast.id,
				);

				// Update the toast if it already exists
				if (indexOfExistingToast !== -1) {
					activeToasts.value = [
						...activeToasts.value.slice(0, indexOfExistingToast),
						{ ...activeToasts.value[indexOfExistingToast], ...toast },
						...activeToasts.value.slice(indexOfExistingToast + 1),
					];
				} else {
					activeToasts.value = [toast as ToastT, ...activeToasts.value];
				}
			});
		});

		onUnmounted(unsubscribe);
	});

	return {
		toasts: activeToasts,
	};
}

// Export types and main exports
export { toast, type ExternalToast, type ToastT };
export type { ToastClassnames, ToastToDismiss, Action };
