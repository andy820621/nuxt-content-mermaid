<script setup lang="ts">
const colorMode = useColorMode()
const isColorReady = ref(false)
onMounted(() => {
  isColorReady.value = true
})
const activeTheme = computed(() =>
  isColorReady.value
    ? colorMode.value || colorMode.preference || 'light'
    : colorMode.preference || 'light',
)
const toggle = () => {
  colorMode.preference = activeTheme.value === 'dark' ? 'light' : 'dark'
}
</script>

<template>
  <NuxtLayout>
    <div class="app-shell">
      <header class="toolbar">
        <div class="mode-indicator">
          Current mode: <strong>{{ activeTheme }}</strong>
        </div>
        <button
          class="toggle-btn"
          type="button"
          @click="toggle"
        >
          Switch to {{ activeTheme === "dark" ? "light" : "dark" }}
        </button>
      </header>
      <main class="content-area">
        <NuxtPage />
      </main>
    </div>
  </NuxtLayout>
</template>

<style scoped>
:global(html, body) {
  min-height: 100%;
}
:global(body) {
  margin: 0;
  font-family:
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
  background-color: var(--body-bg);
  color: var(--body-fg);
  transition:
    background-color 0.25s ease,
    color 0.25s ease;
}
:global(html[data-theme="light"]) {
  --body-bg: #f8fafc;
  --body-fg: #0f172a;
}
:global(html[data-theme="dark"]) {
  --body-bg: #0f172a;
  --body-fg: #e2e8f0;
}

.app-shell {
  min-height: 100vh;
  padding: 2rem;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}
.mode-indicator strong {
  font-weight: 600;
}
.toggle-btn {
  border: none;
  border-radius: 999px;
  padding: 0.5rem 1.5rem;
  font-size: 0.9rem;
  background-color: #6366f1;
  color: #fff;
  cursor: pointer;
  transition: background-color 0.2s ease;
}
.toggle-btn:hover {
  background-color: #4f46e5;
}
.content-area {
  flex: 1;
  padding: 1.5rem;
  border-radius: 1rem;
  background-color: color-mix(in srgb, var(--body-bg) 85%, #ffffff);
  box-shadow: 0 10px 35px rgba(15, 23, 42, 0.15);
  transition: background-color 0.25s ease;
}
:global(html[data-theme="dark"]) .content-area {
  background-color: color-mix(in srgb, var(--body-bg) 65%, #000000);
  box-shadow: 0 10px 35px rgba(0, 0, 0, 0.4);
}
</style>
