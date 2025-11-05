import type { JSX } from "preact";
import { useRef, useEffect, useLayoutEffect } from "preact/hooks";
import { signal, computed, effect } from "@preact/signals";
import { createPortal } from "preact/compat";
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
  className?: string;
  unstyled?: boolean;
  descriptionClassName?: string;
  classNames?: ToastClassnames;
  icons?: ToastIcons;
  closeButtonAriaLabel?: string;
  defaultRichColors?: boolean;
}

const Toast = (props: ToastProps) => {
  const {
    toast: toastProp,
    toasts,
    index,
    expanded,
    invert: toasterInvert,
    heights,
    setHeights,
    removeToast,
    gap = GAP,
    position,
    visibleToasts,
    expandByDefault,
    closeButton: closeButtonFromToaster,
    interacting,
    style,
    cancelButtonStyle,
    actionButtonStyle,
    duration: durationFromToaster,
    className = "",
    descriptionClassName = "",
    classNames,
    icons,
    closeButtonAriaLabel = "Close toast",
    unstyled,
    defaultRichColors,
    swipeDirections,
  } = props;

  const swipeDirection = signal<"x" | "y" | null>(null);
  const swipeOutDirection = signal<"left" | "right" | "up" | "down" | null>(null);
  const mounted = signal(false);
  const removed = signal(false);
  const swiping = signal(false);
  const swipeOut = signal(false);
  const isSwiped = signal(false);
  const offsetBeforeRemove = signal(0);
  const initialHeight = signal(0);

  const remainingTime = useRef(
    toastProp.duration || durationFromToaster || TOAST_LIFETIME
  );
  const dragStartTime = useRef<Date | null>(null);
  const toastRef = useRef<HTMLLIElement>(null);

  const isFront = index === 0;
  const isVisible = index + 1 <= visibleToasts;
  const toastType = toastProp.type;
  const dismissible = toastProp.dismissible !== false;
  const toastClassname = toastProp.className || "";
  const toastDescriptionClassname = toastProp.descriptionClassName || "";

  const heightIndex = computed(
    () => heights.findIndex((height) => height.toastId === toastProp.id) || 0
  );

  const closeButton = computed(
    () => toastProp.closeButton ?? closeButtonFromToaster
  );

  const duration = computed(
    () => toastProp.duration || durationFromToaster || TOAST_LIFETIME
  );

  const closeTimerStartTimeRef = useRef(0);
  const offset = useRef(0);
  const lastCloseTimerStartTimeRef = useRef(0);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);

  const [y, x] = position.split("-");

  const toastsHeightBefore = computed(() => {
    return heights.reduce((prev, curr, reducerIndex) => {
      if (reducerIndex >= heightIndex.value) {
        return prev;
      }
      return prev + curr.height;
    }, 0);
  });

  const isDocumentHidden = useIsDocumentHidden();
  const invert = toastProp.invert || toasterInvert;
  const disabled = toastType === "loading";

  offset.current = computed(
    () => heightIndex.value * gap + toastsHeightBefore.value
  ).value;

  useEffect(() => {
    remainingTime.current = duration.value;
  }, [duration.value]);

  useEffect(() => {
    mounted.value = true;
  }, []);

  useEffect(() => {
    const toastNode = toastRef.current;
    if (toastNode) {
      const height = toastNode.getBoundingClientRect().height;
      initialHeight.value = height;
      setHeights((h) => [
        { toastId: toastProp.id, height, position: toastProp.position! },
        ...h,
      ]);
      return () =>
        setHeights((h) => h.filter((height) => height.toastId !== toastProp.id));
    }
  }, [setHeights, toastProp.id]);

  useLayoutEffect(() => {
    if (!mounted.value) return;
    const toastNode = toastRef.current;
    if (!toastNode) return;

    const originalHeight = toastNode.style.height;
    toastNode.style.height = "auto";
    const newHeight = toastNode.getBoundingClientRect().height;
    toastNode.style.height = originalHeight;

    initialHeight.value = newHeight;

    setHeights((heights) => {
      const alreadyExists = heights.find(
        (height) => height.toastId === toastProp.id
      );
      if (!alreadyExists) {
        return [
          {
            toastId: toastProp.id,
            height: newHeight,
            position: toastProp.position!,
          },
          ...heights,
        ];
      } else {
        return heights.map((height) =>
          height.toastId === toastProp.id
            ? { ...height, height: newHeight }
            : height
        );
      }
    });
  }, [
    mounted.value,
    toastProp.title,
    toastProp.description,
    setHeights,
    toastProp.id,
    toastProp.jsx,
    toastProp.action,
    toastProp.cancel,
  ]);

  const deleteToast = () => {
    removed.value = true;
    offsetBeforeRemove.value = offset.current;
    setHeights((h) => h.filter((height) => height.toastId !== toastProp.id));

    setTimeout(() => {
      removeToast(toastProp);
    }, TIME_BEFORE_UNMOUNT);
  };

  useEffect(() => {
    if (
      (toastProp.promise && toastType === "loading") ||
      toastProp.duration === Infinity ||
      toastProp.type === "loading"
    )
      return;

    let timeoutId: NodeJS.Timeout;

    const pauseTimer = () => {
      if (
        lastCloseTimerStartTimeRef.current < closeTimerStartTimeRef.current
      ) {
        const elapsedTime =
          new Date().getTime() - closeTimerStartTimeRef.current;
        remainingTime.current = remainingTime.current - elapsedTime;
      }
      lastCloseTimerStartTimeRef.current = new Date().getTime();
    };

    const startTimer = () => {
      if (remainingTime.current === Infinity) return;
      closeTimerStartTimeRef.current = new Date().getTime();
      timeoutId = setTimeout(() => {
        toastProp.onAutoClose?.(toastProp);
        deleteToast();
      }, remainingTime.current);
    };

    if (expanded || interacting || isDocumentHidden.value) {
      pauseTimer();
    } else {
      startTimer();
    }

    return () => clearTimeout(timeoutId);
  }, [
    expanded,
    interacting,
    toastProp,
    toastType,
    isDocumentHidden.value,
  ]);

  useEffect(() => {
    if (toastProp.delete) {
      deleteToast();
      toastProp.onDismiss?.(toastProp);
    }
  }, [toastProp.delete]);

  function getLoadingIcon() {
    if (icons?.loading) {
      return (
        <div
          class={cn(
            classNames?.loader,
            toastProp?.classNames?.loader,
            "sonner-loader"
          )}
          data-visible={toastType === "loading"}
        >
          {icons.loading}
        </div>
      );
    }

    return (
      <Loader
        class={cn(classNames?.loader, toastProp?.classNames?.loader)}
        visible={toastType === "loading"}
      />
    );
  }

  const icon = toastProp.icon || icons?.[toastType as keyof ToastIcons] || getAsset(toastType as ToastTypes);

  return (
    <li
      tabIndex={0}
      ref={toastRef}
      class={cn(
        className,
        toastClassname,
        classNames?.toast,
        toastProp?.classNames?.toast,
        classNames?.default,
        classNames?.[toastType as keyof ToastClassnames],
        toastProp?.classNames?.[toastType as keyof ToastClassnames]
      )}
      data-sonner-toast=""
      data-rich-colors={toastProp.richColors ?? defaultRichColors}
      data-styled={
        !Boolean(toastProp.jsx || toastProp.unstyled || unstyled)
      }
      data-mounted={mounted.value}
      data-promise={Boolean(toastProp.promise)}
      data-swiped={isSwiped.value}
      data-removed={removed.value}
      data-visible={isVisible}
      data-y-position={y}
      data-x-position={x}
      data-index={index}
      data-front={isFront}
      data-swiping={swiping.value}
      data-dismissible={dismissible}
      data-type={toastType}
      data-invert={invert}
      data-swipe-out={swipeOut.value}
      data-swipe-direction={swipeOutDirection.value}
      data-expanded={Boolean(expanded || (expandByDefault && mounted.value))}
      data-testid={toastProp.testId}
      style={{
        "--index": index,
        "--toasts-before": index,
        "--z-index": toasts.length - index,
        "--offset": `${removed.value ? offsetBeforeRemove.value : offset.current}px`,
        "--initial-height": expandByDefault ? "auto" : `${initialHeight.value}px`,
        ...style,
        ...toastProp.style,
      } as JSX.CSSProperties}
      onDragEnd={() => {
        swiping.value = false;
        swipeDirection.value = null;
        pointerStartRef.current = null;
      }}
      onPointerDown={(event) => {
        if (event.button === 2) return;
        if (disabled || !dismissible) return;
        dragStartTime.current = new Date();
        offsetBeforeRemove.value = offset.current;
        (event.target as HTMLElement).setPointerCapture(event.pointerId);
        if ((event.target as HTMLElement).tagName === "BUTTON") return;
        swiping.value = true;
        pointerStartRef.current = { x: event.clientX, y: event.clientY };
      }}
      onPointerUp={() => {
        if (swipeOut.value || !dismissible) return;

        pointerStartRef.current = null;
        const swipeAmountX = Number(
          toastRef.current?.style
            .getPropertyValue("--swipe-amount-x")
            .replace("px", "") || 0
        );
        const swipeAmountY = Number(
          toastRef.current?.style
            .getPropertyValue("--swipe-amount-y")
            .replace("px", "") || 0
        );
        const timeTaken =
          new Date().getTime() - (dragStartTime.current?.getTime() || 0);

        const swipeAmount =
          swipeDirection.value === "x" ? swipeAmountX : swipeAmountY;
        const velocity = Math.abs(swipeAmount) / timeTaken;

        if (Math.abs(swipeAmount) >= SWIPE_THRESHOLD || velocity > 0.11) {
          offsetBeforeRemove.value = offset.current;
          toastProp.onDismiss?.(toastProp);

          if (swipeDirection.value === "x") {
            swipeOutDirection.value = swipeAmountX > 0 ? "right" : "left";
          } else {
            swipeOutDirection.value = swipeAmountY > 0 ? "down" : "up";
          }

          deleteToast();
          swipeOut.value = true;
          return;
        } else {
          toastRef.current?.style.setProperty("--swipe-amount-x", `0px`);
          toastRef.current?.style.setProperty("--swipe-amount-y", `0px`);
        }
        isSwiped.value = false;
        swiping.value = false;
        swipeDirection.value = null;
      }}
      onPointerMove={(event) => {
        if (!pointerStartRef.current || !dismissible) return;

        const isHighlighted = window.getSelection()?.toString().length || 0 > 0;
        if (isHighlighted) return;

        const yDelta = event.clientY - pointerStartRef.current.y;
        const xDelta = event.clientX - pointerStartRef.current.x;

        const swipeDirectionsToUse =
          swipeDirections ?? getDefaultSwipeDirections(position);

        if (
          !swipeDirection.value &&
          (Math.abs(xDelta) > 1 || Math.abs(yDelta) > 1)
        ) {
          swipeDirection.value = Math.abs(xDelta) > Math.abs(yDelta) ? "x" : "y";
        }

        let swipeAmount = { x: 0, y: 0 };

        const getDampening = (delta: number) => {
          const factor = Math.abs(delta) / 20;
          return 1 / (1.5 + factor);
        };

        if (swipeDirection.value === "y") {
          if (
            swipeDirectionsToUse.includes("top") ||
            swipeDirectionsToUse.includes("bottom")
          ) {
            if (
              (swipeDirectionsToUse.includes("top") && yDelta < 0) ||
              (swipeDirectionsToUse.includes("bottom") && yDelta > 0)
            ) {
              swipeAmount.y = yDelta;
            } else {
              const dampenedDelta = yDelta * getDampening(yDelta);
              swipeAmount.y =
                Math.abs(dampenedDelta) < Math.abs(yDelta)
                  ? dampenedDelta
                  : yDelta;
            }
          }
        } else if (swipeDirection.value === "x") {
          if (
            swipeDirectionsToUse.includes("left") ||
            swipeDirectionsToUse.includes("right")
          ) {
            if (
              (swipeDirectionsToUse.includes("left") && xDelta < 0) ||
              (swipeDirectionsToUse.includes("right") && xDelta > 0)
            ) {
              swipeAmount.x = xDelta;
            } else {
              const dampenedDelta = xDelta * getDampening(xDelta);
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

        toastRef.current?.style.setProperty(
          "--swipe-amount-x",
          `${swipeAmount.x}px`
        );
        toastRef.current?.style.setProperty(
          "--swipe-amount-y",
          `${swipeAmount.y}px`
        );
      }}
    >
      {closeButton.value && !toastProp.jsx && toastType !== "loading" ? (
        <button
          aria-label={closeButtonAriaLabel}
          data-disabled={disabled}
          data-close-button
          onClick={
            disabled || !dismissible
              ? () => {}
              : () => {
                  deleteToast();
                  toastProp.onDismiss?.(toastProp);
                }
          }
          class={cn(
            classNames?.closeButton,
            toastProp?.classNames?.closeButton
          )}
        >
          {icons?.close ?? CloseIcon}
        </button>
      ) : null}
      {(toastType || toastProp.icon || toastProp.promise) &&
      toastProp.icon !== null &&
      (icons?.[toastType as keyof ToastIcons] !== null || toastProp.icon) ? (
        <div
          data-icon=""
          class={cn(classNames?.icon, toastProp?.classNames?.icon)}
        >
          {toastProp.promise ||
          (toastProp.type === "loading" && !toastProp.icon)
            ? toastProp.icon || getLoadingIcon()
            : null}
          {toastProp.type !== "loading" ? icon : null}
        </div>
      ) : null}

      <div
        data-content=""
        class={cn(classNames?.content, toastProp?.classNames?.content)}
      >
        <div
          data-title=""
          class={cn(classNames?.title, toastProp?.classNames?.title)}
        >
          {toastProp.jsx
            ? toastProp.jsx
            : typeof toastProp.title === "function"
            ? toastProp.title()
            : toastProp.title}
        </div>
        {toastProp.description ? (
          <div
            data-description=""
            class={cn(
              descriptionClassName,
              toastDescriptionClassname,
              classNames?.description,
              toastProp?.classNames?.description
            )}
          >
            {typeof toastProp.description === "function"
              ? toastProp.description()
              : toastProp.description}
          </div>
        ) : null}
      </div>
      {toastProp.cancel && isAction(toastProp.cancel) ? (
        <button
          data-button
          data-cancel
          style={toastProp.cancel.actionButtonStyle || cancelButtonStyle}
          onClick={(event) => {
            const cancel = toastProp.cancel;
            if (!cancel || !isAction(cancel)) return;
            if (!dismissible) return;
            cancel.onClick?.(event);
            deleteToast();
          }}
          class={cn(
            classNames?.cancelButton,
            toastProp?.classNames?.cancelButton
          )}
        >
          {toastProp.cancel.label}
        </button>
      ) : toastProp.cancel ? (
        toastProp.cancel
      ) : null}
      {toastProp.action && isAction(toastProp.action) ? (
        <button
          data-button
          data-action
          style={toastProp.action.actionButtonStyle || actionButtonStyle}
          onClick={(event) => {
            const action = toastProp.action;
            if (!action || !isAction(action)) return;
            action.onClick?.(event);
            if (event.defaultPrevented) return;
            deleteToast();
          }}
          class={cn(
            classNames?.actionButton,
            toastProp?.classNames?.actionButton
          )}
        >
          {toastProp.action.label}
        </button>
      ) : toastProp.action ? (
        toastProp.action
      ) : null}
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
  className?: string;
  style?: JSX.CSSProperties;
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

export const Toaster = (props: ToasterProps) => {
  const {
    id,
    invert,
    position = "bottom-right",
    hotkey = ["altKey", "KeyT"],
    expand,
    closeButton,
    className,
    offset,
    mobileOffset,
    theme = "light",
    richColors,
    duration,
    style,
    visibleToasts = VISIBLE_TOASTS_AMOUNT,
    toastOptions,
    dir = getDocumentDirection(),
    gap = GAP,
    icons,
    customAriaLabel,
    containerAriaLabel = "Notifications",
    swipeDirections,
  } = props;

  const toasts = signal<ToastT[]>([]);

  const filteredToasts = computed(() => {
    if (id) {
      return toasts.value.filter((toast: ToastT) => toast.toasterId === id);
    }
    return toasts.value.filter((toast: ToastT) => !toast.toasterId);
  });

  const possiblePositions = computed(() => {
    return Array.from(
      new Set(
        [position].concat(
          filteredToasts.value
            .filter((toast: ToastT) => toast.position)
            .map((toast: ToastT) => toast.position!)
        )
      )
    );
  });

  const heights = signal<HeightT[]>([]);
  const expanded = signal(false);
  const interacting = signal(false);
  const actualTheme = signal<"light" | "dark">(
    theme !== "system"
      ? theme
      : typeof window !== "undefined"
      ? window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : "light"
  );

  const listRef = useRef<HTMLOListElement>(null);
  const hotkeyLabel = hotkey.join("+").replace(/Key/g, "").replace(/Digit/g, "");
  const lastFocusedElementRef = useRef<HTMLElement>(null);
  const isFocusWithinRef = useRef(false);

  const removeToast = (toastToRemove: ToastT) => {
    if (!toasts.value.find((toast: ToastT) => toast.id === toastToRemove.id)?.delete) {
      ToastState.dismiss(toastToRemove.id);
    }
    toasts.value = toasts.value.filter(({ id }: { id: string | number }) => id !== toastToRemove.id);
  };

  useEffect(() => {
    return ToastState.subscribe((toast: ToastT | ToastToDismiss) => {
      if ((toast as ToastToDismiss).dismiss) {
        requestAnimationFrame(() => {
          toasts.value = toasts.value.map((t: ToastT) =>
            t.id === toast.id ? { ...t, delete: true } : t
          );
        });
        return;
      }

      setTimeout(() => {
        const indexOfExistingToast = toasts.value.findIndex(
          (t: ToastT) => t.id === toast.id
        );

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
  }, []);

  useEffect(() => {
    if (theme !== "system") {
      actualTheme.value = theme;
      return;
    }

    if (theme === "system") {
      if (
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
      ) {
        actualTheme.value = "dark";
      } else {
        actualTheme.value = "light";
      }
    }

    if (typeof window === "undefined") return;
    const darkMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handler = (event: MediaQueryListEvent) => {
      if (event.matches) {
        actualTheme.value = "dark";
      } else {
        actualTheme.value = "light";
      }
    };

    try {
      darkMediaQuery.addEventListener("change", handler);
      return () => darkMediaQuery.removeEventListener("change", handler);
    } catch (error) {
      darkMediaQuery.addListener(handler);
      return () => darkMediaQuery.removeListener(handler);
    }
  }, [theme]);

  useEffect(() => {
    if (toasts.value.length <= 1) {
      expanded.value = false;
    }
  }, [toasts.value.length]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isHotkeyPressed =
        hotkey.length > 0 &&
        hotkey.every((key) => (event as any)[key] || event.code === key);

      if (isHotkeyPressed) {
        expanded.value = true;
        listRef.current?.focus();
      }

      if (
        event.code === "Escape" &&
        (document.activeElement === listRef.current ||
          listRef.current?.contains(document.activeElement))
      ) {
        expanded.value = false;
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [hotkey]);

  useEffect(() => {
    return () => {
      if (lastFocusedElementRef.current) {
        lastFocusedElementRef.current.focus({ preventScroll: true });
        lastFocusedElementRef.current = null;
        isFocusWithinRef.current = false;
      }
    };
  }, []);

  const setHeights = (fn: (h: HeightT[]) => HeightT[]) => {
    heights.value = fn(heights.value);
  };

  return createPortal(
    <section
      aria-label={customAriaLabel ?? `${containerAriaLabel} ${hotkeyLabel}`}
      tabIndex={-1}
      aria-live="polite"
      aria-relevant="additions text"
      aria-atomic="false"
    >
      {possiblePositions.value.map((position: Position, index: number) => {
        const [y, x] = position.split("-");

        if (!filteredToasts.value.length) return null;

        return (
          <ol
            key={position}
            dir={dir === "auto" ? getDocumentDirection() : dir}
            tabIndex={-1}
            ref={listRef}
            class={className}
            data-sonner-toaster
            data-sonner-theme={actualTheme.value}
            data-y-position={y}
            data-x-position={x}
            style={{
              "--front-toast-height": `${heights.value[0]?.height || 0}px`,
              "--width": `${TOAST_WIDTH}px`,
              "--gap": `${gap}px`,
              ...style,
              ...assignOffset(offset, mobileOffset),
            } as JSX.CSSProperties}
            onBlur={(event) => {
              if (
                isFocusWithinRef.current &&
                !event.currentTarget.contains(event.relatedTarget as Node)
              ) {
                isFocusWithinRef.current = false;
                if (lastFocusedElementRef.current) {
                  lastFocusedElementRef.current.focus({
                    preventScroll: true,
                  });
                  lastFocusedElementRef.current = null;
                }
              }
            }}
            onFocus={(event) => {
              const isNotDismissible =
                event.target instanceof HTMLElement &&
                event.target.dataset.dismissible === "false";

              if (isNotDismissible) return;

              if (!isFocusWithinRef.current) {
                isFocusWithinRef.current = true;
                lastFocusedElementRef.current =
                  event.relatedTarget as HTMLElement;
              }
            }}
            onMouseEnter={() => (expanded.value = true)}
            onMouseMove={() => (expanded.value = true)}
            onMouseLeave={() => {
              if (!interacting.value) {
                expanded.value = false;
              }
            }}
            onDragEnd={() => (expanded.value = false)}
            onPointerDown={(event) => {
              const isNotDismissible =
                event.target instanceof HTMLElement &&
                event.target.dataset.dismissible === "false";

              if (isNotDismissible) return;
              interacting.value = true;
            }}
            onPointerUp={() => (interacting.value = false)}
          >
            {filteredToasts.value
              .filter(
                (toast: ToastT) =>
                  (!toast.position && index === 0) ||
                  toast.position === position
              )
              .map((toast: ToastT, index: number) => (
                <Toast
                  key={toast.id}
                  icons={icons}
                  index={index}
                  toast={toast}
                  defaultRichColors={richColors}
                  duration={toastOptions?.duration ?? duration}
                  className={toastOptions?.className}
                  descriptionClassName={toastOptions?.descriptionClassName}
                  invert={!!invert}
                  visibleToasts={visibleToasts}
                  closeButton={toastOptions?.closeButton ?? !!closeButton}
                  interacting={interacting.value}
                  position={position}
                  style={toastOptions?.style}
                  unstyled={toastOptions?.unstyled}
                  classNames={toastOptions?.classNames}
                  cancelButtonStyle={toastOptions?.cancelButtonStyle}
                  actionButtonStyle={toastOptions?.actionButtonStyle}
                  closeButtonAriaLabel={toastOptions?.closeButtonAriaLabel}
                  removeToast={removeToast}
                  toasts={filteredToasts.value.filter(
                    (t: ToastT) => t.position == toast.position
                  )}
                  heights={heights.value.filter(
                    (h: HeightT) => h.position == toast.position
                  )}
                  setHeights={setHeights}
                  expandByDefault={!!expand}
                  gap={gap}
                  expanded={expanded.value}
                  swipeDirections={swipeDirections}
                />
              ))}
          </ol>
        );
      })}
    </section>,
    document.body
  );
};

export function useSonner() {
  const activeToasts = signal<ToastT[]>([]);

  useEffect(() => {
    return ToastState.subscribe((toast: ToastT | ToastToDismiss) => {
      if ((toast as ToastToDismiss).dismiss) {
        setTimeout(() => {
          activeToasts.value = activeToasts.value.filter(
            (t: ToastT) => t.id !== toast.id
          );
        });
        return;
      }

      setTimeout(() => {
        const indexOfExistingToast = activeToasts.value.findIndex(
          (t: ToastT) => t.id === toast.id
        );

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
  }, []);

  return {
    toasts: activeToasts,
  };
}

export { toast, type ExternalToast, type ToastT };
export type { ToastClassnames, ToastToDismiss, Action };
