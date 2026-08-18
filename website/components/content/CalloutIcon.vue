<script setup lang="ts">
type CalloutVariant = 'info' | 'note' | 'tip' | 'warning' | 'danger'

const props = defineProps<{
  variant: CalloutVariant
}>()
</script>

<template>
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <template v-if="props.variant === 'info'">
      <circle
        cx="12"
        cy="12"
        r="8.75"
      />
      <path d="M12 10.5v5.25M12 7.75h.01" />
    </template>

    <template v-else-if="props.variant === 'note'">
      <path d="M6.75 4.5h7.5l3 3v12H6.75v-15Z" />
      <path d="M14.25 4.5v3h3M9.25 11h5.5M9.25 14.5h5.5" />
    </template>

    <template v-else-if="props.variant === 'tip'">
      <path d="M8.3 14.75a6 6 0 1 1 7.4 0c-.86.67-1.2 1.17-1.2 2.25h-5c0-1.08-.34-1.58-1.2-2.25Z" />
      <path d="M9.25 17h5.5M9.75 20h4.5" />
    </template>

    <template v-else-if="props.variant === 'warning'">
      <circle
        cx="12"
        cy="12"
        r="8.75"
      />
      <path d="M12 8.5v4.75M12 16.5h.01" />
    </template>

    <template v-else>
      <path d="m12 3.75 9 16.5H3l9-16.5Z" />
      <path d="M12 9v5M12 17h.01" />
    </template>
  </svg>
</template>
