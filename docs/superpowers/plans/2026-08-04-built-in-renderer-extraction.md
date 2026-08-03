# Built-in Renderer Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the package-owned Built-in Renderer from the public Mermaid entry into one internal deep module without changing observable behavior or public API.

**Architecture:** `Mermaid.vue` remains the public interface and owns component-source invariant validation plus Renderer Selection routing. A single `src/runtime/built-in-renderer/BuiltInRenderer.vue` owns all Built-in configuration materialization, UI, CSS, and rendering lifecycle, coordinated through the internal domain state `renderingOwnership: 'pending' | 'built-in'`.

**Tech Stack:** TypeScript, Vue 3 SFCs, Nuxt 3/4 runtime APIs, Mermaid, Vitest, `@nuxt/test-utils` E2E fixtures, ESLint, vue-tsc, nuxt-module-build.

## Global Constraints

- Use exactly one new internal deep module: `src/runtime/built-in-renderer/BuiltInRenderer.vue`.
- `Mermaid.vue` retains public props/slots, initial and reactive component-source invariant validation, `.mermaid-outer-wrapper`, Custom Renderer application-component loading, spinner routing adapter, #45 outcomes, and Custom/Built-in routing.
- The Built-in module owns Runtime Mermaid Config, Page/Direct source materialization, Theme Resolution Policy, toolbar, loading/error presentation, lazy loading, copy, expand, fullscreen, zoom, transactional rendering, Built-in error resolution, and all Built-in CSS.
- Use `renderingOwnership: 'pending' | 'built-in'`; do not use a semantically vague boolean pause flag.
- Pending mounts the existing Built-in markup but cannot create or execute a Built-in Mermaid Render Request.
- No candidate means `built-in`; resolved means Custom Renderer; `not-found`/`load-failed` retain current console output and switch to Built-in setup at the existing next-tick boundary.
- Preserve the exact element hierarchy, class/CSS hooks, slots, Custom Renderer inputs, fallback timing, and observable lifecycle behavior. Compiler-generated `data-v-*` attributes are not public contract.
- Add no public prop, slot, runtime option, export, diagnostic, low-level render adapter, index, facade, or unrelated refactor.

---

### Task 1: Establish the Architecture Ownership Seam

**Files:**
- Create: `test/builtInRendererArchitecture.test.ts`
- Inspect: `src/runtime/components/Mermaid.vue`
- Future target: `src/runtime/built-in-renderer/BuiltInRenderer.vue`

**Interfaces:**
- Consumes: repository SFC source files as the explicitly approved source-architecture seam.
- Produces: a regression gate that keeps Built-in responsibilities out of the public entry and in the single deep module.

- [ ] **Step 1: Inspect the Vitest environment**

Run:

```bash
python /Users/Andy/Documents/Code/Nuxt/nuxt-content-mermaid/.agents/skills/vitest/scripts/inspect_vitest.py --root .
```

Expected: pnpm, existing Vitest config, and the repository's current Node/Nuxt test environments are detected without configuration changes.

- [ ] **Step 2: Write the failing ownership test**

Create the test with an existence-safe read so RED is an assertion failure rather than an ENOENT setup error:

```ts
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const mermaidEntryPath = fileURLToPath(new URL('../src/runtime/components/Mermaid.vue', import.meta.url))
const builtInRendererPath = fileURLToPath(new URL('../src/runtime/built-in-renderer/BuiltInRenderer.vue', import.meta.url))
const mermaidEntry = readFileSync(mermaidEntryPath, 'utf8')
const builtInRenderer = existsSync(builtInRendererPath)
  ? readFileSync(builtInRendererPath, 'utf8')
  : ''

describe('Built-in Renderer architecture ownership', () => {
  it('keeps Built-in rendering responsibilities in the internal deep module', () => {
    expect(mermaidEntry).toContain("from '../built-in-renderer/BuiltInRenderer.vue'")

    for (const responsibility of [
      'createMermaidRenderer',
      'materializeMermaidConfigForInvocation',
      'resolveMermaidTheme',
      'useMermaidTheme',
      'MermaidExpandOverlay',
      'MermaidFullscreenPresentation',
      '.mermaid-block',
    ]) {
      expect(mermaidEntry).not.toContain(responsibility)
      expect(builtInRenderer).toContain(responsibility)
    }
  })
})
```

The production change this test catches is accidental return of Built-in lifecycle, presentation, or CSS ownership to the public entry. This source-architecture seam is explicitly approved for the extraction despite the normal preference for behavioral tests.

- [ ] **Step 3: Run the focused test and verify RED**

Run:

```bash
python /Users/Andy/Documents/Code/Nuxt/nuxt-content-mermaid/.agents/skills/vitest/scripts/run_vitest.py --root . -- test/builtInRendererArchitecture.test.ts
```

Expected: FAIL because `Mermaid.vue` does not import the deep module and still contains Built-in responsibilities.

- [ ] **Step 4: Commit the RED architecture seam**

```bash
git add test/builtInRendererArchitecture.test.ts
git commit -m "test: define built-in renderer ownership seam"
```

---

### Task 2: Extract the Single Built-in Renderer Deep Module

**Files:**
- Create: `src/runtime/built-in-renderer/BuiltInRenderer.vue`
- Modify: `src/runtime/components/Mermaid.vue`
- Test: `test/builtInRendererArchitecture.test.ts`

**Interfaces:**
- Consumes: `MermaidComponentProps`, validated `MermaidComponentSource`, resolved spinner component, and Renderer Selection ownership.
- Produces: one internal SFC with the internal props below and the unchanged `.mermaid-block` DOM root.

```ts
type RenderingOwnership = 'pending' | 'built-in'

interface BuiltInRendererProps extends MermaidComponentProps {
  componentSource: MermaidComponentSource
  renderingOwnership: RenderingOwnership
  spinnerComponent: Component | string
}
```

- [ ] **Step 1: Create `BuiltInRenderer.vue` by mechanically moving Built-in ownership**

Move the following unchanged implementation from `Mermaid.vue` into the new SFC before making routing edits:

- runtime option snapshot, loader/theme/toolbar/expand/error options;
- theme and Page/Direct materialization;
- all template refs and Built-in UI state;
- copy, lazy observation, DOM extraction, error resolution, expand/fullscreen helpers;
- `createMermaidRenderer` request creation/invalidation and render state machine;
- Built-in mount/unmount/reactive rendering watchers;
- the current `.mermaid-block` template subtree;
- the complete current scoped style block.

Define the internal ownership guard at the two lifecycle boundaries:

```ts
function hasBuiltInRenderingOwnership() {
  return props.renderingOwnership === 'built-in'
}

function getBuiltInRenderRequest() {
  if (!hasBuiltInRenderingOwnership()) return undefined
  requestBuiltInRender ??= createMermaidRenderer({ /* existing dependencies */ })
  return requestBuiltInRender
}

async function renderMermaid() {
  if (!hasBuiltInRenderingOwnership()) return
  if (props.componentSource.kind === 'conflict') return
  const request = getBuiltInRenderRequest()
  if (!request) return
  // existing render state transitions remain unchanged
}

function setupMermaidContainer() {
  if (!hasBuiltInRenderingOwnership()) return
  // existing container/lazy setup remains unchanged
}
```

Watch the ownership transition so fallback retains the existing next-tick setup boundary:

```ts
watch(
  () => props.renderingOwnership,
  (ownership) => {
    if (ownership === 'built-in')
      nextTick(() => setupMermaidContainer())
  },
)
```

Use `props.componentSource` as the validated source. The Built-in reactive watcher owns request invalidation, loading reset, materialization, render recovery, code/theme changes, and conflict state response. Resolve the configured Built-in error component inside this SFC with its own application component glob/loading logic. Do not move spinner selection into this module.

- [ ] **Step 2: Reduce `Mermaid.vue` to validation and routing ownership**

Keep the initial invariant:

```ts
const initialComponentSource = resolveCurrentComponentSource()
if (initialComponentSource.kind === 'conflict') throw initialComponentSource.error
const componentSource = shallowRef<MermaidComponentSource>(initialComponentSource)
```

Keep a post-flush reactive validation watcher that collects Page/Direct dependencies, assigns the newest validated source, and throws a newly entered conflict without retaining Built-in invalidation/materialization behavior.

Represent Renderer Selection state explicitly:

```ts
type RenderingOwnership = 'pending' | 'built-in'
const renderingOwnership = ref<RenderingOwnership>(
  configuredMermaidImplName.value ? 'pending' : 'built-in',
)
```

Preserve selection transitions:

```ts
if (outcome.status === 'no-candidate') {
  customMermaidImpl.value = null
  renderingOwnership.value = 'built-in'
  return
}

customMermaidImpl.value = null
renderingOwnership.value = 'pending'

// resolved keeps the Custom Renderer assignment
// not-found/load-failed keep their existing console calls
renderingOwnership.value = resolvedOutcome.status === 'resolved'
  ? 'pending'
  : 'built-in'
```

The `resolved` state leaves the Built-in branch unmounted because `customMermaidImpl` is set; the ownership union intentionally describes only states that can be passed to the mounted Built-in module.

Render the existing outer hierarchy without a new wrapper:

```vue
<div class="mermaid-outer-wrapper">
  <component
    :is="customMermaidImpl"
    v-if="customMermaidImpl"
    :spinner="spinnerComponent"
    :code="decodedCode"
  >
    <slot>
      <pre v-if="decodedCode"><code>{{ decodedCode }}</code></pre>
    </slot>
  </component>

  <BuiltInRenderer
    v-else
    v-bind="props"
    :component-source="componentSource"
    :rendering-ownership="renderingOwnership"
    :spinner-component="spinnerComponent"
  >
    <slot>
      <pre v-if="decodedCode"><code>{{ decodedCode }}</code></pre>
    </slot>
    <template
      v-if="$slots.loading"
      #loading
    >
      <slot name="loading" />
    </template>
    <template
      v-if="$slots.error"
      #error="{ error, source }"
    >
      <slot
        name="error"
        :error="error"
        :source="source"
      />
    </template>
  </BuiltInRenderer>
</div>
```

Do not retain Built-in imports, state, lifecycle, template, or styles in the entry.

- [ ] **Step 3: Run the architecture test and verify GREEN**

Run:

```bash
python /Users/Andy/Documents/Code/Nuxt/nuxt-content-mermaid/.agents/skills/vitest/scripts/run_vitest.py --root . -- test/builtInRendererArchitecture.test.ts
```

Expected: PASS.

- [ ] **Step 4: Run typechecking and fix only extraction defects**

Run:

```bash
pnpm test:types
```

Expected: PASS with no public prop/export changes, template slot errors, circular imports, or runtime declaration drift.

- [ ] **Step 5: Run focused Built-in and Custom Renderer behavior suites**

Run:

```bash
python /Users/Andy/Documents/Code/Nuxt/nuxt-content-mermaid/.agents/skills/vitest/scripts/run_vitest.py --root . -- test/builtInRenderer.e2e.test.ts test/customRenderer.e2e.test.ts test/customComponents.e2e.test.ts test/lazyConflict.e2e.test.ts
```

Expected: all focused suites pass with unchanged pending/fallback, component configuration, lazy, error, and Custom Renderer behavior.

- [ ] **Step 6: Inspect existing pending/fallback observations**

Confirm the current public E2E suites observe:

- Built-in source markup exists while Custom Renderer resolution is pending;
- Built-in Mermaid execution does not start while pending;
- `not-found` and `load-failed` retain console output and Built-in fallback;
- successful resolution receives `code`, default slot, and spinner and never executes Built-in Mermaid.

Only if one of these observable contracts is absent, add one focused test through public `<Mermaid>` behavior, watch it fail against a deliberately broken ownership guard, restore the guard, and watch it pass. Do not add behavior not required by Issue #46.

- [ ] **Step 7: Commit the extraction**

```bash
git add src/runtime/components/Mermaid.vue src/runtime/built-in-renderer/BuiltInRenderer.vue test/builtInRendererArchitecture.test.ts
git commit -m "refactor: extract built-in renderer"
```

---

### Task 3: Complete Verification and Two-axis Review

**Files:**
- Review: all changes from `main...HEAD`
- Modify: only files required to fix verified extraction defects or review findings

**Interfaces:**
- Consumes: the approved design, Issue #46 acceptance criteria, repository standards, and the complete branch diff.
- Produces: a fully verified, reviewed feature branch ready to push.

- [ ] **Step 1: Run formatting and whitespace checks**

```bash
git diff --check main...HEAD
pnpm lint
```

Expected: both commands exit 0.

- [ ] **Step 2: Run the complete Vitest suite**

```bash
pnpm test
```

Expected: every Vitest file and test passes with zero failures.

- [ ] **Step 3: Run complete type checks**

```bash
pnpm test:types
```

Expected: root and playground vue-tsc checks pass.

- [ ] **Step 4: Build the package**

```bash
pnpm prepack
```

Expected: nuxt-module-build completes and public declarations show no drift.

- [ ] **Step 5: Run two-axis code review against `main`**

Use the repository `code-review` skill with fixed point `main`:

- Standards reviewer: repository guidelines plus the Fowler smell baseline.
- Spec reviewer: Issue #46 plus the approved design document.

Fix every confirmed finding, rerun the narrow affected test first, then rerun all four completion gates from Steps 1-4. If fixes change the branch, commit them with a focused Conventional Commit message.

- [ ] **Step 6: Verify final branch state**

```bash
git status --short --branch
git log main..HEAD --oneline
git diff --stat main...HEAD
```

Expected: clean feature branch with only Issue #46 design, plan, test, public-entry, and internal-renderer changes.

---

### Task 4: Publish and Shepherd the Pull Request

**Files:**
- Read: `.github/PULL_REQUEST_TEMPLATE.md` or `.github/PULL_REQUEST_TEMPLATE/*` if present
- External: GitHub Issue #46 and the feature branch PR

**Interfaces:**
- Consumes: verified commits on `codex/issue-46-built-in-renderer-extraction`.
- Produces: pushed branch, PR linked with `Closes #46`, passing CI/review state, and a ready-to-land exact head SHA.

- [ ] **Step 1: Push the ordinary feature branch**

```bash
git push -u origin codex/issue-46-built-in-renderer-extraction
```

- [ ] **Step 2: Create the PR**

Create a ready PR targeting `main` with:

- Conventional Commit-style title: `refactor: extract built-in renderer`;
- summary of the deep-module ownership split and unchanged behavior;
- test results for lint, full Vitest, type checks, and package build;
- `Closes #46` in the body.

- [ ] **Step 3: Watch CI and review to an actionable or ready state**

Use the PR completion watcher. Repair branch-caused CI failures, conflicts, and actionable review comments; rerun affected and complete verification; commit and push ordinary updates without force.

- [ ] **Step 4: Prepare squash landing for the exact ready head**

When the watcher reports `ready`, use the PR completion landing helper in plan mode with `--mode auto --method squash`. Report the PR URL, exact head SHA, method, and immediate-merge warning, then obtain the skill-required explicit per-PR landing confirmation before invoking the confirmed landing mutation.

- [ ] **Step 5: Observe the landing and closure**

After an approved landing request, watch until GitHub reports the exact authorized head merged. Then verify:

- PR state is merged with squash method;
- Issue #46 is closed;
- `main` contains the squash commit;
- local `main` can be fast-forwarded to `origin/main` without discarding work;
- final commit, PR URL/number, merge state, Issue state, and all validation results are recorded for the user.

## Plan Self-review

- Spec coverage: every Issue #46 acceptance criterion and every approved first-principles adjustment maps to Tasks 1-4.
- Placeholder scan: no implementation step contains TBD, TODO, "similar to", or unspecified error handling.
- Type consistency: `renderingOwnership`, `componentSource`, and `spinnerComponent` names and types are identical across architecture, extraction, and verification tasks.
- Scope check: exactly one internal module is introduced; no index, composable extraction, public API, or unrelated refactor appears in the plan.
