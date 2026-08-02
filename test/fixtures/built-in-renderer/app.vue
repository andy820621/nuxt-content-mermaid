<script setup lang="ts">
import { computed, ref } from 'vue'
import type { MermaidConfig } from 'mermaid'

const primaryVersion = ref(0)
const primaryCode = ref('graph TD;INITIAL-->DONE')
const blockerVersion = ref(0)
const showBlocker = ref(false)
const skippedCode = ref('graph TD;SKIPPED-->DONE')
const showSkipped = ref(false)
const showStrict = ref(false)
const showSandbox = ref(false)
const strictConfig: MermaidConfig = { securityLevel: 'strict' }
const sandboxConfig: MermaidConfig = { securityLevel: 'sandbox' }

const encodedPrimary = computed(() => encodeURIComponent(primaryCode.value))
const encodedBlocker = computed(() => encodeURIComponent(`graph TD;BLOCKER_${blockerVersion.value}-->DONE`))
const encodedSkipped = computed(() => encodeURIComponent(skippedCode.value))

function failPrimary() {
  primaryCode.value = 'graph TD;__FAIL__'
}

function recoverPrimary() {
  primaryCode.value = 'graph TD;RECOVERED-->DONE'
}

function queuePrimary() {
  primaryVersion.value++
  primaryCode.value = `graph TD;QUEUED_${primaryVersion.value}-->DONE`
}

function clearPrimary() {
  primaryCode.value = ''
}

function mountBlocker() {
  showBlocker.value = true
}

function updateBlocker() {
  blockerVersion.value++
  showBlocker.value = true
}

function mountSkipped() {
  showSkipped.value = true
}

function clearSkipped() {
  skippedCode.value = ''
}

function mountStrict() {
  showStrict.value = true
}

function mountSandbox() {
  showSandbox.value = true
}
</script>

<template>
  <main>
    <div class="controls">
      <button
        id="primary-fail"
        type="button"
        @click="failPrimary"
      >
        Fail primary
      </button>
      <button
        id="primary-recover"
        type="button"
        @click="recoverPrimary"
      >
        Recover primary
      </button>
      <button
        id="primary-queue"
        type="button"
        @click="queuePrimary"
      >
        Queue primary
      </button>
      <button
        id="primary-clear"
        type="button"
        @click="clearPrimary"
      >
        Clear primary
      </button>
      <button
        id="blocker-mount"
        type="button"
        @click="mountBlocker"
      >
        Mount blocker
      </button>
      <button
        id="blocker-update"
        type="button"
        @click="updateBlocker"
      >
        Update blocker
      </button>
      <button
        id="skipped-mount"
        type="button"
        @click="mountSkipped"
      >
        Mount skipped
      </button>
      <button
        id="skipped-clear"
        type="button"
        @click="clearSkipped"
      >
        Clear skipped
      </button>
      <button
        id="strict-mount"
        type="button"
        @click="mountStrict"
      >
        Mount strict
      </button>
      <button
        id="sandbox-mount"
        type="button"
        @click="mountSandbox"
      >
        Mount sandbox
      </button>
    </div>

    <section id="primary">
      <Mermaid :code="encodedPrimary" />
    </section>

    <section
      v-if="showBlocker"
      id="blocker"
    >
      <Mermaid :code="encodedBlocker" />
    </section>

    <section
      v-if="showSkipped"
      id="skipped"
    >
      <Mermaid :code="encodedSkipped" />
    </section>

    <section
      v-if="showStrict"
      id="strict"
    >
      <Mermaid
        :code="encodeURIComponent('graph TD;STRICT-->DONE')"
        :config="strictConfig"
      />
    </section>

    <section
      v-if="showSandbox"
      id="sandbox"
    >
      <Mermaid
        :code="encodeURIComponent('graph TD;SANDBOX-->DONE')"
        :config="sandboxConfig"
      />
    </section>
  </main>
</template>
