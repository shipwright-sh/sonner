<a href="https://www.shipwright.sh">
    <img src="https://www.shipwright.sh/banner.png" alt="Shipwright" />
</a>

# Vue

Read the original documentation [here](https://sonner.emilkowal.ski/).

## Installation

```bash
npm install @shipwright-sh/sonner-vue
```

## Usage

```vue
<template>
  <div>
    <button @click="toast('Hello, world!')">Click me</button>
    
    <Toaster />
  </div>
</template>

<script setup lang="ts">
import "@shipwright-sh/sonner-vue/style.css";
import { toast, Toaster } from "@shipwright-sh/sonner-vue";
</script>
```

