import AxeBuilder from '@axe-core/playwright'

const PACKAGE_VERSION = '3.0.0'
const PACKAGE_IDENTITY = `@barzhsieh/nuxt-content-mermaid@${PACKAGE_VERSION}`

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
      labelledNavCount: body.querySelectorAll('nav[aria-label]').length,
    }
  })

  expectEvidence(result.h1Count === 1, 'page must expose exactly one h1')
  expectEvidence(!result.headingJump, 'heading levels must not jump')
  expectEvidence(result.unnamedControlCount === 0, 'interactive controls must have discernible names')
  expectEvidence(result.labelledNavCount === 1, 'primary navigation must have an accessible name')
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

async function focusByKeyboard(page, target) {
  for (let index = 0; index < 12; index += 1) {
    await page.keyboard.press('Tab')
    if (await target.evaluate(element => document.activeElement === element)) return
  }
  throw new Error('website adoption verification failed: keyboard focus did not reach the expected control')
}

export async function observeHomeWithoutJavaScript({ page }) {
  await expectAccessibleStructure(page)
  const criticalAccessibilityViolations = await expectNoCriticalAccessibilityViolations(page)
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
    criticalAccessibilityViolations,
  }
}

export async function observeGettingStartedWithoutJavaScript({ page }) {
  await expectAccessibleStructure(page)
  const criticalAccessibilityViolations = await expectNoCriticalAccessibilityViolations(page)
  await expectGettingStartedCoreContent(page)

  return {
    selfContainedSteps: 5,
    successCheckpoint: true,
    inlineRecoverySymptoms: 3,
    criticalAccessibilityViolations,
  }
}

export async function observeHomeHydrated({ page }) {
  await expectAccessibleStructure(page)
  const criticalAccessibilityViolations = await expectNoCriticalAccessibilityViolations(page)
  await expectHomepageCoreContent(page)

  const primaryDemo = page.locator('[data-contract-demo="primary"]')
  const primarySvg = primaryDemo.locator('.mermaid > svg')
  await primarySvg.waitFor()
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
  const reducedMotion = await themeButton.evaluate((element) => {
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
]
