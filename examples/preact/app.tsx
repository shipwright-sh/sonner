import "@shipwright-sh/sonner-preact/style.css";
import { Toaster, toast } from "@shipwright-sh/sonner-preact";

export function App() {
	return (
		<div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
			<h1>Sonner for Preact</h1>
			<div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
				<button onClick={() => toast("Hello, world!")}>Default Toast</button>
				<button onClick={() => toast.success("Success!")}>Success Toast</button>
				<button onClick={() => toast.error("Error!")}>Error Toast</button>
				<button onClick={() => toast.info("Info!")}>Info Toast</button>
				<button onClick={() => toast.warning("Warning!")}>Warning Toast</button>
				<button onClick={() => toast.loading("Loading...")}>
					Loading Toast
				</button>
				<button
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
