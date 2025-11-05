import { signal } from "@preact/signals";
import { useEffect } from "preact/hooks";

export const useIsDocumentHidden = () => {
	const isDocumentHidden = signal(
		typeof document !== "undefined" ? document.hidden : false,
	);

	useEffect(() => {
		const callback = () => {
			isDocumentHidden.value = document.hidden;
		};
		document.addEventListener("visibilitychange", callback);
		return () => document.removeEventListener("visibilitychange", callback);
	}, []);

	return isDocumentHidden;
};
