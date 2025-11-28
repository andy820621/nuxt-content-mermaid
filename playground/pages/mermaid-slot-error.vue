<template>
  <div>
    <h1>Mermaid Error Slot Demo</h1>

    <Mermaid>
      <pre>
        <code>
        graph TD
        A --> B
        B --> C
        C --> D
        D --> E
        E --> G
        C --> G
        G --> A
        </code>
      </pre>

      <template #error="{ error, source }">
        <div class="mermaid-error">
          <p>Mermaid rendering failed: {{ error instanceof Error ? error.message : String(error) }}</p>

          <pre>{{ error }}</pre>

          <details>
            <summary>View original mermaid definition</summary>
            <pre><code>{{ source }}</code></pre>
          </details>
        </div>
      </template>
    </Mermaid>
  </div>
</template>

<style scoped>
.mermaid-error {
  color: #b91c1c;
  font-size: 14px;
  line-height: 1.5;
}
pre, code {
  opacity: 1 !important;
  pointer-events: auto !important;
  user-select: text !important;
  max-height: initial !important;
  margin: auto !important;
  overflow: auto !important;
}
</style>
