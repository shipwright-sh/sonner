import { useState } from "react";

export function App() {
    const [count, setCount] = useState(0);

    return (
        <div>
            <h1>Hello, world!</h1>
            <p>Count: {count}</p>
            <button onClick={() => setCount(count + 1)}>Increment</button>
        </div>
    );
}