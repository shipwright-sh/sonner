import type { JSX } from "solid-js";

// Types adapted from the original library
export type ToastTypes =
  | "normal"
  | "action"
  | "success"
  | "info"
  | "warning"
  | "error"
  | "loading"
  | "default";

export type Position =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "top-center"
  | "bottom-center";

export type SwipeDirection = "top" | "right" | "bottom" | "left";

export type Offset =
  | {
      top?: string | number;
      right?: string | number;
      bottom?: string | number;
      left?: string | number;
    }
  | string
  | number;

export interface ToastClassnames {
  toast?: string;
  title?: string;
  description?: string;
  loader?: string;
  closeButton?: string;
  cancelButton?: string;
  actionButton?: string;
  success?: string;
  error?: string;
  info?: string;
  warning?: string;
  loading?: string;
  default?: string;
  content?: string;
  icon?: string;
}

export interface ToastIcons {
  success?: JSX.Element;
  info?: JSX.Element;
  warning?: JSX.Element;
  error?: JSX.Element;
  loading?: JSX.Element;
  close?: JSX.Element;
}

export interface Action {
  label: JSX.Element;
  onClick: (event: MouseEvent) => void;
  actionButtonStyle?: JSX.CSSProperties;
}

export interface ToastT {
  id: number | string;
  toasterId?: string;
  title?: (() => JSX.Element) | JSX.Element;
  type?: ToastTypes;
  icon?: JSX.Element;
  jsx?: JSX.Element;
  richColors?: boolean;
  invert?: boolean;
  closeButton?: boolean;
  dismissible?: boolean;
  description?: (() => JSX.Element) | JSX.Element;
  duration?: number;
  delete?: boolean;
  action?: Action | JSX.Element;
  cancel?: Action | JSX.Element;
  onDismiss?: (toast: ToastT) => void;
  onAutoClose?: (toast: ToastT) => void;
  promise?: Promise<any> | (() => Promise<any>);
  cancelButtonStyle?: JSX.CSSProperties;
  actionButtonStyle?: JSX.CSSProperties;
  style?: JSX.CSSProperties;
  unstyled?: boolean;
  className?: string;
  classNames?: ToastClassnames;
  descriptionClassName?: string;
  position?: Position;
  testId?: string;
}

interface ToastOptions {
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
  toasterId?: string;
}

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
  toastOptions?: ToastOptions;
  className?: string;
  style?: JSX.CSSProperties;
  offset?: Offset;
  mobileOffset?: Offset;
  dir?: "rtl" | "ltr" | "auto";
  swipeDirections?: SwipeDirection[];
  icons?: ToastIcons;
  customAriaLabel?: string;
  containerAriaLabel?: string;
}

export type ExternalToast = Omit<
  ToastT,
  "id" | "type" | "title" | "jsx" | "delete" | "promise"
> & {
  id?: number | string;
  toasterId?: string;
};

// Empty stub for Toaster component
export function Toaster(props: ToasterProps): JSX.Element {
  return null as any;
}

// Empty stub for toast function
type ToastFunction = ((
  message: (() => JSX.Element) | JSX.Element,
  data?: ExternalToast
) => number | string) & {
  success: (
    message: (() => JSX.Element) | JSX.Element,
    data?: ExternalToast
  ) => number | string;
  info: (
    message: (() => JSX.Element) | JSX.Element,
    data?: ExternalToast
  ) => number | string;
  warning: (
    message: (() => JSX.Element) | JSX.Element,
    data?: ExternalToast
  ) => number | string;
  error: (
    message: (() => JSX.Element) | JSX.Element,
    data?: ExternalToast
  ) => number | string;
  loading: (
    message: (() => JSX.Element) | JSX.Element,
    data?: ExternalToast
  ) => number | string;
  message: (
    message: (() => JSX.Element) | JSX.Element,
    data?: ExternalToast
  ) => number | string;
  custom: (
    jsx: (id: number | string) => JSX.Element,
    data?: ExternalToast
  ) => number | string;
  promise: <ToastData = any>(
    promise: Promise<ToastData> | (() => Promise<ToastData>),
    data?: any
  ) => any;
  dismiss: (id?: number | string) => number | string | undefined;
  getHistory: () => ToastT[];
  getToasts: () => ToastT[];
};

const toastStub = (() => 0) as unknown as ToastFunction;
toastStub.success = () => 0;
toastStub.info = () => 0;
toastStub.warning = () => 0;
toastStub.error = () => 0;
toastStub.loading = () => 0;
toastStub.message = () => 0;
toastStub.custom = () => 0;
toastStub.promise = () => ({ unwrap: () => Promise.resolve() });
toastStub.dismiss = () => undefined;
toastStub.getHistory = () => [];
toastStub.getToasts = () => [];

export const toast: ToastFunction = toastStub;
