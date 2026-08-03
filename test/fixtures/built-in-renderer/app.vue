<script setup lang="ts">
import { useAsyncData } from '#app'
import { computed, onErrorCaptured, reactive, ref, resolveComponent, shallowRef } from 'vue'
import type { MermaidConfig } from 'mermaid'
import type { PageMermaidConfig } from '../../../src/types/config'

type MarkdownPage = {
  path: string
  config?: PageMermaidConfig
  body: unknown
}

declare const queryCollection: (collection: 'content') => {
  path: (path: string) => {
    select: (...fields: string[]) => {
      first: () => Promise<MarkdownPage | null>
    }
  }
}

const primaryVersion = ref(0)
const primaryCode = ref('graph TD;INITIAL-->DONE')
const blockerVersion = ref(0)
const showBlocker = ref(false)
const skippedCode = ref('graph TD;SKIPPED-->DONE')
const showSkipped = ref(false)
const showStrict = ref(false)
const showSandbox = ref(false)
const showPageConfig = ref(false)
const showMarkdownPageConfig = ref(false)
const showConflict = ref(false)
const showReactiveConflict = ref(false)
const componentErrorFingerprint = ref<{ name?: string, code?: string } | null>(null)
const strictConfig: MermaidConfig = { securityLevel: 'strict' }
const sandboxConfig: MermaidConfig = { securityLevel: 'sandbox' }
const pageConfig = reactive({
  theme: 'forest' as const,
  unknownMermaidExtension: { enabled: true },
})
const pageConfigSource = shallowRef<PageMermaidConfig | undefined>(pageConfig)
const conflictPageConfig = { theme: 'forest' }
const conflictDirectConfig: MermaidConfig = { theme: 'dark' }
const reactiveConflictPageConfig = { theme: 'forest' } as const
const reactiveConflictDirectConfig = shallowRef<MermaidConfig>()
const reactiveConflictCode = ref('graph TD;REACTIVE_CONFLICT-->LEGAL')
const MermaidComponent = resolveComponent('Mermaid')
const { data: markdownPage } = await useAsyncData('markdown-page-config', () =>
  queryCollection('content').path('/markdown-page-config').select('path', 'config', 'body').first(),
)

onErrorCaptured((error) => {
  const fingerprint = error as { name?: string, code?: string }
  componentErrorFingerprint.value = {
    name: fingerprint.name,
    code: fingerprint.code,
  }
  return false
})

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

function mountPageConfig() {
  showPageConfig.value = true
}

function mountMarkdownPageConfig() {
  showMarkdownPageConfig.value = true
}

function invalidatePageConfig() {
  const invalidPageConfig = pageConfig as unknown as { theme: null }
  invalidPageConfig.theme = null
}

function removePageConfig() {
  pageConfigSource.value = undefined
}

function mountConflict() {
  showConflict.value = true
}

function mountReactiveConflict() {
  showReactiveConflict.value = true
}

function enterReactiveConflict() {
  reactiveConflictDirectConfig.value = { theme: 'dark' }
}

function updateReactiveConflictCode() {
  reactiveConflictCode.value = 'graph TD;REACTIVE_CONFLICT-->UPDATED'
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
      <button
        id="conflict-mount"
        type="button"
        @click="mountConflict"
      >
        Mount conflict
      </button>
      <button
        id="page-config-mount"
        type="button"
        @click="mountPageConfig"
      >
        Mount page config
      </button>
      <button
        id="markdown-page-config-mount"
        type="button"
        @click="mountMarkdownPageConfig"
      >
        Mount Markdown page config
      </button>
      <button
        id="page-config-invalidate"
        type="button"
        @click="invalidatePageConfig"
      >
        Invalidate page config
      </button>
      <button
        id="page-config-remove"
        type="button"
        @click="removePageConfig"
      >
        Remove page config
      </button>
      <button
        id="reactive-conflict-mount"
        type="button"
        @click="mountReactiveConflict"
      >
        Mount reactive conflict
      </button>
      <button
        id="reactive-conflict-enter"
        type="button"
        @click="enterReactiveConflict"
      >
        Enter reactive conflict
      </button>
      <button
        id="reactive-conflict-update-code"
        type="button"
        @click="updateReactiveConflictCode"
      >
        Update reactive conflict code
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

    <section
      v-if="showConflict"
      id="conflict"
    >
      <component
        :is="MermaidComponent"
        :code="encodeURIComponent('graph TD;CONFLICT-->DONE')"
        :page-config="conflictPageConfig"
        :config="conflictDirectConfig"
      />
    </section>

    <section
      v-if="showPageConfig"
      id="page-config"
    >
      <Mermaid
        :code="encodeURIComponent('graph TD;PAGE-->DONE')"
        :page-config="pageConfigSource"
      />
    </section>

    <section
      v-if="showMarkdownPageConfig"
      id="markdown-page-config"
    >
      <ContentRenderer
        v-if="markdownPage"
        :value="markdownPage"
      />
    </section>

    <section
      v-if="showReactiveConflict"
      id="reactive-conflict"
    >
      <component
        :is="MermaidComponent"
        :code="encodeURIComponent(reactiveConflictCode)"
        :page-config="reactiveConflictPageConfig"
        :config="reactiveConflictDirectConfig"
      />
    </section>

    <output
      v-if="componentErrorFingerprint"
      id="component-error"
      :data-name="componentErrorFingerprint.name"
      :data-code="componentErrorFingerprint.code"
    />
    <output
      id="markdown-page-status"
      :data-loaded="String(Boolean(markdownPage))"
      :data-path="markdownPage?.path"
    />
  </main>
</template>
