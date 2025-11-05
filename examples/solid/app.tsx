import "@shipwright-sh/sonner-solid/style.css";
import { Toaster, toast } from "@shipwright-sh/sonner-solid";

export function App() {
	return (
		<div style={{ padding: "2rem", "font-family": "sans-serif" }}>
			<h1>Sonner for Solid JS</h1>
			<div style={{ display: "flex", gap: "1rem", "flex-wrap": "wrap" }}>
				<button
					type="button"
					onClick={() => toast("Hello, world!")}
					data-testid="default-toast"
				>
					Default Toast
				</button>
				<button type="button" onClick={() => toast.success("Success!")}>
					Success Toast
				</button>
				<button type="button" onClick={() => toast.error("Error!")}>
					Error Toast
				</button>
				<button type="button" onClick={() => toast.info("Info!")}>
					Info Toast
				</button>
				<button type="button" onClick={() => toast.warning("Warning!")}>
					Warning Toast
				</button>
				<button type="button" onClick={() => toast.loading("Loading...")}>
					Loading Toast
				</button>
				<button
					type="button"
					onClick={() =>
						toast("Event has been created", {
							description: "Monday, January 3rd at 6:00pm",
							action: {
								label: "Undo",
								onClick: () => console.log("Undo"),
							},
						})
					}
				>
					With Action
				</button>
				<button
					type="button"
					onClick={() => {
						const promise = () =>
							new Promise<{ name: string }>((resolve) =>
								setTimeout(() => resolve({ name: "Sonner" }), 2000),
							);

						toast.promise(promise, {
							loading: "Loading...",
							success: (data: { name: string }) => `${data.name} loaded!`,
							error: "Error loading",
						});
					}}
				>
					Promise
				</button>
			</div>

			<Toaster />
		</div>
	);
}
