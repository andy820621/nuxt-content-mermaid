<script setup lang="ts">
import AppTooltip from './AppTooltip.vue'

const { activeTheme, isTransitioning, toggle } = useWebsiteTheme()
const { t } = useI18n()

const nextThemeLabel = computed(() => activeTheme.value === 'dark'
  ? t('actions.switchToLight')
  : t('actions.switchToDark'))

function toggleTheme(event: MouseEvent) {
  void toggle(event)
}
</script>

<template>
  <ColorScheme>
    <template #placeholder>
      <span
        class="theme-toggle-placeholder"
        aria-hidden="true"
      />
    </template>

    <AppTooltip :text="nextThemeLabel">
      <button
        class="icon-button theme-toggle"
        type="button"
        :aria-label="nextThemeLabel"
        :aria-busy="isTransitioning || undefined"
        :aria-pressed="activeTheme === 'dark'"
        :disabled="isTransitioning"
        :title="nextThemeLabel"
        @click="toggleTheme"
      >
        <span
          class="theme-toggle__icon"
          :data-theme-icon="activeTheme === 'dark' ? 'moon' : 'sun'"
        >
          <Icon
            aria-hidden="true"
            :name="activeTheme === 'dark' ? 'line-md:moon' : 'line-md:sunny-outline'"
          />
        </span>
      </button>
    </AppTooltip>
  </ColorScheme>
</template>
