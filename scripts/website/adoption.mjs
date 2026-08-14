import AxeBuilder from '@axe-core/playwright'

const PACKAGE_VERSION = '3.0.0'
const PACKAGE_IDENTITY = `@barzhsieh/nuxt-content-mermaid@${PACKAGE_VERSION}`
const REFERENCE_RECORD_COUNT = 43
const REFERENCE_FRAGMENT_CASES = [
  'debug',
  'delegated-component-direct-config',
  'theme-use-color-mode-theme',
]

function expectEvidence(condition, message) {
  if (!condition) throw new Error(`website adoption verification failed: ${message}`)
}

async function expectVisibleText(page, selector, expected, label) {
  const locator = page.locator(selector)
  expectEvidence(await locator.count() === 1, `${label} must be unique`)
  expectEvidence(await locator.isVisible(), `${label} must be visible`)
  expectEvidence((await locator.textContent())?.includes(expected), `${label} is missing ${expected}`)
}

async function expectAccessibleStructure(page) {
  const result = await page.locator('body').evaluate((body) => {
    const headings = [...body.querySelectorAll('h1, h2, h3, h4, h5, h6')]
    const levels = headings.map(heading => Number(heading.tagName.slice(1)))
    const unnamedControls = [...body.querySelectorAll('button, a[href]')]
      .filter((element) => {
        const name = element.getAttribute('aria-label')
          || element.getAttribute('title')
          || element.textContent
        return !name?.trim()
      })
    return {
      h1Count: levels.filter(level => level === 1).length,
      headingJump: levels.some((level, index) => index > 0 && level > levels[index - 1] + 1),
      unnamedControlCount: unnamedControls.length,
      primaryNavCount: body.querySelectorAll('nav[aria-label="Primary navigation"]').length,
      unnamedNavCount: body.querySelectorAll('nav:not([aria-label])').length,
    }
  })

  expectEvidence(result.h1Count === 1, 'page must expose exactly one h1')
  expectEvidence(!result.headingJump, 'heading levels must not jump')
  expectEvidence(result.unnamedControlCount === 0, 'interactive controls must have discernible names')
  expectEvidence(result.primaryNavCount === 1, 'primary navigation must have an accessible name')
  expectEvidence(result.unnamedNavCount === 0, 'every navigation landmark must have an accessible name')
}

async function expectNoCriticalAccessibilityViolations(page) {
  const results = await new AxeBuilder({ page }).analyze()
  const critical = results.violations.filter(violation => violation.impact === 'critical')
  expectEvidence(
    critical.length === 0,
    `critical accessibility violations: ${critical.map(violation => violation.id).join(', ')}`,
  )
  return critical.length
}

async function expectHomepageCoreContent(page) {
  await expectVisibleText(page, '[data-home-purpose]', 'Mermaid code blocks', 'homepage purpose')
  await expectVisibleText(page, '[data-compatibility="nuxt"]', 'Nuxt ^4.1.0', 'Nuxt compatibility')
  await expectVisibleText(page, '[data-compatibility="content"]', 'Nuxt Content >=3.5.0 <4.0.0', 'Nuxt Content compatibility')
  await expectVisibleText(page, '[data-compatibility="node"]', 'Node.js >=22.19.0', 'Node compatibility')
  await expectVisibleText(page, '[data-stable-artifact]', PACKAGE_IDENTITY, 'stable artifact identity')
}

async function expectGettingStartedCoreContent(page) {
  await expectVisibleText(page, '#prerequisites', 'Prerequisites', 'prerequisites checkpoint')
  await expectVisibleText(page, '#install', 'Install', 'installation step')
  await expectVisibleText(page, '#enable-the-module', 'Enable the module', 'module activation step')
  await expectVisibleText(page, '#add-your-first-diagram', 'Add your first diagram', 'first diagram step')
  await expectVisibleText(page, '#first-successful-render', 'First Successful Render', 'success checkpoint')
  await expectVisibleText(page, '#if-it-does-not-render', 'If it does not render', 'inline recovery')
  await expectVisibleText(page, '[data-page-id="getting-started"]', PACKAGE_IDENTITY, 'Getting Started artifact identity')

  const pageText = await page.locator('[data-page-id="getting-started"]').textContent()
  for (const symptom of ['install fails', 'build fails', 'source stays visible']) {
    expectEvidence(pageText?.toLowerCase().includes(symptom), `inline recovery must route the ${symptom} symptom`)
  }
}

async function expectSearchMetadata(page, canonicalPath) {
  const canonical = page.locator('link[rel="canonical"]')
  expectEvidence(await canonical.count() === 1, `${canonicalPath} canonical must be unique`)
  expectEvidence(await canonical.getAttribute('href') === canonicalPath, `${canonicalPath} canonical mismatch`)

  const robots = page.locator('meta[name="robots"]')
  expectEvidence(await robots.count() === 1, `${canonicalPath} robots metadata must be unique`)
  expectEvidence(await robots.getAttribute('content') === 'index, follow', `${canonicalPath} must remain indexable`)
}

async function expectFragmentTargets(page, fragmentIds) {
  for (const id of fragmentIds) {
    expectEvidence(await page.locator(`#${id}`).count() === 1, `fragment #${id} must resolve uniquely`)
  }
}

async function expectTaskLink(page, href, label) {
  const link = page.locator(`a[href="${href}"]`)
  expectEvidence(await link.count() === 1, `${label} link must be unique`)
  expectEvidence(await link.isVisible(), `${label} link must be visible`)
  return link
}

async function expectBrowserFindTerms(page, terms) {
  for (const term of terms) {
    const found = await page.evaluate((query) => {
      window.getSelection()?.removeAllRanges()
      return window.find(query, false, false, true, false, false, false)
    }, term)
    expectEvidence(found, `browser find must locate ${term}`)
  }
}

async function expectTroubleshootingCoreContent(page) {
  await expectVisibleText(page, '[data-page-id="troubleshooting"]', PACKAGE_IDENTITY, 'Troubleshooting artifact identity')
  await expectVisibleText(page, '#install-fails', 'Install fails', 'install symptom')
  await expectVisibleText(page, '#build-fails', 'Build fails', 'build symptom')
  await expectVisibleText(page, '#source-stays-visible', 'Source stays visible', 'render symptom')
  await expectVisibleText(page, '#before-you-open-an-issue', 'Before you open an issue', 'escalation boundary')
  await expectFragmentTargets(page, [
    'install-fails',
    'build-fails',
    'source-stays-visible',
    'before-you-open-an-issue',
  ])
  await expectTaskLink(page, '/getting-started#install', 'installation recovery')
  await expectTaskLink(page, '/migration/v3#rename-the-module-key', 'migration recovery')

  const pageText = await page.locator('[data-page-id="troubleshooting"]').textContent()
  expectEvidence((pageText?.match(/### Confirm/g) ?? []).length === 0, 'rendered Troubleshooting must not expose Markdown heading syntax')
  expectEvidence((pageText?.match(/Confirm/g) ?? []).length >= 3, 'every troubleshooting symptom must expose a confirmation step')
  expectEvidence((pageText?.match(/Next step/g) ?? []).length >= 3, 'every troubleshooting symptom must expose a next step')
  expectEvidence((pageText?.match(/Escalation threshold/g) ?? []).length >= 3, 'every troubleshooting symptom must expose an escalation threshold')
  for (const term of ['clean Package User reproduction', 'Declared-Compatible Combination', 'Contract Gap']) {
    expectEvidence(pageText?.includes(term), `Troubleshooting must preserve ${term}`)
  }
}

const MIGRATION_FRAGMENTS = [
  'rename-the-module-key',
  'keep-module-activation-at-build-time',
  'transport-only-pure-data-at-runtime',
  'choose-page-or-direct-mermaid-config',
  'account-for-property-presence-merge',
  'treat-expand-booleans-as-resets',
  'recognize-only-public-diagnostics-and-rendering-guarantees',
  'remove-package-root-transform-imports',
  'migration-checklist',
]

const MIGRATION_FIND_TERMS = [
  'contentMermaid',
  'Module Activation',
  'pure data',
  'Page Mermaid Config',
  'Direct Mermaid Config',
  'Property-Presence Merge',
  'expand: false',
  'Minimal Public Diagnostic Fingerprint',
  'transformMermaidCodeBlocks',
  'Migration checklist',
]

async function expectMigrationCoreContent(page) {
  await expectVisibleText(page, '[data-page-id="migration-v3"]', PACKAGE_IDENTITY, 'Migration artifact identity')
  await expectFragmentTargets(page, MIGRATION_FRAGMENTS)
  await expectTaskLink(page, '/getting-started#prerequisites', 'new installation path')
  await expectTaskLink(page, '/troubleshooting#build-fails', 'migration recovery')

  const pageText = await page.locator('[data-page-id="migration-v3"]').textContent()
  for (const term of MIGRATION_FIND_TERMS) {
    expectEvidence(pageText?.includes(term), `Migration entry must contain ${term}`)
  }
  expectEvidence(pageText?.includes('Run the application\'s production build'), 'Migration checklist must end in a usable build check')
}

async function expectReferenceCoreContent(page) {
  await expectVisibleText(page, '[data-reference-identity]', PACKAGE_IDENTITY, 'Reference artifact identity')
  await expectVisibleText(page, '[data-reference-record-count]', `${REFERENCE_RECORD_COUNT} validated records`, 'Reference record count')

  const sectionIds = [
    'configuration-groups',
    'configuration-value-options',
    'authoring-inputs',
    'delegated-open-payloads',
    'deprecated-options',
  ]
  await expectFragmentTargets(page, sectionIds)

  const records = page.locator('[data-reference-record]')
  expectEvidence(await records.count() === REFERENCE_RECORD_COUNT, 'Reference must render all 43 validated records')
  const fragments = await records.evaluateAll(elements => elements.map(element => ({
    id: element.id,
    fragment: element.getAttribute('data-reference-fragment'),
    anchorCount: element.querySelectorAll(`a[href="#${CSS.escape(element.id)}"]`).length,
  })))
  expectEvidence(new Set(fragments.map(record => record.id)).size === REFERENCE_RECORD_COUNT, 'Reference record ids must be unique')
  expectEvidence(
    fragments.every(record => record.id && record.fragment === record.id && record.anchorCount === 1),
    'every Reference record must expose one stable linkable anchor',
  )
  expectEvidence(
    await page.locator('#deprecated-options [data-reference-record="theme.useColorModeTheme"]').count() === 1,
    'deprecated no-op must appear once in the dedicated Deprecated section',
  )
  expectEvidence(
    await page.locator('#configuration-value-options [data-reference-record="theme.useColorModeTheme"]').count() === 0,
    'deprecated no-op must not duplicate in active values',
  )

  const pageText = await page.locator('[data-page-id="reference"]').textContent()
  for (const literal of [
    'startOnLoad: false',
    'theme: \'default\'',
    'fontFamily: \'Arial, sans-serif, 微軟正黑體\'',
    'securityLevel: \'strict\'',
    'debug:false → { logLevel: 5, suppressErrorRendering: true }',
    'debug:true → { logLevel: 1, suppressErrorRendering: false }',
    'runtimeConfig.public.contentMermaid.enabled is absent and rejected.',
    'mermaidContent is rejected and is not deprecated.',
    'Mermaid %%{init}%% syntax is Mermaid-owned and outside the package inventory.',
  ]) {
    expectEvidence(pageText?.includes(literal), `Reference must render exact behavior: ${literal}`)
  }
  expectEvidence(await page.locator('pre > code[data-code-language]').count() > 0, 'Reference examples must use semantic code markup')
  expectEvidence(
    await page.locator('[data-reference-record] > details.reference-occurrences').count() === REFERENCE_RECORD_COUNT,
    'every Reference record must expose its accepted surfaces',
  )

  const html = await page.content()
  expectEvidence(
    !/artifact:|artifactRoot|manifestPath|\.pnpm|\/Users\/|dist\/runtime\/.+?#|reference-probe:/i.test(html),
    'Reference public HTML must not expose private evidence identifiers or paths',
  )
  return fragments.map(record => record.id)
}

async function expectReferenceFragmentLoads(page, origin, hydrated) {
  for (const fragment of REFERENCE_FRAGMENT_CASES) {
    await page.goto(`${origin}/reference/#${fragment}`, { waitUntil: 'load' })
    const response = await page.reload({ waitUntil: 'load' })
    expectEvidence(response?.status() === 200, `Reference fragment #${fragment} direct load must return 200`)
    if (hydrated) {
      await page.locator('[data-page-id="reference"][data-hydration-state="hydrated"]').waitFor()
    }
    expectEvidence(new URL(page.url()).pathname === '/reference/', `Reference fragment #${fragment} must keep the Reference route`)
    expectEvidence(new URL(page.url()).hash === `#${fragment}`, `Reference fragment #${fragment} must preserve its hash`)
    expectEvidence(await page.locator(`#${fragment}`).count() === 1, `Reference fragment #${fragment} must resolve uniquely`)
    expectEvidence(await page.locator('[data-reference-record]').count() === REFERENCE_RECORD_COUNT, `Reference fragment #${fragment} must retain full content`)
  }
}

async function focusByKeyboard(page, target) {
  for (let index = 0; index < 12; index += 1) {
    await page.keyboard.press('Tab')
    if (await target.evaluate(element => document.activeElement === element)) return
  }
  throw new Error('website adoption verification failed: keyboard focus did not reach the expected control')
}

async function expectContractDiagramCentered(demo) {
  const geometry = await demo.locator('.mermaid-wrapper').evaluate((wrapper) => {
    const svg = wrapper.querySelector('.mermaid > svg')
    const graphic = svg?.querySelector('g.root') ?? svg?.querySelector('g')
    if (!svg || !graphic) return null

    const center = (element) => {
      const rect = element.getBoundingClientRect()
      return rect.left + rect.width / 2
    }

    return {
      graphicCenterDelta: center(graphic) - center(wrapper),
      svgCenterDelta: center(svg) - center(wrapper),
      svgDisplay: getComputedStyle(svg).display,
      svgViewBox: svg.getAttribute('viewBox'),
      svgWidth: svg.getAttribute('width'),
    }
  })

  expectEvidence(Boolean(geometry), 'Contract Demo must expose measurable SVG geometry')
  expectEvidence(Math.abs(geometry.graphicCenterDelta) <= 1, 'Contract Demo graphics must be horizontally centered')
  expectEvidence(Math.abs(geometry.svgCenterDelta) <= 1, 'Contract Demo SVG viewport must be horizontally centered')
  return geometry
}

export async function observeHomeWithoutJavaScript({ page }) {
  await expectAccessibleStructure(page)
  await expectHomepageCoreContent(page)

  const primaryCta = page.locator('[data-primary-cta]')
  expectEvidence(await primaryCta.getAttribute('href') === '/getting-started#prerequisites', 'homepage CTA must lead to prerequisites')

  const sources = page.locator('[data-contract-source]')
  expectEvidence(await sources.count() === 2, 'both Contract Demos must retain source fallback')
  for (const source of await sources.all()) {
    expectEvidence(await source.isVisible(), 'Contract Demo source fallback must remain visible')
  }

  return {
    productFit: true,
    compatibility: true,
    exactArtifact: PACKAGE_VERSION,
    contractSourceFallbacks: 2,
  }
}

export async function observeGettingStartedWithoutJavaScript({ page }) {
  await expectAccessibleStructure(page)
  await expectGettingStartedCoreContent(page)

  return {
    selfContainedSteps: 5,
    successCheckpoint: true,
    inlineRecoverySymptoms: 3,
  }
}

export async function observeHomeHydrated({ page }) {
  await expectAccessibleStructure(page)
  const criticalAccessibilityViolations = await expectNoCriticalAccessibilityViolations(page)
  await expectHomepageCoreContent(page)

  const primaryDemo = page.locator('[data-contract-demo="primary"]')
  const primarySvg = primaryDemo.locator('.mermaid > svg')
  await primarySvg.waitFor()
  const centeredDiagram = await expectContractDiagramCentered(primaryDemo)
  const lightSvg = await primarySvg.evaluate(element => element.outerHTML)

  const themeButton = page.getByRole('button', { name: 'Switch to dark theme' })
  await focusByKeyboard(page, themeButton)
  expectEvidence(await themeButton.evaluate(element => element.matches(':focus-visible')), 'theme control must expose visible keyboard focus')
  await page.keyboard.press('Enter')
  await page.locator('[data-site-theme="dark"]').waitFor()
  await page.waitForFunction(({ selector, before }) => {
    const svg = document.querySelector(selector)
    return svg instanceof SVGElement && svg.outerHTML !== before
  }, {
    selector: '[data-contract-demo="primary"] .mermaid > svg',
    before: lightSvg,
  })

  const expandButton = primaryDemo.getByRole('button', { name: 'Expand diagram' })
  await expandButton.focus()
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'Minimize diagram' }).waitFor()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Minimize diagram' }).waitFor({ state: 'detached' })

  const lazyDemo = page.locator('[data-contract-demo="lazy"]')
  const lazySvg = lazyDemo.locator('.mermaid > svg')
  expectEvidence(await lazySvg.count() === 0, 'lazy Contract Demo must not render before intersection')
  const lazyBox = await lazyDemo.boundingBox()
  const viewport = page.viewportSize()
  expectEvidence(Boolean(lazyBox && viewport && lazyBox.y > viewport.height), 'lazy Contract Demo must begin below the viewport')
  await lazyDemo.scrollIntoViewIfNeeded()
  await lazySvg.waitFor()

  await page.emulateMedia({ reducedMotion: 'reduce' })
  const activeThemeButton = page.getByRole('button', { name: 'Switch to light theme' })
  const reducedMotion = await activeThemeButton.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      animationName: style.animationName,
      transitionDuration: style.transitionDuration,
    }
  })
  expectEvidence(reducedMotion.animationName === 'none', 'reduced motion must disable non-essential animation')
  expectEvidence(reducedMotion.transitionDuration === '0s', 'reduced motion must disable non-essential transitions')

  await page.setViewportSize({ width: 390, height: 844 })
  await page.evaluate(() => window.scrollTo(0, 0))
  const responsive = await page.locator('body').evaluate(body => ({
    clientWidth: body.ownerDocument.documentElement.clientWidth,
    scrollWidth: body.ownerDocument.documentElement.scrollWidth,
  }))
  expectEvidence(responsive.scrollWidth <= responsive.clientWidth, 'homepage must not overflow a narrow viewport')

  const primaryCta = page.locator('[data-primary-cta]')
  await primaryCta.focus()
  await page.keyboard.press('Enter')
  await page.locator('[data-page-id="getting-started"][data-hydration-state="hydrated"]').waitFor()
  expectEvidence(new URL(page.url()).pathname === '/getting-started', 'client navigation must reach Getting Started')
  expectEvidence(new URL(page.url()).hash === '#prerequisites', 'client navigation must preserve the prerequisites fragment')
  await expectGettingStartedCoreContent(page)

  const homeLink = page.locator('[data-brand-link]')
  await homeLink.focus()
  await page.keyboard.press('Enter')
  await page.locator('[data-page-id="home"][data-hydration-state="hydrated"]').waitFor()
  await expectHomepageCoreContent(page)

  return {
    themeAware: true,
    keyboardToolbarInteraction: true,
    lazyRendering: true,
    reducedMotion: true,
    narrowViewport: true,
    clientNavigation: true,
    criticalAccessibilityViolations,
    centeredDiagram,
  }
}

export async function observeGettingStartedHydrated({ page }) {
  await expectAccessibleStructure(page)
  const criticalAccessibilityViolations = await expectNoCriticalAccessibilityViolations(page)
  await expectGettingStartedCoreContent(page)
  return {
    inlineRecovery: true,
    accessibleStructure: true,
    criticalAccessibilityViolations,
  }
}

export async function observeTroubleshootingWithoutJavaScript({ page }) {
  await expectAccessibleStructure(page)
  await expectSearchMetadata(page, '/troubleshooting')
  await expectTroubleshootingCoreContent(page)
  return {
    boundedSymptoms: 3,
    classificationBoundary: true,
    indexable: true,
  }
}

export async function observeTroubleshootingHydrated({ page }) {
  await expectAccessibleStructure(page)
  const criticalAccessibilityViolations = await expectNoCriticalAccessibilityViolations(page)
  await expectSearchMetadata(page, '/troubleshooting')
  await expectTroubleshootingCoreContent(page)
  await expectBrowserFindTerms(page, ['Install fails', 'Escalation threshold', 'Contract Gap'])

  const migrationLink = await expectTaskLink(page, '/migration/v3#rename-the-module-key', 'migration recovery')
  await migrationLink.focus()
  await page.keyboard.press('Enter')
  await page.locator('[data-page-id="migration-v3"][data-hydration-state="hydrated"]').waitFor()
  expectEvidence(new URL(page.url()).pathname === '/migration/v3', 'Troubleshooting task flow must reach Migration')
  expectEvidence(new URL(page.url()).hash === '#rename-the-module-key', 'Troubleshooting task flow must preserve the migration fragment')
  expectEvidence(await page.locator('#rename-the-module-key').count() === 1, 'migration task-flow fragment must resolve')

  return {
    browserFind: true,
    taskFlow: true,
    accessibleStructure: true,
    criticalAccessibilityViolations,
  }
}

export async function observeMigrationWithoutJavaScript({ page }) {
  await expectAccessibleStructure(page)
  await expectSearchMetadata(page, '/migration/v3')
  await expectMigrationCoreContent(page)
  return {
    requiredTopics: 8,
    usableChecklist: true,
    indexable: true,
  }
}

export async function observeMigrationHydrated({ page }) {
  await expectAccessibleStructure(page)
  const criticalAccessibilityViolations = await expectNoCriticalAccessibilityViolations(page)
  await expectSearchMetadata(page, '/migration/v3')
  await expectMigrationCoreContent(page)
  await expectBrowserFindTerms(page, MIGRATION_FIND_TERMS)

  const troubleshootingLink = await expectTaskLink(page, '/troubleshooting#build-fails', 'migration recovery')
  await troubleshootingLink.focus()
  await page.keyboard.press('Enter')
  await page.locator('[data-page-id="troubleshooting"][data-hydration-state="hydrated"]').waitFor()
  expectEvidence(new URL(page.url()).pathname === '/troubleshooting', 'Migration task flow must reach Troubleshooting')
  expectEvidence(new URL(page.url()).hash === '#build-fails', 'Migration task flow must preserve the troubleshooting fragment')
  expectEvidence(await page.locator('#build-fails').count() === 1, 'troubleshooting task-flow fragment must resolve')

  return {
    browserFind: true,
    taskFlow: true,
    accessibleStructure: true,
    criticalAccessibilityViolations,
  }
}

export async function observeReferenceWithoutJavaScript({ page, origin }) {
  await expectAccessibleStructure(page)
  await expectSearchMetadata(page, '/reference')
  const fragments = await expectReferenceCoreContent(page)
  await expectReferenceFragmentLoads(page, origin, false)
  return {
    identity: PACKAGE_IDENTITY,
    recordCount: REFERENCE_RECORD_COUNT,
    uniqueFragments: fragments.length,
    initialHtmlComplete: true,
    representativeFragments: REFERENCE_FRAGMENT_CASES.length,
    indexable: true,
  }
}

export async function observeReferenceHydrated({ page, origin }) {
  await expectAccessibleStructure(page)
  const criticalAccessibilityViolations = await expectNoCriticalAccessibilityViolations(page)
  await expectSearchMetadata(page, '/reference')
  const fragments = await expectReferenceCoreContent(page)
  await expectReferenceFragmentLoads(page, origin, true)
  return {
    identity: PACKAGE_IDENTITY,
    recordCount: REFERENCE_RECORD_COUNT,
    uniqueFragments: fragments.length,
    sameReferencePage: true,
    representativeFragments: REFERENCE_FRAGMENT_CASES.length,
    criticalAccessibilityViolations,
  }
}

export const WEBSITE_STATIC_CASES = [
  {
    id: 'home',
    logicalRoute: '/',
    directUrl: '/',
    physicalFile: 'index.html',
    title: 'Nuxt Content Mermaid',
    description: 'Render interactive Mermaid diagrams from Markdown in Nuxt Content.',
    heading: 'Mermaid diagrams, native to Nuxt Content',
    navigationHref: '/getting-started',
    artifactVersion: PACKAGE_VERSION,
    observeNoJavaScript: observeHomeWithoutJavaScript,
    observeHydrated: observeHomeHydrated,
  },
  {
    id: 'getting-started',
    logicalRoute: '/getting-started',
    directUrl: '/getting-started/',
    physicalFile: 'getting-started/index.html',
    title: 'Getting Started | Nuxt Content Mermaid',
    description: 'Install Nuxt Content Mermaid and reach your first successful diagram render.',
    heading: 'Getting Started',
    navigationHref: '/',
    observeNoJavaScript: observeGettingStartedWithoutJavaScript,
    observeHydrated: observeGettingStartedHydrated,
  },
  {
    id: 'troubleshooting',
    logicalRoute: '/troubleshooting',
    directUrl: '/troubleshooting/',
    physicalFile: 'troubleshooting/index.html',
    title: 'Troubleshooting | Nuxt Content Mermaid',
    description: 'Recover from the bounded failures most likely to block your first successful Mermaid render.',
    heading: 'Troubleshooting',
    navigationHref: '/',
    observeNoJavaScript: observeTroubleshootingWithoutJavaScript,
    observeHydrated: observeTroubleshootingHydrated,
  },
  {
    id: 'migration-v3',
    logicalRoute: '/migration/v3',
    directUrl: '/migration/v3/',
    physicalFile: 'migration/v3/index.html',
    title: 'Migrating to v3 | Nuxt Content Mermaid',
    description: 'Move a version 2 application to Nuxt Content Mermaid 3.0.0 from one searchable migration entry.',
    heading: 'Migrating to v3',
    navigationHref: '/',
    observeNoJavaScript: observeMigrationWithoutJavaScript,
    observeHydrated: observeMigrationHydrated,
  },
  {
    id: 'reference',
    logicalRoute: '/reference',
    directUrl: '/reference/',
    physicalFile: 'reference/index.html',
    title: 'Reference | Nuxt Content Mermaid',
    description: 'Explore every validated Nuxt Content Mermaid configuration, authoring input, and delegated payload boundary.',
    heading: 'Reference',
    navigationHref: '/reference',
    observeNoJavaScript: observeReferenceWithoutJavaScript,
    observeHydrated: observeReferenceHydrated,
  },
]
