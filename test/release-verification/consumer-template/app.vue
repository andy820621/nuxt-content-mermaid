<script setup lang="ts">
const { data: page } = await useAsyncData('release-verification-page', () => {
  return queryCollection('content').path('/').first()
})
</script>

<template>
  <main data-release-mermaid-root>
    <ContentRenderer
      v-if="page"
      :value="page"
    />
    <p v-else>
      Release verification content was not found.
    </p>
  </main>
</template>
