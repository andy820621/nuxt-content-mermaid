<script setup lang="ts">
import source from '../../assets/contract-demo/basic.mmd?raw'

const artifactVersion = '3.0.0'
const contractSource = source.trim()
const encodedSource = encodeURIComponent(contractSource)
</script>

<template>
  <section aria-labelledby="contract-demo-title">
    <h2 id="contract-demo-title">
      Contract Demo
    </h2>
    <p :data-artifact-version="artifactVersion">
      Rendered by @barzhsieh/nuxt-content-mermaid@{{ artifactVersion }}
    </p>
    <div data-contract-diagram>
      <Mermaid :code="encodedSource">
        <pre><code>{{ contractSource }}</code></pre>
      </Mermaid>
    </div>
    <details open>
      <summary>Mermaid source</summary>
      <pre data-contract-source><code>{{ contractSource }}</code></pre>
    </details>
  </section>
</template>
