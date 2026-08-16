<script setup lang="ts">
import type { SupportedLocale } from '~/types/i18n'
import AppTooltip from './AppTooltip.vue'

const { locale, t } = useI18n()
const switchLocalePath = useSwitchLocalePath()

const nextLocale = computed<SupportedLocale>(() => locale.value === 'en' ? 'zh' : 'en')
const nextLocaleLabel = computed(() => nextLocale.value === 'zh'
  ? t('actions.switchToChinese')
  : t('actions.switchToEnglish'))
</script>

<template>
  <AppTooltip :text="nextLocaleLabel">
    <NuxtLink
      class="icon-button locale-switcher"
      :to="switchLocalePath(nextLocale)"
      :aria-label="nextLocaleLabel"
      :title="nextLocaleLabel"
    >
      <Icon
        aria-hidden="true"
        name="material-symbols-light:language"
      />
      <span>{{ nextLocale === 'zh' ? '中' : 'EN' }}</span>
    </NuxtLink>
  </AppTooltip>
</template>
