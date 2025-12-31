<script setup lang="ts">
withDefaults(defineProps<{ size?: number | string }>(), {
  size: 20,
})
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    class="ncm-icon-animate"
  ><g
    fill="none"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-width="2"
  ><path
    class="ncm-icon-ring"
    stroke-dasharray="64"
    stroke-dashoffset="64"
    d="M3 12c0 -4.97 4.03 -9 9 -9c4.97 0 9 4.03 9 9c0 4.97 -4.03 9 -9 9c-4.97 0 -9 -4.03 -9 -9Z"
  ><animate
    fill="freeze"
    attributeName="stroke-dashoffset"
    dur="0.6s"
    values="64;0"
  /></path><path
    class="ncm-icon-line"
    stroke-dasharray="12"
    stroke-dashoffset="12"
    d="M7 12h10"
  ><animate
    fill="freeze"
    attributeName="stroke-dashoffset"
    begin="0.6s"
    dur="0.2s"
    values="12;0"
  /></path><path
    class="ncm-icon-line"
    stroke-dasharray="12"
    stroke-dashoffset="12"
    d="M12 7v10"
  ><animate
    fill="freeze"
    attributeName="stroke-dashoffset"
    begin="0.8s"
    dur="0.2s"
    values="12;0"
  /></path></g></svg>
</template>

<style scoped>
@media (prefers-reduced-motion: reduce) {
  .ncm-icon-animate .ncm-icon-ring,
  .ncm-icon-animate .ncm-icon-line {
    stroke-dashoffset: 0;
  }

  .ncm-icon-animate animate {
    display: none;
  }
}
</style>
