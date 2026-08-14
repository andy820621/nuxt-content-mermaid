<script setup lang="ts">
const { data: page } = await useAsyncData('website-home', () => (
  queryCollection('pages').path('/').first()
))

if (!page.value) throw createError({ statusCode: 404, statusMessage: 'Home content not found' })

useSeoMeta({
  title: page.value.title,
  description: page.value.description,
})

const compatibility = [
  { id: 'nuxt', label: 'Nuxt ^4.1.0' },
  { id: 'content', label: 'Nuxt Content >=3.5.0 <4.0.0' },
  { id: 'node', label: 'Node.js >=22.19.0' },
]
</script>

<template>
  <PageShell :page="page!">
    <template #content>
      <div class="home-page">
        <section
          class="home-hero"
          aria-labelledby="home-heading"
        >
          <div class="hero-copy">
            <p class="eyebrow">
              Nuxt Content → Mermaid
            </p>
            <h1 id="home-heading">
              Mermaid diagrams, native to Nuxt Content
            </h1>
            <p
              class="hero-lede"
              data-home-purpose
            >
              Turn fenced Mermaid code blocks into interactive, theme-aware diagrams without leaving your Markdown workflow.
            </p>
            <ul
              class="compatibility-list"
              aria-label="Compatibility"
            >
              <li
                v-for="item in compatibility"
                :key="item.id"
                :data-compatibility="item.id"
              >
                <span aria-hidden="true">✓</span>{{ item.label }}
              </li>
            </ul>
            <p
              class="stable-artifact"
              data-stable-artifact
            >
              <span>Installable evidence</span>
              <code>@barzhsieh/nuxt-content-mermaid@3.0.0</code>
            </p>
            <div class="hero-actions">
              <NuxtLink
                data-primary-cta
                class="primary-button"
                to="/getting-started#prerequisites"
              >
                Get your first render
                <span aria-hidden="true">→</span>
              </NuxtLink>
              <a
                class="text-link"
                href="#contract-evidence"
              >See runtime evidence</a>
            </div>
          </div>
          <ContractDemo
            demo-id="primary"
            title="From source to SVG"
            description="The diagram below is rendered after hydration by the documented npm artifact—not a screenshot or workspace build."
          />
        </section>

        <section
          class="outcome-section"
          aria-labelledby="workflow-title"
        >
          <div class="section-heading">
            <p class="eyebrow">
              One content workflow
            </p>
            <h2 id="workflow-title">
              Write the diagram. Keep the source. Ship the experience.
            </h2>
          </div>
          <div class="outcome-grid">
            <article>
              <span>01</span>
              <h3>Author in Markdown</h3>
              <p>Use the same fenced <code>mermaid</code> block your content authors already understand.</p>
            </article>
            <article>
              <span>02</span>
              <h3>Render with the package</h3>
              <p>The installed module transforms Content output and hydrates it with the bundled Mermaid runtime.</p>
            </article>
            <article>
              <span>03</span>
              <h3>Retain a resilient fallback</h3>
              <p>When JavaScript is unavailable, the readable and copyable source remains in the generated page.</p>
            </article>
          </div>
        </section>

        <section
          id="contract-evidence"
          class="lazy-proof"
          aria-labelledby="lazy-proof-title"
        >
          <div class="lazy-proof-copy">
            <p class="eyebrow">
              Lazy by design
            </p>
            <h2 id="lazy-proof-title">
              Rendering waits until it matters
            </h2>
            <p>This second live example begins below the fold. The stable package renders it only when it approaches the viewport.</p>
          </div>
          <ContractDemo
            demo-id="lazy"
            title="Observed on intersection"
            description="Scroll brought this Contract Demo into view; the same stable artifact then produced its SVG."
          />
        </section>

        <section class="final-cta">
          <div>
            <p class="eyebrow">
              Ready when you are
            </p>
            <h2>From evaluation to your own rendered diagram</h2>
          </div>
          <NuxtLink
            class="primary-button"
            to="/getting-started#prerequisites"
          >
            Start the five-minute path
            <span aria-hidden="true">→</span>
          </NuxtLink>
        </section>
      </div>
    </template>
  </PageShell>
</template>
