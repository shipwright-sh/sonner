import { useState } from "react";
import { toast, Toaster } from "sonner";

export function App() {
    const [count, setCount] = useState(0);

    return (
        <div>
            <button onClick={() => toast("Hello, world!")}>Show toast</button>
            <Toaster />
        </div>
    );
}