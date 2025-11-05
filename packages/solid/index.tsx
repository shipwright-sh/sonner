import type { JSX } from "solid-js";
import {
  createSignal,
  createEffect,
  onMount,
  onCleanup,
  For,
  Show,
  createMemo,
  mergeProps,
} from "solid-js";
import { Portal } from "solid-js/web";
import {
  cn,
  getDefaultSwipeDirections,
  getDocumentDirection,
  assignOffset,
  VISIBLE_TOASTS_AMOUNT,
  TOAST_LIFETIME,
  TOAST_WIDTH,
  GAP,
  SWIPE_THRESHOLD,
  TIME_BEFORE_UNMOUNT,
} from "@shipwright-sh/sonner-core";
import type { HeightT, Position, SwipeDirection } from "@shipwright-sh/sonner-core";

import { CloseIcon, getAsset, Loader } from "./assets";
import { useIsDocumentHidden } from "./hooks";
import {
  toast,
  ToastState,
  type ToastT,
  type ToastIcons,
  type ToastClassnames,
  type Action,
  type ExternalToast,
  type ToastToDismiss,
  type ToastTypes,
} from "./state";

import "@shipwright-sh/sonner-core/styles.css";

function isAction(action: Action | JSX.Element): action is Action {
  return (action as Action).label !== undefined;
}

interface ToastProps {
  toast: ToastT;
  toasts: ToastT[];
  index: number;
  swipeDirections?: SwipeDirection[];
  expanded: boolean;
  invert: boolean;
  heights: HeightT[];
  setHeights: (fn: (h: HeightT[]) => HeightT[]) => void;
  removeToast: (toast: ToastT) => void;
  gap?: number;
  position: Position;
  visibleToasts: number;
  expandByDefault: boolean;
  closeButton: boolean;
  interacting: boolean;
  style?: JSX.CSSProperties;
  cancelButtonStyle?: JSX.CSSProperties;
  actionButtonStyle?: JSX.CSSProperties;
  duration?: number;
  class?: string;
  unstyled?: boolean;
  descriptionClass?: string;
  loadingIcon?: JSX.Element;
  classNames?: ToastClassnames;
  icons?: ToastIcons;
  closeButtonAriaLabel?: string;
  defaultRichColors?: boolean;
}

const Toast = (props: ToastProps) => {
  const mergedProps = mergeProps(
    {
      class: "",
      descriptionClass: "",
      closeButtonAriaLabel: "Close toast",
    },
    props
  );

  const [swipeDirection, setSwipeDirection] = createSignal<"x" | "y" | null>(
    null
  );
  const [swipeOutDirection, setSwipeOutDirection] = createSignal<
    "left" | "right" | "up" | "down" | null
  >(null);
  const [mounted, setMounted] = createSignal(false);
  const [removed, setRemoved] = createSignal(false);
  const [swiping, setSwiping] = createSignal(false);
  const [swipeOut, setSwipeOut] = createSignal(false);
  const [isSwiped, setIsSwiped] = createSignal(false);
  const [offsetBeforeRemove, setOffsetBeforeRemove] = createSignal(0);
  const [initialHeight, setInitialHeight] = createSignal(0);

  let remainingTime =
    mergedProps.toast.duration || mergedProps.duration || TOAST_LIFETIME;
  let dragStartTime: Date | null = null;
  let toastRef: HTMLLIElement | undefined;

  const isFront = () => mergedProps.index === 0;
  const isVisible = () => mergedProps.index + 1 <= mergedProps.visibleToasts;
  const toastType = () => mergedProps.toast.type;
  const dismissible = () => mergedProps.toast.dismissible !== false;
  const toastClassname = () => mergedProps.toast.className || "";
  const toastDescriptionClassname = () =>
    mergedProps.toast.descriptionClassName || "";

  const heightIndex = createMemo(
    () =>
      mergedProps.heights.findIndex(
        (height) => height.toastId === mergedProps.toast.id
      ) || 0
  );

  const closeButton = createMemo(
    () => mergedProps.toast.closeButton ?? mergedProps.closeButton
  );

  const duration = createMemo(
    () =>
      mergedProps.toast.duration || mergedProps.duration || TOAST_LIFETIME
  );

  let closeTimerStartTimeRef = 0;
  let offset = 0;
  let lastCloseTimerStartTimeRef = 0;
  let pointerStartRef: { x: number; y: number } | null = null;

  const [y, x] = mergedProps.position.split("-");

  const toastsHeightBefore = createMemo(() => {
    return mergedProps.heights.reduce((prev, curr, reducerIndex) => {
      // Calculate offset up until current toast
      if (reducerIndex >= heightIndex()) {
        return prev;
      }

      return prev + curr.height;
    }, 0);
  });

  const isDocumentHidden = useIsDocumentHidden();
  const invert = () => mergedProps.toast.invert || mergedProps.invert;
  const disabled = () => toastType() === "loading";

  createEffect(() => {
    offset = heightIndex() * (mergedProps.gap || GAP) + toastsHeightBefore();
  });

  createEffect(() => {
    remainingTime = duration();
  });

  onMount(() => {
    // Trigger enter animation without using CSS animation
    setMounted(true);
  });

  createEffect(() => {
    const toastNode = toastRef;
    if (toastNode) {
      const height = toastNode.getBoundingClientRect().height;
      // Add toast height to heights array after the toast is mounted
      setInitialHeight(height);
      mergedProps.setHeights((h) => [
        { toastId: mergedProps.toast.id, height, position: mergedProps.toast.position! },
        ...h,
      ]);
      onCleanup(() =>
        mergedProps.setHeights((h) =>
          h.filter((height) => height.toastId !== mergedProps.toast.id)
        )
      );
    }
  });

  // Keep height up to date with the content in case it updates
  createEffect(() => {
    if (!mounted()) return;
    const toastNode = toastRef;
    if (!toastNode) return;

    const originalHeight = toastNode.style.height;
    toastNode.style.height = "auto";
    const newHeight = toastNode.getBoundingClientRect().height;
    toastNode.style.height = originalHeight;

    setInitialHeight(newHeight);

    mergedProps.setHeights((heights) => {
      const alreadyExists = heights.find(
        (height) => height.toastId === mergedProps.toast.id
      );
      if (!alreadyExists) {
        return [
          {
            toastId: mergedProps.toast.id,
            height: newHeight,
            position: mergedProps.toast.position!,
          },
          ...heights,
        ];
      } else {
        return heights.map((height) =>
          height.toastId === mergedProps.toast.id
            ? { ...height, height: newHeight }
            : height
        );
      }
    });
  });

  const deleteToast = () => {
    // Save the offset for the exit swipe animation
    setRemoved(true);
    setOffsetBeforeRemove(offset);
    mergedProps.setHeights((h) =>
      h.filter((height) => height.toastId !== mergedProps.toast.id)
    );

    setTimeout(() => {
      mergedProps.removeToast(mergedProps.toast);
    }, TIME_BEFORE_UNMOUNT);
  };

  createEffect(() => {
    if (
      (mergedProps.toast.promise && toastType() === "loading") ||
      mergedProps.toast.duration === Infinity ||
      mergedProps.toast.type === "loading"
    )
      return;

    let timeoutId: NodeJS.Timeout | undefined;

    // Pause the timer on each hover
    const pauseTimer = () => {
      if (lastCloseTimerStartTimeRef < closeTimerStartTimeRef) {
        // Get the elapsed time since the timer started
        const elapsedTime = new Date().getTime() - closeTimerStartTimeRef;

        remainingTime = remainingTime - elapsedTime;
      }

      lastCloseTimerStartTimeRef = new Date().getTime();
    };

    const startTimer = () => {
      // setTimeout(, Infinity) behaves as if the delay is 0.
      // As a result, the toast would be closed immediately, giving the appearance that it was never rendered.
      // See: https://github.com/denysdovhan/wtfjs?tab=readme-ov-file#an-infinite-timeout
      if (remainingTime === Infinity) return;

      closeTimerStartTimeRef = new Date().getTime();

      // Let the toast know it has started
      timeoutId = setTimeout(() => {
        mergedProps.toast.onAutoClose?.(mergedProps.toast);
        deleteToast();
      }, remainingTime);
    };

    if (
      mergedProps.expanded ||
      mergedProps.interacting ||
      isDocumentHidden()
    ) {
      pauseTimer();
    } else {
      startTimer();
    }

    onCleanup(() => {
      if (timeoutId) clearTimeout(timeoutId);
    });
  });

  createEffect(() => {
    if (mergedProps.toast.delete) {
      deleteToast();
      mergedProps.toast.onDismiss?.(mergedProps.toast);
    }
  });

  function getLoadingIcon() {
    if (mergedProps.icons?.loading) {
      return (
        <div
          class={cn(
            mergedProps.classNames?.loader,
            mergedProps.toast?.classNames?.loader,
            "sonner-loader"
          )}
          data-visible={toastType() === "loading"}
        >
          {mergedProps.icons.loading}
        </div>
      );
    }

    return (
      <Loader
        class={cn(
          mergedProps.classNames?.loader,
          mergedProps.toast?.classNames?.loader
        )}
        visible={toastType() === "loading"}
      />
    );
  }

  const icon = () =>
    mergedProps.toast.icon ||
    mergedProps.icons?.[toastType() as keyof ToastIcons] ||
    getAsset(toastType() as ToastTypes);

  return (
    <li
      tabIndex={0}
      ref={toastRef}
      class={cn(
        mergedProps.class,
        toastClassname(),
        mergedProps.classNames?.toast,
        mergedProps.toast?.classNames?.toast,
        mergedProps.classNames?.default,
        mergedProps.classNames?.[toastType() as keyof ToastClassnames],
        mergedProps.toast?.classNames?.[toastType() as keyof ToastClassnames]
      )}
      data-sonner-toast=""
      data-rich-colors={
        mergedProps.toast.richColors ?? mergedProps.defaultRichColors
      }
      data-styled={
        !Boolean(
          mergedProps.toast.jsx ||
            mergedProps.toast.unstyled ||
            mergedProps.unstyled
        )
      }
      data-mounted={mounted()}
      data-promise={Boolean(mergedProps.toast.promise)}
      data-swiped={isSwiped()}
      data-removed={removed()}
      data-visible={isVisible()}
      data-y-position={y}
      data-x-position={x}
      data-index={mergedProps.index}
      data-front={isFront()}
      data-swiping={swiping()}
      data-dismissible={dismissible()}
      data-type={toastType()}
      data-invert={invert()}
      data-swipe-out={swipeOut()}
      data-swipe-direction={swipeOutDirection()}
      data-expanded={Boolean(
        mergedProps.expanded || (mergedProps.expandByDefault && mounted())
      )}
      data-testid={mergedProps.toast.testId}
      style={{
        "--index": mergedProps.index,
        "--toasts-before": mergedProps.index,
        "--z-index": mergedProps.toasts.length - mergedProps.index,
        "--offset": `${removed() ? offsetBeforeRemove() : offset}px`,
        "--initial-height": mergedProps.expandByDefault
          ? "auto"
          : `${initialHeight()}px`,
        ...mergedProps.style,
        ...mergedProps.toast.style,
      }}
      onDragEnd={() => {
        setSwiping(false);
        setSwipeDirection(null);
        pointerStartRef = null;
      }}
      onPointerDown={(event) => {
        if (event.button === 2) return; // Return early on right click
        if (disabled() || !dismissible()) return;
        dragStartTime = new Date();
        setOffsetBeforeRemove(offset);
        // Ensure we maintain correct pointer capture even when going outside of the toast (e.g. when swiping)
        (event.target as HTMLElement).setPointerCapture(event.pointerId);
        if ((event.target as HTMLElement).tagName === "BUTTON") return;
        setSwiping(true);
        pointerStartRef = { x: event.clientX, y: event.clientY };
      }}
      onPointerUp={() => {
        if (swipeOut() || !dismissible()) return;

        pointerStartRef = null;
        const swipeAmountX = Number(
          toastRef?.style.getPropertyValue("--swipe-amount-x").replace("px", "") ||
            0
        );
        const swipeAmountY = Number(
          toastRef?.style.getPropertyValue("--swipe-amount-y").replace("px", "") ||
            0
        );
        const timeTaken =
          new Date().getTime() - (dragStartTime?.getTime() || 0);

        const swipeAmount =
          swipeDirection() === "x" ? swipeAmountX : swipeAmountY;
        const velocity = Math.abs(swipeAmount) / timeTaken;

        if (Math.abs(swipeAmount) >= SWIPE_THRESHOLD || velocity > 0.11) {
          setOffsetBeforeRemove(offset);

          mergedProps.toast.onDismiss?.(mergedProps.toast);

          if (swipeDirection() === "x") {
            setSwipeOutDirection(swipeAmountX > 0 ? "right" : "left");
          } else {
            setSwipeOutDirection(swipeAmountY > 0 ? "down" : "up");
          }

          deleteToast();
          setSwipeOut(true);

          return;
        } else {
          toastRef?.style.setProperty("--swipe-amount-x", `0px`);
          toastRef?.style.setProperty("--swipe-amount-y", `0px`);
        }
        setIsSwiped(false);
        setSwiping(false);
        setSwipeDirection(null);
      }}
      onPointerMove={(event) => {
        if (!pointerStartRef || !dismissible()) return;

        const isHighlighted =
          window.getSelection()?.toString().length || 0 > 0;
        if (isHighlighted) return;

        const yDelta = event.clientY - pointerStartRef.y;
        const xDelta = event.clientX - pointerStartRef.x;

        const swipeDirections =
          mergedProps.swipeDirections ??
          getDefaultSwipeDirections(mergedProps.position);

        // Determine swipe direction if not already locked
        if (
          !swipeDirection() &&
          (Math.abs(xDelta) > 1 || Math.abs(yDelta) > 1)
        ) {
          setSwipeDirection(Math.abs(xDelta) > Math.abs(yDelta) ? "x" : "y");
        }

        let swipeAmount = { x: 0, y: 0 };

        const getDampening = (delta: number) => {
          const factor = Math.abs(delta) / 20;

          return 1 / (1.5 + factor);
        };

        // Only apply swipe in the locked direction
        if (swipeDirection() === "y") {
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
        } else if (swipeDirection() === "x") {
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
          setIsSwiped(true);
        }

        // Apply transform using both x and y values
        toastRef?.style.setProperty(
          "--swipe-amount-x",
          `${swipeAmount.x}px`
        );
        toastRef?.style.setProperty(
          "--swipe-amount-y",
          `${swipeAmount.y}px`
        );
      }}
    >
      <Show
        when={
          closeButton() &&
          !mergedProps.toast.jsx &&
          toastType() !== "loading"
        }
      >
        <button
          aria-label={mergedProps.closeButtonAriaLabel}
          data-disabled={disabled()}
          data-close-button
          onClick={
            disabled() || !dismissible()
              ? () => {}
              : () => {
                  deleteToast();
                  mergedProps.toast.onDismiss?.(mergedProps.toast);
                }
          }
          class={cn(
            mergedProps.classNames?.closeButton,
            mergedProps.toast?.classNames?.closeButton
          )}
        >
          {mergedProps.icons?.close ?? CloseIcon}
        </button>
      </Show>
      <Show
        when={
          (toastType() || mergedProps.toast.icon || mergedProps.toast.promise) &&
          mergedProps.toast.icon !== null &&
          (mergedProps.icons?.[toastType() as keyof ToastIcons] !== null ||
            mergedProps.toast.icon)
        }
      >
        <div
          data-icon=""
          class={cn(
            mergedProps.classNames?.icon,
            mergedProps.toast?.classNames?.icon
          )}
        >
          <Show
            when={
              mergedProps.toast.promise ||
              (mergedProps.toast.type === "loading" && !mergedProps.toast.icon)
            }
          >
            {mergedProps.toast.icon || getLoadingIcon()}
          </Show>
          <Show when={mergedProps.toast.type !== "loading"}>{icon()}</Show>
        </div>
      </Show>

      <div
        data-content=""
        class={cn(
          mergedProps.classNames?.content,
          mergedProps.toast?.classNames?.content
        )}
      >
        <div
          data-title=""
          class={cn(
            mergedProps.classNames?.title,
            mergedProps.toast?.classNames?.title
          )}
        >
          {mergedProps.toast.jsx
            ? mergedProps.toast.jsx
            : typeof mergedProps.toast.title === "function"
            ? mergedProps.toast.title()
            : mergedProps.toast.title}
        </div>
        <Show when={mergedProps.toast.description}>
          <div
            data-description=""
            class={cn(
              mergedProps.descriptionClass,
              toastDescriptionClassname(),
              mergedProps.classNames?.description,
              mergedProps.toast?.classNames?.description
            )}
          >
            {typeof mergedProps.toast.description === "function"
              ? mergedProps.toast.description()
              : mergedProps.toast.description}
          </div>
        </Show>
      </div>
      <Show
        when={mergedProps.toast.cancel}
        fallback={null}
      >
        {(() => {
          const cancel = mergedProps.toast.cancel;
          if (!cancel) return null;
          if (isAction(cancel)) {
            return (
              <button
                data-button
                data-cancel
                style={
                  cancel.actionButtonStyle || mergedProps.cancelButtonStyle
                }
                onClick={(event) => {
                  if (!dismissible()) return;
                  cancel.onClick?.(event);
                  deleteToast();
                }}
                class={cn(
                  mergedProps.classNames?.cancelButton,
                  mergedProps.toast?.classNames?.cancelButton
                )}
              >
                {cancel.label}
              </button>
            );
          }
          return cancel;
        })()}
      </Show>
      <Show
        when={mergedProps.toast.action}
        fallback={null}
      >
        {(() => {
          const action = mergedProps.toast.action;
          if (!action) return null;
          if (isAction(action)) {
            return (
              <button
                data-button
                data-action
                style={
                  action.actionButtonStyle || mergedProps.actionButtonStyle
                }
                onClick={(event) => {
                  action.onClick?.(event);
                  if (event.defaultPrevented) return;
                  deleteToast();
                }}
                class={cn(
                  mergedProps.classNames?.actionButton,
                  mergedProps.toast?.classNames?.actionButton
                )}
              >
                {action.label}
              </button>
            );
          }
          return action;
        })()}
      </Show>
    </li>
  );
};

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
    style?: JSX.CSSProperties;
    cancelButtonStyle?: JSX.CSSProperties;
    actionButtonStyle?: JSX.CSSProperties;
    duration?: number;
    unstyled?: boolean;
    classNames?: ToastClassnames;
    closeButtonAriaLabel?: string;
  };
  class?: string;
  style?: JSX.CSSProperties;
  offset?: string | number | { top?: string | number; right?: string | number; bottom?: string | number; left?: string | number };
  mobileOffset?: string | number | { top?: string | number; right?: string | number; bottom?: string | number; left?: string | number };
  dir?: "rtl" | "ltr" | "auto";
  swipeDirections?: SwipeDirection[];
  icons?: ToastIcons;
  customAriaLabel?: string;
  containerAriaLabel?: string;
  ref?: (el: HTMLElement) => void;
}

export const Toaster = (props: ToasterProps) => {
  const mergedProps = mergeProps(
    {
      position: "bottom-right" as Position,
      hotkey: ["altKey", "KeyT"],
      theme: "light" as "light" | "dark" | "system",
      visibleToasts: VISIBLE_TOASTS_AMOUNT,
      dir: getDocumentDirection(),
      gap: GAP,
      containerAriaLabel: "Notifications",
    },
    props
  );

  const [toasts, setToasts] = createSignal<ToastT[]>([]);

  const filteredToasts = createMemo(() => {
    if (mergedProps.id) {
      return toasts().filter((toast) => toast.toasterId === mergedProps.id);
    }
    return toasts().filter((toast) => !toast.toasterId);
  });

  const possiblePositions = createMemo(() => {
    return Array.from(
      new Set(
        [mergedProps.position].concat(
          filteredToasts()
            .filter((toast) => toast.position)
            .map((toast) => toast.position!)
        )
      )
    );
  });

  const [heights, setHeights] = createSignal<HeightT[]>([]);
  const [expanded, setExpanded] = createSignal(false);
  const [interacting, setInteracting] = createSignal(false);
  const [actualTheme, setActualTheme] = createSignal<"light" | "dark">(
    mergedProps.theme !== "system"
      ? mergedProps.theme
      : typeof window !== "undefined"
      ? window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : "light"
  );

  let listRef: HTMLOListElement | undefined;
  const hotkeyLabel = mergedProps.hotkey.join("+").replace(/Key/g, "").replace(/Digit/g, "");
  let lastFocusedElementRef: HTMLElement | null = null;
  let isFocusWithinRef = false;

  const removeToast = (toastToRemove: ToastT) => {
    setToasts((toasts) => {
      if (!toasts.find((toast) => toast.id === toastToRemove.id)?.delete) {
        ToastState.dismiss(toastToRemove.id);
      }

      return toasts.filter(({ id }) => id !== toastToRemove.id);
    });
  };

  onMount(() => {
    const unsubscribe = ToastState.subscribe((toast) => {
      if ((toast as ToastToDismiss).dismiss) {
        // Prevent batching of other state updates
        requestAnimationFrame(() => {
          setToasts((toasts) =>
            toasts.map((t) =>
              t.id === toast.id ? { ...t, delete: true } : t
            )
          );
        });
        return;
      }

      // Update or add toast
      setTimeout(() => {
        setToasts((toasts) => {
          const indexOfExistingToast = toasts.findIndex(
            (t) => t.id === toast.id
          );

          // Update the toast if it already exists
          if (indexOfExistingToast !== -1) {
            return [
              ...toasts.slice(0, indexOfExistingToast),
              { ...toasts[indexOfExistingToast], ...toast },
              ...toasts.slice(indexOfExistingToast + 1),
            ];
          }

          return [toast as ToastT, ...toasts];
        });
      });
    });

    onCleanup(unsubscribe);
  });

  createEffect(() => {
    if (mergedProps.theme !== "system") {
      setActualTheme(mergedProps.theme);
      return;
    }

    if (mergedProps.theme === "system") {
      // check if current preference is dark
      if (
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
      ) {
        // it's currently dark
        setActualTheme("dark");
      } else {
        // it's not dark
        setActualTheme("light");
      }
    }

    if (typeof window === "undefined") return;
    const darkMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handler = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setActualTheme("dark");
      } else {
        setActualTheme("light");
      }
    };

    try {
      // Chrome & Firefox
      darkMediaQuery.addEventListener("change", handler);
      onCleanup(() => darkMediaQuery.removeEventListener("change", handler));
    } catch (error) {
      // Safari < 14
      darkMediaQuery.addListener(handler);
      onCleanup(() => darkMediaQuery.removeListener(handler));
    }
  });

  createEffect(() => {
    // Ensure expanded is always false when no toasts are present / only one left
    if (toasts().length <= 1) {
      setExpanded(false);
    }
  });

  onMount(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isHotkeyPressed =
        mergedProps.hotkey.length > 0 &&
        mergedProps.hotkey.every(
          (key) => (event as any)[key] || event.code === key
        );

      if (isHotkeyPressed) {
        setExpanded(true);
        listRef?.focus();
      }

      if (
        event.code === "Escape" &&
        (document.activeElement === listRef ||
          listRef?.contains(document.activeElement))
      ) {
        setExpanded(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);

    onCleanup(() => document.removeEventListener("keydown", handleKeyDown));
  });

  onMount(() => {
    onCleanup(() => {
      if (lastFocusedElementRef) {
        lastFocusedElementRef.focus({ preventScroll: true });
        lastFocusedElementRef = null;
        isFocusWithinRef = false;
      }
    });
  });

  return (
    <Portal>
      <section
        ref={(el) => mergedProps.ref?.(el)}
        aria-label={
          mergedProps.customAriaLabel ??
          `${mergedProps.containerAriaLabel} ${hotkeyLabel}`
        }
        tabIndex={-1}
        aria-live="polite"
        aria-relevant="additions text"
        aria-atomic="false"
      >
        <For each={possiblePositions()}>
          {(position, index) => {
            const [y, x] = position.split("-");

            const positionFiltered = createMemo(() => 
              filteredToasts().filter(
                (toast) =>
                  (!toast.position && index() === 0) ||
                  toast.position === position
              )
            );

            return (
              <Show when={positionFiltered().length > 0}>
                <ol
                  dir={
                    mergedProps.dir === "auto"
                      ? getDocumentDirection()
                      : mergedProps.dir
                  }
                  tabIndex={-1}
                  ref={listRef}
                  class={mergedProps.class}
                  data-sonner-toaster
                  data-sonner-theme={actualTheme()}
                  data-y-position={y}
                  data-x-position={x}
                  style={{
                    "--front-toast-height": `${heights()[0]?.height || 0}px`,
                    "--width": `${TOAST_WIDTH}px`,
                    "--gap": `${mergedProps.gap}px`,
                    ...mergedProps.style,
                    ...assignOffset(mergedProps.offset, mergedProps.mobileOffset),
                  }}
                  onBlur={(event) => {
                    if (
                      isFocusWithinRef &&
                      !event.currentTarget.contains(
                        event.relatedTarget as Node
                      )
                    ) {
                      isFocusWithinRef = false;
                      if (lastFocusedElementRef) {
                        lastFocusedElementRef.focus({ preventScroll: true });
                        lastFocusedElementRef = null;
                      }
                    }
                  }}
                  onFocus={(event) => {
                    const isNotDismissible =
                      event.target instanceof HTMLElement &&
                      event.target.dataset.dismissible === "false";

                    if (isNotDismissible) return;

                    if (!isFocusWithinRef) {
                      isFocusWithinRef = true;
                      lastFocusedElementRef =
                        event.relatedTarget as HTMLElement;
                    }
                  }}
                  onMouseEnter={() => setExpanded(true)}
                  onMouseMove={() => setExpanded(true)}
                  onMouseLeave={() => {
                    // Avoid setting expanded to false when interacting with a toast, e.g. swiping
                    if (!interacting()) {
                      setExpanded(false);
                    }
                  }}
                  onDragEnd={() => setExpanded(false)}
                  onPointerDown={(event) => {
                    const isNotDismissible =
                      event.target instanceof HTMLElement &&
                      event.target.dataset.dismissible === "false";

                    if (isNotDismissible) return;
                    setInteracting(true);
                  }}
                  onPointerUp={() => setInteracting(false)}
                >
                  <For each={positionFiltered()}>
                    {(toast, toastIndex) => (
                      <Toast
                        toast={toast}
                        icons={mergedProps.icons}
                        index={toastIndex()}
                        defaultRichColors={mergedProps.richColors}
                        duration={
                          mergedProps.toastOptions?.duration ??
                          mergedProps.duration
                        }
                        class={mergedProps.toastOptions?.className}
                        descriptionClass={
                          mergedProps.toastOptions?.descriptionClassName
                        }
                        invert={!!mergedProps.invert}
                        visibleToasts={mergedProps.visibleToasts}
                        closeButton={
                          mergedProps.toastOptions?.closeButton ??
                          !!mergedProps.closeButton
                        }
                        interacting={interacting()}
                        position={position}
                        style={mergedProps.toastOptions?.style}
                        unstyled={mergedProps.toastOptions?.unstyled}
                        classNames={mergedProps.toastOptions?.classNames}
                        cancelButtonStyle={
                          mergedProps.toastOptions?.cancelButtonStyle
                        }
                        actionButtonStyle={
                          mergedProps.toastOptions?.actionButtonStyle
                        }
                        closeButtonAriaLabel={
                          mergedProps.toastOptions?.closeButtonAriaLabel
                        }
                        removeToast={removeToast}
                        toasts={positionFiltered()}
                        heights={heights().filter(
                          (h) => h.position == toast.position
                        )}
                        setHeights={setHeights}
                        expandByDefault={!!mergedProps.expand}
                        gap={mergedProps.gap}
                        expanded={expanded()}
                        swipeDirections={mergedProps.swipeDirections}
                      />
                    )}
                  </For>
                </ol>
              </Show>
            );
          }}
        </For>
      </section>
    </Portal>
  );
};

// useSonner hook to access active toasts
export function useSonner() {
  const [activeToasts, setActiveToasts] = createSignal<ToastT[]>([]);

  onMount(() => {
    const unsubscribe = ToastState.subscribe((toast) => {
      if ((toast as ToastToDismiss).dismiss) {
        setTimeout(() => {
          setActiveToasts((toasts) => toasts.filter((t) => t.id !== toast.id));
        });
        return;
      }

      setTimeout(() => {
        setActiveToasts((toasts) => {
          const indexOfExistingToast = toasts.findIndex((t) => t.id === toast.id);

          // Update the toast if it already exists
          if (indexOfExistingToast !== -1) {
            return [
              ...toasts.slice(0, indexOfExistingToast),
              { ...toasts[indexOfExistingToast], ...toast },
              ...toasts.slice(indexOfExistingToast + 1),
            ];
          }

          return [toast as ToastT, ...toasts];
        });
      });
    });

    onCleanup(unsubscribe);
  });

  return {
    toasts: activeToasts,
  };
}

// Export types and main exports
export { toast, type ExternalToast, type ToastT };
export type { ToastClassnames, ToastToDismiss, Action };

