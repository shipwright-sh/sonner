import { Toaster, toast } from "sonner";

export function App() {
	return (
		<div>
			<button type="button" onClick={() => toast("Hello, world!")}>
				Show toast
			</button>
			<Toaster />
		</div>
	);
}
