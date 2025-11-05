<template>
  <div style="padding: 2rem; font-family: sans-serif">
    <h1>Sonner for Vue</h1>
    <div style="display: flex; gap: 1rem; flex-wrap: wrap">
      <button @click="toast('Hello, world!')">
        Default Toast
      </button>
      <button @click="toast.success('Success!')">
        Success Toast
      </button>
      <button @click="toast.error('Error!')">
        Error Toast
      </button>
      <button @click="toast.info('Info!')">
        Info Toast
      </button>
      <button @click="toast.warning('Warning!')">
        Warning Toast
      </button>
      <button @click="toast.loading('Loading...')">
        Loading Toast
      </button>
      <button
        @click="
          toast('Event has been created', {
            description: 'Monday, January 3rd at 6:00pm',
            action: {
              label: 'Undo',
              onClick: () => console.log('Undo'),
            },
          })
        "
      >
        With Action
      </button>
      <button @click="handlePromise">
        Promise
      </button>
    </div>

    <Toaster />
  </div>
</template>

<script setup lang="ts">
import { toast, Toaster } from "@shipwright-sh/sonner-vue";

const handlePromise = () => {
  const promise = () =>
    new Promise<{ name: string }>((resolve) =>
      setTimeout(
        () => resolve({ name: "Sonner" }),
        2000
      )
    );

  toast.promise(promise, {
    loading: "Loading...",
    success: (data: { name: string }) => `${data.name} loaded!`,
    error: "Error loading",
  });
};
</script>

