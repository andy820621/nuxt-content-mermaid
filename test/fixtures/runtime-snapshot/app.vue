<script setup lang="ts">
import { useNuxtApp, useRuntimeConfig } from '#app'
import { getRuntimeMermaidSnapshot } from '../../../src/runtime/runtime-snapshot'
import { identifySnapshot } from './snapshot-id'

const snapshot = getRuntimeMermaidSnapshot(useNuxtApp())
const snapshotId = identifySnapshot(snapshot)
const themeBeforeMutation = snapshot.theme?.light
const runtimeConfig = useRuntimeConfig()
const publicPayload = runtimeConfig.public.contentMermaid as {
  theme: { light: string }
}
publicPayload.theme.light = 'forest'
const themeAfterMutation = snapshot.theme?.light
const deeplyFrozen = Object.isFrozen(snapshot)
  && Object.isFrozen(snapshot.theme)
</script>

<template>
  <div id="runtime-snapshot">
    {{ snapshotId }}|{{ themeBeforeMutation }}|{{ themeAfterMutation }}|{{ deeplyFrozen }}
  </div>
</template>
