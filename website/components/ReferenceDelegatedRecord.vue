<script setup lang="ts">
import type { PublicDelegatedException } from '../../scripts/website/reference-public.mjs'

const props = defineProps<{ record: PublicDelegatedException }>()
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
    <dl class="reference-details">
      <dt>Delegated Owner</dt><dd>{{ props.record.delegatedOwner }}</dd>
      <dt>Constraint</dt><dd>{{ props.record.constraint }}</dd>
      <dt>Scope</dt><dd>{{ props.record.scope }}</dd>
      <dt>Ownership</dt><dd>{{ props.record.ownership }}</dd>
      <dt>Boundary</dt><dd>{{ props.record.boundary }}</dd>
      <dt>Unknown-key Policy</dt><dd>{{ props.record.unknownKeyPolicy }}</dd>
      <dt>Package-owned Behavior</dt><dd>{{ props.record.packageBehavior }}</dd>
      <dt>Lifecycle Status</dt><dd>{{ props.record.deprecation.summary }}</dd>
    </dl>
    <section
      class="reference-detail"
      aria-label="Transport Restrictions"
    >
      <h4>Transport Restrictions</h4>
      <ul>
        <li
          v-for="restriction in props.record.transportRestrictions"
          :key="restriction"
        >
          {{ restriction }}
        </li>
      </ul>
    </section>
    <section
      class="reference-detail"
      aria-label="Package Fields"
    >
      <h4>Package Fields</h4>
      <p>Set: <code>{{ props.record.packageFields.set.join(', ') || 'none' }}</code></p>
      <p>Read: <code>{{ props.record.packageFields.read.join(', ') || 'none' }}</code></p>
    </section>
    <section
      class="reference-detail"
      aria-label="Allowances and Exclusions"
    >
      <h4>Allowances and Exclusions</h4>
      <p>Function paths: <code>{{ props.record.allowances.functionPaths.join(', ') || 'none' }}</code></p>
      <p>RegExp paths: <code>{{ props.record.allowances.regexpPaths.join(', ') || 'none' }}</code></p>
      <p>Opaque identity paths: <code>{{ props.record.allowances.opaqueIdentityPaths.join(', ') || 'none' }}</code></p>
      <ul>
        <li
          v-for="exclusion in props.record.exclusions"
          :key="exclusion"
        >
          {{ exclusion }}
        </li>
      </ul>
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
