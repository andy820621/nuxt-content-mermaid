import type { MaybeRefOrGetter } from 'vue'

interface DocumentationSeoSource {
  title?: string
  description?: string
}

export function useDocumentationSeo(
  source: MaybeRefOrGetter<DocumentationSeoSource | null | undefined>,
) {
  const resolveSource = () => toValue(source)
  const { localeProperties } = useI18n()

  useSeoMeta({
    title: () => resolveSource()?.title,
    description: () => resolveSource()?.description,
    twitterTitle: () => resolveSource()?.title,
    twitterDescription: () => resolveSource()?.description,
  })

  useSchemaOrg([
    defineWebPage(computed(() => ({
      name: resolveSource()?.title,
      description: resolveSource()?.description,
      inLanguage: localeProperties.value.language,
    }))),
  ])
}
