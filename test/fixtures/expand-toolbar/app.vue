<script setup lang="ts">
import { computed, ref } from 'vue'

const diagramVersion = ref(0)
const code = computed(() => `graph TD;PRIMARY_${diagramVersion.value}-->B;B-->C;`)
const secondaryCode = 'graph TD;SECONDARY-->B;'
const customLabelCode = 'graph TD;CUSTOM_LABELS-->B;'
const encoded = computed(() => encodeURIComponent(code.value))
const encodedSecondary = computed(() => encodeURIComponent(secondaryCode))
const encodedCustomLabels = computed(() => encodeURIComponent(customLabelCode))
const showDiagram = ref(true)
const customLabels = {
  copy: '複製原始碼',
  copied: '已複製',
  copyFailed: '複製失敗',
  expand: '展開圖表',
  collapse: '收合圖表',
  minimize: '縮小圖表',
  enterFullscreen: '進入全螢幕',
  exitFullscreen: '離開全螢幕',
  zoomIn: '放大縮放',
  zoomOut: '縮小縮放',
  resetZoom: '重設縮放',
  download: '下載圖片',
  downloadSvg: '下載成 SVG',
  downloadPng: '下載成 PNG',
}
</script>

<template>
  <button
    id="update-diagram"
    type="button"
    @click="diagramVersion++"
  >
    Update diagram
  </button>
  <button
    id="unmount-diagram"
    type="button"
    @click="showDiagram = false"
  >
    Unmount diagram
  </button>
  <div
    v-if="showDiagram"
    id="diagram-root"
  >
    <Mermaid :code="encoded" />
  </div>
  <div id="secondary-root">
    <Mermaid :code="encodedSecondary" />
  </div>
  <div id="custom-label-root">
    <Mermaid
      :code="encodedCustomLabels"
      :toolbar="{ labels: customLabels }"
    />
  </div>
</template>
