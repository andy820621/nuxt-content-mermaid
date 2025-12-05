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
    "Space Grotesk",
    "Inter",
    "Segoe UI",
    system-ui,
    -apple-system,
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
  --surface: #ffffff;
  --surface-strong: #f8fafc;
  --border: #e2e8f0;
  --border-strong: #cbd5e1;
  --accent: #0ea5e9;
  --accent-strong: #0284c7;
  --on-accent: #0b1220;
  --shadow-soft: 0 12px 30px -18px rgba(15, 23, 42, 0.25);
}
:global(html[data-theme="dark"]) {
  --body-bg: #0f172a;
  --body-fg: #e2e8f0;
  --surface: #0b1220;
  --surface-strong: #0c1524;
  --border: #1f2937;
  --border-strong: #334155;
  --accent: #38bdf8;
  --accent-strong: #0ea5e9;
  --on-accent: #0b1220;
  --shadow-soft: 0 14px 38px -14px rgba(0, 0, 0, 0.65);
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
  color: var(--body-fg);
}
.mode-indicator strong {
  font-weight: 600;
}
.toggle-btn {
  border: 1px solid transparent;
  border-radius: 999px;
  padding: 0.5rem 1.5rem;
  font-size: 0.9rem;
  background-color: var(--accent);
  color: var(--on-accent);
  cursor: pointer;
  transition: background-color 0.2s ease, border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
  box-shadow: var(--shadow-soft);
}
.toggle-btn:hover {
  background-color: var(--accent-strong);
  border-color: var(--border-strong);
  transform: translateY(-1px);
}
.content-area {
  flex: 1;
  padding: 1.5rem;
  border-radius: 1rem;
  background-color: var(--surface);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-soft);
  transition:
  background-color 0.25s ease,
  border-color 0.25s ease,
  box-shadow 0.25s ease;
}
:global(html[data-theme="dark"] .content-area) {
  border-color: var(--border-strong);
  background-color: color-mix(in srgb, var(--surface) 81%, #ffffff 24%);
}
</style>
