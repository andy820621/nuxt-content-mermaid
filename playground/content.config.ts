import { defineCollection, defineContentConfig, z } from '@nuxt/content'

const mermaidSchema = z.object({
  title: z.string().optional(),
  type: z.string().optional(),
  variant: z.string().optional(),
  tags: z.array(z.string()).optional(),
  config: z.record(z.unknown()).optional(),
  expect: z.string().optional(),
  notes: z.array(z.string()).optional(),
})

export default defineContentConfig({
  collections: {
    content: defineCollection({
      type: 'page',
      source: '**',
      schema: mermaidSchema,
    }),
    mermaid: defineCollection({
      type: 'page',
      source: 'mermaid/**',
      schema: mermaidSchema,
    }),
  },
})
