<script setup lang="ts">
import type { PublicAuthoringInput } from '../../scripts/website/reference-public.mjs'

const props = defineProps<{ record: PublicAuthoringInput }>()
</script>

<template>
  <article
    :id="props.record.fragment"
    class="reference-record"
    :data-reference-record="props.record.path"
    :data-reference-fragment="props.record.fragment"
    :data-reference-kind="props.record.kind"
  >
    <header class="reference-record-heading">
      <div>
        <p class="reference-path">
          <code>{{ props.record.path }}</code>
        </p>
        <h3>{{ props.record.title }}</h3>
      </div>
      <a
        class="reference-anchor"
        :href="`#${props.record.fragment}`"
        :aria-label="`Link to ${props.record.title}`"
      >#</a>
    </header>
    <p>{{ props.record.description }}</p>
    <p>{{ props.record.purpose }}</p>
    <ul
      v-if="props.record.explicitNegatives?.length"
      class="reference-negatives"
    >
      <li
        v-for="negative in props.record.explicitNegatives"
        :key="negative"
      >
        {{ negative }}
      </li>
    </ul>
    <dl class="reference-details">
      <dt>Syntax</dt><dd><code>{{ props.record.syntax }}</code></dd>
      <dt>Transport Target</dt><dd>{{ props.record.transportTarget }}</dd>
      <dt>Scope</dt><dd>{{ props.record.scope }}</dd>
      <dt>Ownership</dt><dd>{{ props.record.ownership }}</dd>
      <dt>Downstream Ownership</dt><dd>{{ props.record.downstreamOwnership }}</dd>
      <dt>Boundary</dt><dd>{{ props.record.boundary }}</dd>
      <dt>Lifecycle Status</dt><dd>{{ props.record.deprecation.summary }}</dd>
    </dl>
    <section
      class="reference-detail"
      aria-label="Source Precedence"
    >
      <h4>Source Precedence</h4>
      <ol>
        <li
          v-for="rule in props.record.sourcePrecedence"
          :key="rule"
        >
          {{ rule }}
        </li>
      </ol>
    </section>
    <section
      class="reference-detail"
      aria-label="Minimum Example"
    >
      <h4>Minimum Example</h4>
      <pre><code :data-code-language="props.record.minimumExample.language">{{ props.record.minimumExample.source }}</code></pre>
    </section>
    <details class="reference-occurrences">
      <summary>Accepted surfaces and precedence</summary>
      <ul>
        <li
          v-for="occurrence in props.record.occurrences"
          :key="`${occurrence.surface}:${occurrence.path}`"
        >
          <strong>{{ occurrence.surface }}</strong> · <code>{{ occurrence.path }}</code><br>
          {{ occurrence.scope }} · {{ occurrence.precedence }}
        </li>
      </ul>
    </details>
  </article>
</template>
