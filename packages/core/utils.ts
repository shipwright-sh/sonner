import type { SwipeDirection, Offset } from "./types";
import { MOBILE_VIEWPORT_OFFSET, VIEWPORT_OFFSET } from "./constants";

export function cn(...classes: (string | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function getDefaultSwipeDirections(
  position: string
): Array<SwipeDirection> {
  const [y, x] = position.split("-");
  const directions: Array<SwipeDirection> = [];

  if (y) {
    directions.push(y as SwipeDirection);
  }

  if (x) {
    directions.push(x as SwipeDirection);
  }

  return directions;
}

export function isHttpResponse(data: any): data is Response {
  return (
    data &&
    typeof data === "object" &&
    "ok" in data &&
    typeof data.ok === "boolean" &&
    "status" in data &&
    typeof data.status === "number"
  );
}

export function getDocumentDirection(): "rtl" | "ltr" | "auto" {
  if (typeof window === "undefined") return "ltr";
  if (typeof document === "undefined") return "ltr"; // For Fresh purpose

  const dirAttribute = document.documentElement.getAttribute("dir");

  if (dirAttribute === "auto" || !dirAttribute) {
    return window.getComputedStyle(document.documentElement).direction as
      | "rtl"
      | "ltr"
      | "auto";
  }

  return dirAttribute as "rtl" | "ltr" | "auto";
}

export function assignOffset(
  defaultOffset: Offset | undefined,
  mobileOffset: Offset | undefined
): Record<string, string> {
  const styles: Record<string, string> = {};

  [defaultOffset, mobileOffset].forEach((offset, index) => {
    const isMobile = index === 1;
    const prefix = isMobile ? "--mobile-offset" : "--offset";
    const defaultValue = isMobile ? MOBILE_VIEWPORT_OFFSET : VIEWPORT_OFFSET;

    function assignAll(offset: string | number) {
      const keys = ["top", "right", "bottom", "left"] as const;
      keys.forEach((key) => {
        styles[`${prefix}-${key}`] =
          typeof offset === "number" ? `${offset}px` : offset;
      });
    }

    if (typeof offset === "number" || typeof offset === "string") {
      assignAll(offset);
    } else if (typeof offset === "object") {
      const keys = ["top", "right", "bottom", "left"] as const;
      keys.forEach((key) => {
        if (offset[key] === undefined) {
          styles[`${prefix}-${key}`] = defaultValue;
        } else {
          styles[`${prefix}-${key}`] =
            typeof offset[key] === "number" ? `${offset[key]}px` : offset[key];
        }
      });
    } else {
      assignAll(defaultValue);
    }
  });

  return styles;
}
