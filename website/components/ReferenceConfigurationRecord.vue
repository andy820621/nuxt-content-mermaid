<script setup lang="ts">
import type {
  PublicConfigurationGroup,
  PublicConfigurationValue,
} from '../../scripts/website/reference-public.mjs'
import { formatReferenceValue } from '~/utils/reference-format'

type Summary = Readonly<{
  kind: string
  summary: string
  value?: unknown
  outcomes?: Readonly<Record<string, unknown>>
}>

const props = defineProps<{
  record: PublicConfigurationGroup | PublicConfigurationValue
}>()

function summaryCode(summary: Summary | undefined) {
  return summary && Object.hasOwn(summary, 'value')
    ? formatReferenceValue(summary.value)
    : undefined
}

function outcomeEntries(summary: Summary | undefined) {
  return Object.entries(summary?.outcomes ?? {})
}
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

    <dl class="reference-facts">
      <div v-if="props.record.kind === 'configuration-value'">
        <dt>Display Type</dt>
        <dd><code>{{ props.record.valueType }}</code></dd>
      </div>
      <div>
        <dt>Scope</dt>
        <dd>{{ props.record.scope }}</dd>
      </div>
      <div>
        <dt>Ownership</dt>
        <dd>{{ props.record.ownership }}</dd>
      </div>
      <div>
        <dt>Boundary</dt>
        <dd>{{ props.record.boundary }}</dd>
      </div>
      <div v-if="props.record.kind === 'configuration-group'">
        <dt>Canonical Children</dt>
        <dd>
          <code
            v-for="child in props.record.children"
            :key="child"
          >{{ child }}</code>
        </dd>
      </div>
    </dl>

    <section
      class="reference-detail"
      aria-label="Precedence"
    >
      <h4>Precedence</h4>
      <ol>
        <li
          v-for="rule in props.record.precedence"
          :key="rule"
        >
          {{ rule }}
        </li>
      </ol>
    </section>

    <section
      v-if="props.record.default"
      class="reference-detail"
      aria-label="Default"
    >
      <h4>Default · {{ props.record.default.kind }}</h4>
      <p>{{ props.record.default.summary }}</p>
      <p v-if="summaryCode(props.record.default)">
        <code>{{ summaryCode(props.record.default) }}</code>
      </p>
      <ul v-if="outcomeEntries(props.record.default).length">
        <li
          v-for="[condition, outcome] in outcomeEntries(props.record.default)"
          :key="condition"
        >
          <code>{{ condition }} → {{ formatReferenceValue(outcome) }}</code>
        </li>
      </ul>
    </section>

    <section
      v-if="props.record.reset"
      class="reference-detail"
      aria-label="Reset"
    >
      <h4>Reset · {{ props.record.reset.kind }}</h4>
      <p>{{ props.record.reset.summary }}</p>
      <p v-if="summaryCode(props.record.reset)">
        <code>{{ summaryCode(props.record.reset) }}</code>
      </p>
    </section>

    <section
      v-if="props.record.minimumExample"
      class="reference-detail"
      aria-label="Minimum Example"
    >
      <h4>Minimum Example</h4>
      <pre><code :data-code-language="props.record.minimumExample.language">{{ props.record.minimumExample.source }}</code></pre>
    </section>

    <dl class="reference-details">
      <template v-if="props.record.lifecycle">
        <dt>Lifecycle</dt>
        <dd>{{ props.record.lifecycle }}</dd>
      </template>
      <template v-if="props.record.errorSemantics">
        <dt>Error Semantics</dt>
        <dd>{{ props.record.errorSemantics }}</dd>
      </template>
      <template v-if="props.record.supportedConstraint">
        <dt>Supported Constraint</dt>
        <dd>{{ props.record.supportedConstraint.summary }}</dd>
      </template>
      <template v-if="props.record.recommendedRange">
        <dt>Recommended Range</dt>
        <dd>{{ props.record.recommendedRange.summary }}</dd>
      </template>
      <template v-if="props.record.localValidation">
        <dt>Local Validation</dt>
        <dd>{{ props.record.localValidation.summary }}</dd>
      </template>
      <dt>Lifecycle Status</dt>
      <dd>{{ props.record.deprecation.summary }}</dd>
    </dl>

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
