<script setup lang="ts">
import { onErrorCaptured, ref, shallowRef } from 'vue'
import type { MermaidConfig } from 'mermaid'
import type { PageMermaidConfig } from '../../src/types/config'

const conflictPageConfig = {
  theme: 'forest',
} satisfies PageMermaidConfig

const directConfig = {
  theme: 'dark',
} satisfies MermaidConfig

const recoveryPageConfig = shallowRef<PageMermaidConfig>()
const recoveryDirectConfig = shallowRef<MermaidConfig>(directConfig)
const sourceConflictCount = ref(0)
const showSnapshotAfterMutation = ref(false)

const runtimeTransport = useRuntimeConfig().public.contentMermaid as {
  toolbar?: { title?: string }
}
const runtimeTransportValue = ref(runtimeTransport.toolbar?.title ?? 'not configured')

onErrorCaptured((error) => {
  if ((error as { name?: string }).name === 'MermaidComponentConfigurationError') {
    sourceConflictCount.value += 1
    return false
  }
})

function mutateRuntimeTransport() {
  runtimeTransport.toolbar ??= {}
  runtimeTransport.toolbar.title = 'changed after startup'
  runtimeTransportValue.value = runtimeTransport.toolbar.title
}

function enterSourceConflict() {
  recoveryPageConfig.value = conflictPageConfig
}

function recoverSourceConflict() {
  recoveryPageConfig.value = undefined
}
</script>

<template>
  <main class="page-container mermaid-page">
    <header class="hero">
      <div class="hero__content">
        <p class="hero__eyebrow">
          V3 migration playground
        </p>
        <h1 class="hero__title">
          Public configuration paths
        </h1>
        <p class="hero__description">
          Each example uses the v3 contract without reviving the removed alias or treating public runtime config as a live control plane.
        </p>
      </div>
      <div class="hero__actions">
        <NuxtLink
          to="/"
          class="btn btn--secondary"
        >
          <span class="icon">←</span> Back to Home
        </NuxtLink>
      </div>
    </header>

    <section class="meta-panel">
      <div class="meta-item">
        <h2 class="meta-label">
          Page Mermaid Config
        </h2>
        <p>
          Content-generated Markdown receives pure-data page configuration from frontmatter through the Markdown Diagram Protocol.
        </p>
        <NuxtLink
          id="view-content-page-config"
          to="/migration-page-config"
          class="btn btn--secondary"
        >
          Open the Content-generated Page Config example
        </NuxtLink>
      </div>

      <div class="meta-item">
        <h2 class="meta-label">
          Direct Mermaid Config
        </h2>
        <p>
          Application code can pass full Mermaid capability through <code>config</code>; do not combine it with <code>pageConfig</code>.
        </p>
        <Mermaid
          id="direct-config-example"
          code="flowchart%20LR%3B%20DIRECT_CONFIG--%3EDARK"
          :config="directConfig"
          :toolbar="{ title: 'Direct Mermaid Config' }"
        />
      </div>

      <div class="meta-item">
        <h2 class="meta-label">
          Runtime Mermaid Snapshot
        </h2>
        <p>
          The public transport now says: <output id="runtime-transport-value">{{ runtimeTransportValue }}</output>.
          Mounting another diagram still uses the snapshot made during application initialization.
        </p>
        <button
          id="mutate-runtime-transport"
          type="button"
          class="btn btn--secondary"
          @click="mutateRuntimeTransport"
        >
          Mutate public runtime transport
        </button>
        <button
          id="mount-after-runtime-mutation"
          type="button"
          class="btn btn--secondary"
          @click="showSnapshotAfterMutation = true"
        >
          Mount another diagram
        </button>
        <Mermaid
          v-if="showSnapshotAfterMutation"
          id="snapshot-after-mutation"
          code="flowchart%20LR%3B%20SNAPSHOT--%3EPRESERVED"
        />
      </div>

      <div class="meta-item">
        <h2 class="meta-label">
          Source conflict recovery
        </h2>
        <p>
          Supplying both sources is one component configuration conflict. Removing <code>pageConfig</code> returns to the direct source and schedules one latest recovery render.
        </p>
        <button
          id="enter-source-conflict"
          type="button"
          class="btn btn--secondary"
          @click="enterSourceConflict"
        >
          Enter source conflict
        </button>
        <button
          id="recover-source-conflict"
          type="button"
          class="btn btn--secondary"
          @click="recoverSourceConflict"
        >
          Recover with Direct Mermaid Config
        </button>
        <p>
          Captured conflict episodes: <output id="source-conflict-count">{{ sourceConflictCount }}</output>
        </p>
        <Mermaid
          id="conflict-recovery-example"
          code="flowchart%20LR%3B%20CONFLICT--%3ERECOVERED"
          :page-config="recoveryPageConfig"
          :config="recoveryDirectConfig"
          :toolbar="{ title: 'Direct Mermaid Config' }"
        />
      </div>
    </section>
  </main>
</template>
