<a href="https://www.shipwright.sh">
    <img src="https://www.shipwright.sh/banner.png" alt="Shipwright" />
</a>

# Solid

Read the original documentation [here](https://sonner.emilkowal.ski/).

## Installation

```bash
npm install @shipwright-sh/sonner-solid
```

## Usage

```tsx
import "@shipwright-sh/sonner-solid/style.css";

import { toast, Toaster } from "@shipwright-sh/sonner-solid";

export function App() {
    return (
        <div>
            <button onClick={() => toast("Hello, world!")}>Click me</button>
            
            <Toaster />
        </div>
    );
}
```