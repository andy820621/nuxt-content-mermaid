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
    <div
      id="playground-app"
      class="app-shell"
    >
      <header class="navbar">
        <div class="container navbar-content">
          <div class="brand">
            <span class="brand-text">Mermaid Playground</span>
          </div>

          <div class="nav-controls">
            <div class="mode-indicator">
              <span>Mode: <strong>{{ activeTheme }}</strong></span>
            </div>
            <button
              class="theme-toggle"
              type="button"
              :aria-label="'Switch to ' + (activeTheme === 'dark' ? 'light' : 'dark') + ' mode'"
              @click="toggle"
            >
              <span v-if="activeTheme === 'dark'">🌙</span>
              <span v-else>☀️</span>
            </button>
          </div>
        </div>
      </header>

      <main class="main-content">
        <div class="container">
          <NuxtPage />
        </div>
      </main>

      <footer class="footer">
        <div class="container">
          <p class="footer-text">
            Nuxt Content + Mermaid Module
          </p>
        </div>
      </footer>
    </div>
  </NuxtLayout>
</template>

<style scoped>
/* Global Resets & Typography */
:global(html, body) {
  min-height: 100%;
  margin: 0;
  padding: 0;
}

:global(body) {
  margin: 0;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  background-color: var(--bg-body);
  color: var(--text-primary);
  transition: background-color 0.3s ease, color 0.3s ease;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Theme Variables */
:global(html[data-theme="light"]) {
  --bg-surface: #f1f5f9;
  --bg-body: color-mix(in srgb, #516d9b 8%, var(--bg-surface) 24%);;
  --bg-glass: rgba(255, 255, 255, 0.8);
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --border-color: #e2e8f0;
  --primary-color: #3b82f6;
  --primary-hover: #2563eb;
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

:global(html[data-theme="dark"]) {
  --bg-body: color-mix(in srgb, var(--bg-surface) 95%, #ffffff 2.4%);;
  --bg-surface: #1e293b;
  --bg-glass: rgba(2, 6, 23, 0.8);
  --text-primary: #f8fafc;
  --text-secondary: #94a3b8;
  --border-color: #334155;
  --primary-color: #60a5fa;
  --primary-hover: #93c5fd;
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2);
}

/* Layout */
.app-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.container {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1.5rem;
}

/* Navbar */
.navbar {
  position: sticky;
  top: 0;
  z-index: 50;
  height: 4rem;
  background-color: var(--bg-glass);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border-color);
  transition: background-color 0.3s ease, border-color 0.3s ease;
}

.navbar-content {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.brand-text {
  font-size: 1.25rem;
  font-weight: 700;
  background: linear-gradient(135deg, var(--primary-color), var(--primary-hover));
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  letter-spacing: -0.025em;
}

.nav-controls {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.mode-indicator {
  font-size: 0.875rem;
  color: var(--text-secondary);
  display: none; /* Hidden on mobile, shown on larger screens if needed */
}

@media (min-width: 640px) {
  .mode-indicator {
    display: block;
  }
}

/* Theme Toggle */
.theme-toggle {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 1.25rem;
}

.theme-toggle:hover {
  background-color: var(--bg-surface);
  border-color: var(--primary-color);
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.theme-toggle:active {
  transform: translateY(0);
}

/* Main Content */
.main-content {
  flex: 1;
  padding: 2rem 0;
}

/* Footer */
.footer {
  padding: 2rem 0;
  border-top: 1px solid var(--border-color);
  margin-top: auto;
  background-color: var(--bg-surface);
}

.footer-text {
  text-align: center;
  color: var(--text-secondary);
  font-size: 0.875rem;
  margin: 0;
}
</style>
