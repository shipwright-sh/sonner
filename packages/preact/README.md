<a href="https://www.shipwright.sh">
    <img src="https://www.shipwright.sh/banner.png" alt="Shipwright" />
</a>

# Preact

Read the original documentation [here](https://sonner.emilkowal.ski/).

## Installation

```bash
npm install @shipwright-sh/sonner-preact
```

## Usage

```tsx
import "@shipwright-sh/sonner-preact/style.css";

import { toast, Toaster } from "@shipwright-sh/sonner-preact";

export function App() {
    return (
        <div>
            <button onClick={() => toast("Hello, world!")}>Click me</button>
            
            <Toaster />
        </div>
    );
}
```

