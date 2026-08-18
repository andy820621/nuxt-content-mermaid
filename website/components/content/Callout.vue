<script setup lang="ts">
type CalloutVariant = 'info' | 'note' | 'tip' | 'warning' | 'danger'

const props = withDefaults(defineProps<{
  variant?: CalloutVariant
  title?: string
}>(), {
  variant: 'info',
})
</script>

<template>
  <aside
    class="callout"
    :data-variant="props.variant"
    role="note"
  >
    <div class="callout__content">
      <div
        v-if="props.title"
        class="callout__title"
      >
        <CalloutIcon
          class="callout__icon"
          :variant="props.variant"
        />
        <strong>{{ props.title }}</strong>
      </div>

      <div class="callout__body-container">
        <CalloutIcon
          v-if="!props.title"
          class="callout__icon"
          :variant="props.variant"
        />

        <div class="callout__body">
          <slot />
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.callout {
  --callout-color: var(--callout-info);
  --callout-body-color: color-mix(in oklab, var(--callout-color) 90%, transparent);
  --callout-background: color-mix(in oklab, var(--callout-color) 5%, var(--callout-neutral-surface));
  --callout-border: color-mix(in oklab, var(--callout-color) 16%, var(--border) 24%);
  --callout-code-background: color-mix(in oklab, var(--background) 78%, var(--surface-elevated));
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
  margin: 1.5rem 0 0.5rem;
  padding: 1rem;
  color: var(--callout-body-color);
  background: var(--callout-background);
  border: 1px solid var(--callout-border);
  border-radius: 0.25rem;
  overflow-wrap: anywhere;
}

.callout[data-variant='note'] {
  --callout-color: var(--callout-note);
  --callout-body-color: var(--callout-color);
}

.callout[data-variant='tip'] {
  --callout-color: var(--callout-tip);
  --callout-body-color: var(--callout-color);
}

.callout[data-variant='warning'] {
  --callout-color: var(--callout-warning);
  --callout-body-color: var(--callout-color);
}

.callout[data-variant='danger'] {
  --callout-color: var(--callout-danger);
  --callout-body-color: var(--callout-color);
}

.callout__content {
  width: 100%;
  min-width: 0;
}

.callout__title {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0 0 0.5rem;
  color: var(--callout-color);
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.25rem;
}

.callout__body-container {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: flex-start;
  gap: 0.5rem;
}

.callout__icon {
  flex: 0 0 auto;
  width: 1rem;
  height: 1rem;
  margin-top: 0.125rem;
  color: var(--callout-color);
}

.callout__title .callout__icon {
  margin-top: 0;
}

.callout__body {
  flex: 1;
  min-width: 0;
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.25rem;
}

.callout__body :deep(p),
.callout__body :deep(ul),
.callout__body :deep(ol),
.callout__body :deep(li) {
  font: inherit;
}

.callout__body :deep(> :first-child) {
  margin-top: 0;
}

.callout__body :deep(> :last-child) {
  margin-bottom: 0;
}

.callout__body :deep(a) {
  color: var(--callout-color);
}

.callout__body :deep(:not(pre) > code) {
  padding: 0.125rem 0.25rem;
  background: var(--callout-code-background);
  border-radius: 0.25rem;
  font-size: 0.875em;
  letter-spacing: normal;
}

.callout :deep(pre) {
  max-width: 100%;
  margin: 0.5rem 0 0;
  padding: 0.75rem;
  background: var(--callout-code-background);
  border: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
  border-radius: 0.25rem;
  overflow: auto;
  white-space: pre;
  overflow-wrap: normal;
}

.callout :deep(pre code) {
  display: inline;
  padding: 0;
  background: transparent;
  border-radius: 0;
  font-size: inherit;
  white-space: inherit;
}

@media (max-width: 640px) {
  .callout {
    padding: 0.875rem;
  }
}
</style>
