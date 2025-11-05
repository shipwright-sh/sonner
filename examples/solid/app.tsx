import { createSignal } from "solid-js";
import { toast, Toaster } from "@shipwright-sh/sonner-solid";

export function App() {
    const [count, setCount] = createSignal(0);

    return (
        <div>
            <button onClick={() => toast("Hello, world!")}>Show toast</button>
            <Toaster />
        </div>
    );
}

