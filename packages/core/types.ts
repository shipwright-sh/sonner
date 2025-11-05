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

export type Theme = "light" | "dark";

export interface HeightT {
	height: number;
	toastId: number | string;
	position: Position;
}

export enum SwipeStateTypes {
	SwipedOut = "SwipedOut",
	SwipedBack = "SwipedBack",
	NotSwiped = "NotSwiped",
}

export type Offset =
	| {
			top?: string | number;
			right?: string | number;
			bottom?: string | number;
			left?: string | number;
	  }
	| string
	| number;
