<script setup lang="ts">
import type { WebsiteReferencePublicModel } from '../../scripts/website/reference-public.mjs'

const { data: page } = await useAsyncData('website-reference-page', () => (
  queryCollection('pages').path('/reference').first()
))
const { websiteReference } = useAppConfig()
const reference = websiteReference as unknown as WebsiteReferencePublicModel

if (!page.value) throw createError({ statusCode: 404, statusMessage: 'Reference page metadata not found' })

useSeoMeta({
  title: `${page.value.title} | Nuxt Content Mermaid`,
  description: page.value.description,
})
useHead({
  link: [{ rel: 'canonical', href: '/reference' }],
  meta: [{ name: 'robots', content: 'index, follow' }],
})
</script>

<template>
  <PageShell :page="page!">
    <template #content>
      <article class="document-page reference-page">
        <header class="document-hero">
          <p class="eyebrow">
            Validated package model
          </p>
          <h1>{{ page!.title }}</h1>
          <p class="document-description">
            {{ page!.description }}
          </p>
          <p data-reference-identity>
            <code>{{ reference.identity }}</code>
          </p>
        </header>
        <p data-reference-record-count>
          {{ reference.recordCount }} validated records
        </p>
        <nav
          class="reference-toc"
          aria-label="Reference sections"
        >
          <a href="#configuration-groups">Configuration Groups</a>
          <a href="#configuration-value-options">Configuration Value Options</a>
          <a href="#authoring-inputs">Authoring Inputs</a>
          <a href="#delegated-open-payloads">Delegated/Open Payloads</a>
          <a href="#deprecated-options">Deprecated Options</a>
        </nav>

        <section
          id="configuration-groups"
          class="reference-section"
          data-reference-section="configuration-groups"
        >
          <h2>Configuration Groups</h2>
          <ReferenceConfigurationRecord
            v-for="record in reference.sections.configurationGroups"
            :key="record.fragment"
            :record="record"
          />
        </section>
        <section
          id="configuration-value-options"
          class="reference-section"
          data-reference-section="configuration-values"
        >
          <h2>Configuration Value Options</h2>
          <ReferenceConfigurationRecord
            v-for="record in reference.sections.configurationValues"
            :key="record.fragment"
            :record="record"
          />
        </section>
        <section
          id="authoring-inputs"
          class="reference-section"
          data-reference-section="authoring-inputs"
        >
          <h2>Authoring Inputs</h2>
          <ReferenceAuthoringRecord
            v-for="record in reference.sections.authoringInputs"
            :key="record.fragment"
            :record="record"
          />
        </section>
        <section
          id="delegated-open-payloads"
          class="reference-section"
          data-reference-section="delegated-payloads"
        >
          <h2>Delegated/Open Payloads</h2>
          <ReferenceDelegatedRecord
            v-for="record in reference.sections.delegatedPayloads"
            :key="record.fragment"
            :record="record"
          />
        </section>
        <section
          id="deprecated-options"
          class="reference-section"
          data-reference-section="deprecated-options"
        >
          <h2>Deprecated Options</h2>
          <ReferenceConfigurationRecord
            v-for="record in reference.sections.deprecatedOptions"
            :key="record.fragment"
            :record="record"
          />
        </section>
      </article>
    </template>
  </PageShell>
</template>
