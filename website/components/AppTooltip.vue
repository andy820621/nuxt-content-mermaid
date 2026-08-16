<script setup lang="ts">
import type { TooltipContentProps } from 'reka-ui'
import {
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from 'reka-ui'

withDefaults(defineProps<{
  text: string
  side?: TooltipContentProps['side']
  sideOffset?: number
}>(), {
  side: 'bottom',
  sideOffset: 8,
})
</script>

<template>
  <TooltipProvider
    :delay-duration="80"
    :skip-delay-duration="200"
  >
    <TooltipRoot>
      <TooltipTrigger as-child>
        <slot />
      </TooltipTrigger>

      <TooltipPortal>
        <TooltipContent
          class="app-tooltip"
          :side="side"
          :side-offset="sideOffset"
        >
          <span role="tooltip">{{ text }}</span>
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </TooltipProvider>
</template>
