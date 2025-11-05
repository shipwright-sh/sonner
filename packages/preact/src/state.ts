import { isHttpResponse } from "@shipwright-sh/sonner-core";
import type { JSX } from "preact";

// Helper to check if a value is a JSX element
function isValidElement(value: any): boolean {
	return value !== null && typeof value === "object" && "type" in value;
}

type titleT = (() => JSX.Element) | JSX.Element | string;

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

export type PromiseT<Data = unknown> = Promise<Data> | (() => Promise<Data>);

export interface PromiseIExtendedResult extends ExternalToast {
	message: JSX.Element | string;
}

export type PromiseTExtendedResult<Data = unknown> =
	| PromiseIExtendedResult
	| ((data: Data) => PromiseIExtendedResult | Promise<PromiseIExtendedResult>);

export type PromiseTResult<Data = unknown> =
	| string
	| JSX.Element
	| ((data: Data) => JSX.Element | string | Promise<JSX.Element | string>);

export type PromiseExternalToast = Omit<ExternalToast, "description">;

export type PromiseData<ToastData = unknown> = PromiseExternalToast & {
	loading?: string | JSX.Element;
	success?: PromiseTResult<ToastData> | PromiseTExtendedResult<ToastData>;
	error?: PromiseTResult | PromiseTExtendedResult;
	description?: PromiseTResult;
	finally?: () => void | Promise<void>;
};

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
	label: JSX.Element | string;
	onClick: (event: MouseEvent) => void;
	actionButtonStyle?: JSX.CSSProperties;
}

export interface ToastT {
	id: number | string;
	toasterId?: string;
	title?: titleT;
	type?: ToastTypes;
	icon?: JSX.Element;
	jsx?: JSX.Element;
	richColors?: boolean;
	invert?: boolean;
	closeButton?: boolean;
	dismissible?: boolean;
	description?: titleT;
	duration?: number;
	delete?: boolean;
	action?: Action | JSX.Element;
	cancel?: Action | JSX.Element;
	onDismiss?: (toast: ToastT) => void;
	onAutoClose?: (toast: ToastT) => void;
	promise?: PromiseT;
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

export interface ToastToDismiss {
	id: number | string;
	dismiss: boolean;
}

export type ExternalToast = Omit<
	ToastT,
	"id" | "type" | "title" | "jsx" | "delete" | "promise"
> & {
	id?: number | string;
	toasterId?: string;
};

let toastsCounter = 1;

class Observer {
	subscribers: Array<(toast: ToastT | ToastToDismiss) => void>;
	toasts: Array<ToastT | ToastToDismiss>;
	dismissedToasts: Set<string | number>;

	constructor() {
		this.subscribers = [];
		this.toasts = [];
		this.dismissedToasts = new Set();
	}

	// We use arrow functions to maintain the correct `this` reference
	subscribe = (subscriber: (toast: ToastT | ToastToDismiss) => void) => {
		this.subscribers.push(subscriber);

		return () => {
			const index = this.subscribers.indexOf(subscriber);
			this.subscribers.splice(index, 1);
		};
	};

	publish = (data: ToastT) => {
		this.subscribers.forEach((subscriber) => {
			subscriber(data);
		});
	};

	addToast = (data: ToastT) => {
		this.publish(data);
		this.toasts = [...this.toasts, data];
	};

	create = (
		data: ExternalToast & {
			message?: titleT;
			type?: ToastTypes;
			promise?: PromiseT;
			jsx?: JSX.Element;
		},
	) => {
		const { message, ...rest } = data;
		const id =
			typeof data?.id === "number" || (data.id && data.id.length > 0)
				? data.id
				: toastsCounter++;
		const alreadyExists = this.toasts.find((toast) => {
			return toast.id === id;
		});
		const dismissible =
			data.dismissible === undefined ? true : data.dismissible;

		if (this.dismissedToasts.has(id)) {
			this.dismissedToasts.delete(id);
		}

		if (alreadyExists) {
			this.toasts = this.toasts.map((toast) => {
				if (toast.id === id) {
					this.publish({ ...toast, ...data, id, title: message });
					return {
						...toast,
						...data,
						id,
						dismissible,
						title: message,
					};
				}

				return toast;
			});
		} else {
			this.addToast({ title: message, ...rest, dismissible, id });
		}

		return id;
	};

	dismiss = (id?: number | string) => {
		if (id) {
			this.dismissedToasts.add(id);
			requestAnimationFrame(() =>
				this.subscribers.forEach((subscriber) => {
					subscriber({ id, dismiss: true });
				}),
			);
		} else {
			this.toasts.forEach((toast) => {
				this.subscribers.forEach((subscriber) => {
					subscriber({ id: toast.id, dismiss: true });
				});
			});
		}

		return id;
	};

	message = (message: titleT, data?: ExternalToast) => {
		return this.create({ ...data, message });
	};

	error = (message: titleT, data?: ExternalToast) => {
		return this.create({ ...data, message, type: "error" });
	};

	success = (message: titleT, data?: ExternalToast) => {
		return this.create({ ...data, type: "success", message });
	};

	info = (message: titleT, data?: ExternalToast) => {
		return this.create({ ...data, type: "info", message });
	};

	warning = (message: titleT, data?: ExternalToast) => {
		return this.create({ ...data, type: "warning", message });
	};

	loading = (message: titleT, data?: ExternalToast) => {
		return this.create({ ...data, type: "loading", message });
	};

	promise = <ToastData>(
		promise: PromiseT<ToastData>,
		data?: PromiseData<ToastData>,
	) => {
		if (!data) {
			// Nothing to show
			return;
		}

		let id: string | number | undefined;
		if (data.loading !== undefined) {
			id = this.create({
				...data,
				promise,
				type: "loading",
				message: data.loading,
				description:
					typeof data.description !== "function" ? data.description : undefined,
			});
		}

		const p = Promise.resolve(
			promise instanceof Function ? promise() : promise,
		);

		let shouldDismiss = id !== undefined;
		let result: ["resolve", ToastData] | ["reject", unknown];

		const originalPromise = p
			.then(async (response) => {
				result = ["resolve", response];
				const isElementResponse = isValidElement(response);
				if (isElementResponse) {
					shouldDismiss = false;
					this.create({
						id,
						type: "default",
						message: response as JSX.Element,
					});
				} else if (isHttpResponse(response) && !response.ok) {
					shouldDismiss = false;

					const promiseData =
						typeof data.error === "function"
							? await data.error(`HTTP error! status: ${response.status}`)
							: data.error;

					const description =
						typeof data.description === "function"
							? await data.description(`HTTP error! status: ${response.status}`)
							: data.description;

					const isExtendedResult =
						typeof promiseData === "object" && !isValidElement(promiseData);

					const toastSettings: PromiseIExtendedResult = isExtendedResult
						? (promiseData as PromiseIExtendedResult)
						: { message: promiseData as JSX.Element | string };

					this.create({ id, type: "error", description, ...toastSettings });
				} else if (response instanceof Error) {
					shouldDismiss = false;

					const promiseData =
						typeof data.error === "function"
							? await data.error(response)
							: data.error;

					const description =
						typeof data.description === "function"
							? await data.description(response)
							: data.description;

					const isExtendedResult =
						typeof promiseData === "object" && !isValidElement(promiseData);

					const toastSettings: PromiseIExtendedResult = isExtendedResult
						? (promiseData as PromiseIExtendedResult)
						: { message: promiseData as JSX.Element | string };

					this.create({ id, type: "error", description, ...toastSettings });
				} else if (data.success !== undefined) {
					shouldDismiss = false;
					const promiseData =
						typeof data.success === "function"
							? await data.success(response)
							: data.success;

					const description =
						typeof data.description === "function"
							? await data.description(response)
							: data.description;

					const isExtendedResult =
						typeof promiseData === "object" && !isValidElement(promiseData);

					const toastSettings: PromiseIExtendedResult = isExtendedResult
						? (promiseData as PromiseIExtendedResult)
						: { message: promiseData as JSX.Element | string };

					this.create({ id, type: "success", description, ...toastSettings });
				}
			})
			.catch(async (error) => {
				result = ["reject", error];
				if (data.error !== undefined) {
					shouldDismiss = false;
					const promiseData =
						typeof data.error === "function"
							? await data.error(error)
							: data.error;

					const description =
						typeof data.description === "function"
							? await data.description(error)
							: data.description;

					const isExtendedResult =
						typeof promiseData === "object" && !isValidElement(promiseData);

					const toastSettings: PromiseIExtendedResult = isExtendedResult
						? (promiseData as PromiseIExtendedResult)
						: { message: promiseData as JSX.Element | string };

					this.create({ id, type: "error", description, ...toastSettings });
				}
			})
			.finally(() => {
				if (shouldDismiss) {
					// Toast is still in load state (and will be indefinitely — dismiss it)
					this.dismiss(id);
					id = undefined;
				}

				data.finally?.();
			});

		const unwrap = () =>
			new Promise<ToastData>((resolve, reject) =>
				originalPromise
					.then(() =>
						result[0] === "reject" ? reject(result[1]) : resolve(result[1]),
					)
					.catch(reject),
			);

		if (typeof id !== "string" && typeof id !== "number") {
			// cannot Object.assign on undefined
			return { unwrap };
		} else {
			return Object.assign(id, { unwrap });
		}
	};

	custom = (
		jsx: (id: number | string) => JSX.Element,
		data?: ExternalToast,
	) => {
		const id = data?.id || toastsCounter++;
		this.create({ jsx: jsx(id), id, ...data });
		return id;
	};

	getActiveToasts = () => {
		return this.toasts.filter((toast) => !this.dismissedToasts.has(toast.id));
	};
}

export const ToastState = new Observer();

// bind this to the toast function
const toastFunction = (message: titleT, data?: ExternalToast) => {
	const id = data?.id || toastsCounter++;

	ToastState.addToast({
		title: message,
		...data,
		id,
	});
	return id;
};

const basicToast = toastFunction;

const getHistory = () => ToastState.toasts;
const getToasts = () => ToastState.getActiveToasts();

// We use `Object.assign` to maintain the correct types as we would lose them otherwise
export const toast = Object.assign(
	basicToast,
	{
		success: ToastState.success,
		info: ToastState.info,
		warning: ToastState.warning,
		error: ToastState.error,
		custom: ToastState.custom,
		message: ToastState.message,
		promise: ToastState.promise,
		dismiss: ToastState.dismiss,
		loading: ToastState.loading,
	},
	{ getHistory, getToasts },
);
