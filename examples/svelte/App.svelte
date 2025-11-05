<script lang="ts">
  let count = 0;

  function increment() {
    count += 1;
  }
</script>

<div style="padding: 2rem; font-family: sans-serif">
  <h1>Sonner for Svelte</h1>
  <div style="display: flex; gap: 1rem; flex-wrap: wrap; margin-top: 1rem;">
    <button onclick={increment}>
      Count: {count}
    </button>
  </div>
  <p style="margin-top: 1rem; color: #666;">
    This is a basic Svelte app. Sonner integration coming soon!
  </p>
</div>

<style>
  button {
    padding: 0.5rem 1rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    background: white;
    cursor: pointer;
    font-size: 1rem;
  }
  
  button:hover {
    background: #f0f0f0;
  }
</style>

