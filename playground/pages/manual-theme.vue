<script setup lang="ts">
import { useMermaidTheme } from '../../src/runtime/composables/useMermaidTheme'

const { setMermaidTheme, currentTheme, resetMermaidTheme } = useMermaidTheme()

const availableThemes = [
  { label: '☀️ Light', value: 'light' },
  { label: '🌙 Dark', value: 'dark' },
  { label: '🌲 Forest', value: 'forest' },
  { label: '😐 Neutral', value: 'neutral' },
  { label: '💄 Base', value: 'base' },
]

function changeTheme(theme: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setMermaidTheme(theme as any)
}

function reset() {
  resetMermaidTheme()
}

// Diagram Definitions
const flowchartCode = `
flowchart TD
    A[Start] --> B{Is it working?}
    B -- Yes --> C[Great!]
    B -- No --> D[Debug]
    D --> B
`

const sequenceCode = `
sequenceDiagram
    participant Alice
    participant Bob
    Alice->>Bob: Hello Bob, how are you?
    Bob-->>Alice: I am good thanks!
`

const classCode = `
classDiagram
    class Animal {
        +String name
        +eat()
    }
    class Duck {
        +quack()
    }
    Animal <|-- Duck
`

const erCode = `
erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE-ITEM : contains
    CUSTOMER }|..|{ DELIVERY-ADDRESS : uses
`

const ganttCode = `
gantt
    title Project Schedule
    dateFormat  YYYY-MM-DD
    section Design
    Research           :done,    des1, 2024-01-01, 2024-01-05
    Prototyping        :active,  des2, 2024-01-06, 3d
    section Dev
    Implementation     :         dev1, after des2, 5d
    Testing            :         test1, after dev1, 5d
`
</script>

<template>
  <div class="page-container mermaid-page mermaid-page--catalog">
    <!-- Navigation -->
    <nav class="nav-bar">
      <NuxtLink
        to="/"
        class="btn btn--secondary"
      >
        <span class="icon">←</span> Back to Home
      </NuxtLink>
    </nav>

    <!-- Hero Section -->
    <header class="hero">
      <div class="hero__content">
        <p class="hero__eyebrow">
          Feature Demo
        </p>
        <h1 class="hero__title">
          Manual Theme Control
        </h1>
        <p class="hero__description">
          Demonstrates real-time Mermaid theme switching without relying on @nuxtjs/color-mode.
          Click any theme button to see all diagrams update instantly.
        </p>
      </div>
      <div class="hero__actions">
        <!-- Status Indicator -->
        <span class="tag">
          Current: {{ currentTheme || 'auto (system)' }}
        </span>
      </div>
    </header>

    <!-- Controls -->
    <nav
      class="filters"
      aria-label="Theme controls"
    >
      <button
        v-for="theme in availableThemes"
        :key="theme.value"
        type="button"
        class="filter-chip"
        :class="{ 'filter-chip--active': currentTheme === theme.value }"
        @click="changeTheme(theme.value)"
      >
        {{ theme.label }}
      </button>

      <button
        type="button"
        class="filter-chip"
        :class="{ 'filter-chip--active': currentTheme === null }"
        @click="reset"
      >
        🔄 Auto / Reset
      </button>
    </nav>

    <!-- Diagram Grid -->
    <main
      class="grid"
      style="margin-bottom: 2rem;"
    >
      <!-- Flowchart -->
      <div class="card">
        <div class="card__header">
          <span class="card__type">Flowchart</span>
        </div>
        <h2 class="card__title">
          Basic Flow
        </h2>
        <div class="card__footer">
          <Mermaid :code="flowchartCode" />
        </div>
      </div>

      <!-- Sequence -->
      <div class="card">
        <div class="card__header">
          <span class="card__type">Sequence</span>
        </div>
        <h2 class="card__title">
          Interaction
        </h2>
        <div class="card__footer">
          <Mermaid :code="sequenceCode" />
        </div>
      </div>

      <!-- Class -->
      <div class="card">
        <div class="card__header">
          <span class="card__type">Class Diagram</span>
        </div>
        <h2 class="card__title">
          Structure
        </h2>
        <div class="card__footer">
          <Mermaid :code="classCode" />
        </div>
      </div>

      <!-- ER -->
      <div class="card">
        <div class="card__header">
          <span class="card__type">ER Diagram</span>
        </div>
        <h2 class="card__title">
          Relations
        </h2>
        <div class="card__footer">
          <Mermaid :code="erCode" />
        </div>
      </div>

      <!-- Gantt -->
      <div class="card card--wide">
        <div class="card__header">
          <span class="card__type">Gantt</span>
        </div>
        <h2 class="card__title">
          Timeline
        </h2>
        <div class="card__footer">
          <Mermaid :code="ganttCode" />
        </div>
      </div>
    </main>

    <!-- Info / Meta Panel -->
    <section class="meta-panel">
      <div class="meta-item">
        <h3 class="meta-label">
          Usage Example
        </h3>
        <div class="config-block">
          <pre><code>&lt;script setup&gt;
import { useMermaidTheme } from '@barzhsieh/nuxt-content-mermaid'

const { setMermaidTheme, currentTheme, resetMermaidTheme } = useMermaidTheme()

// Change theme
function toggleTheme() {
  const newTheme = currentTheme.value === 'dark' ? 'light' : 'dark'
  setMermaidTheme(newTheme)
}

// Reset to auto mode
function reset() {
  resetMermaidTheme()
}
&lt;/script&gt;</code></pre>
        </div>
      </div>

      <div class="meta-item">
        <h3 class="meta-label">
          Key Features
        </h3>
        <ul class="meta-notes">
          <li>🎯 <strong>No Dependencies:</strong> Works independently of @nuxtjs/color-mode</li>
          <li>⚡ <strong>Instant Updates:</strong> All diagrams update in real-time when theme changes</li>
          <li>🔄 <strong>Flexible Modes:</strong> Support for 'light', 'dark', and full Mermaid theme names</li>
          <li>📦 <strong>Easy Integration:</strong> Simple API with reactive state management</li>
        </ul>
      </div>
    </section>
  </div>
</template>

<style scoped>
@media (min-width: 1024px) {
  .card--wide {
    grid-column: span 2;
  }
}
</style>
