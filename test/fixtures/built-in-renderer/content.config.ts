import { defineCollection, defineContentConfig, z } from '@nuxt/content'

export default defineContentConfig({
  collections: {
    content: defineCollection({
      type: 'page',
      source: { include: '**', exclude: ['without-config-schema/**'] },
      schema: z.object({
        config: z.record(z.unknown()).optional(),
      }),
    }),
    withoutConfig: defineCollection({
      type: 'page',
      source: 'without-config-schema/**',
    }),
  },
})
