<script setup lang="ts">
import source from '../../assets/contract-demo/basic.mmd?raw'

const artifactVersion = '3.0.0'
const contractSource = source.trim()
const encodedSource = encodeURIComponent(contractSource)

const props = withDefaults(defineProps<{
  demoId?: 'primary' | 'lazy'
  title?: string
  description?: string
}>(), {
  demoId: 'primary',
  title: 'Live Contract Demo',
  description: 'Rendered in this browser by the exact stable package artifact.',
})

const titleId = computed(() => `contract-demo-${props.demoId}-title`)
</script>

<template>
  <section
    class="contract-demo"
    :data-contract-demo="demoId"
    :aria-labelledby="titleId"
  >
    <div class="demo-heading">
      <div>
        <p class="demo-kicker">
          Contract Demo · live runtime
        </p>
        <h2 :id="titleId">
          {{ title }}
        </h2>
        <p>{{ description }}</p>
      </div>
      <span class="live-badge"><span aria-hidden="true" />Live</span>
    </div>
    <p
      class="artifact-disclosure"
      :data-artifact-version="artifactVersion"
    >
      <span>Exact stable artifact</span>
      <code>@barzhsieh/nuxt-content-mermaid@{{ artifactVersion }}</code>
    </p>
    <div data-contract-diagram>
      <Mermaid :code="encodedSource">
        <pre><code>{{ contractSource }}</code></pre>
      </Mermaid>
    </div>
    <details
      class="source-disclosure"
      open
    >
      <summary>Mermaid source</summary>
      <pre data-contract-source><code>{{ contractSource }}</code></pre>
    </details>
  </section>
</template>
