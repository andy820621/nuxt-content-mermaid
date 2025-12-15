<template>
  <svg
    class="ncm-spinner"
    viewBox="0 0 50 50"
  >
    <circle
      class="ncm-spinner__path"
      cx="25"
      cy="25"
      r="20"
      fill="none"
      stroke-width="5"
      stroke="rgb(197, 197, 197)"
      stroke-linecap="round"
      stroke-dasharray="1 150"
      stroke-dashoffset="0"
    />
  </svg>
</template>

<script>
export default {
  name: 'Spinner',
}
</script>

<style scoped>
.ncm-spinner {
  --radius: 20px;

  animation: rotate 2s linear infinite;
  transform-origin: 50% 50%;
  z-index: 2;
  position: absolute;
  top: 50%;
  left: 50%;
  margin: calc(var(--radius) * -1) 0 0 calc(var(--radius) * -1);
  width: calc(var(--radius) * 2);
  height: calc(var(--radius) * 2);
}
.ncm-spinner__path {
  animation: dash 1.5s ease-in-out infinite;
}
@keyframes rotate {
  100% {
    transform: rotate(360deg);
  }
}
@keyframes dash {
  0% {
    stroke-dasharray: 1, 150;
    stroke-dashoffset: 0;
  }
  50% {
    stroke-dasharray: 90, 150;
    stroke-dashoffset: -35;
  }
  100% {
    stroke-dasharray: 90, 150;
    stroke-dashoffset: -124;
  }
}
</style>
