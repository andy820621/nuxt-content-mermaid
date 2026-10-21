import { fileURLToPath } from 'node:url'
import { createPage, setup, url } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

const websiteRoot = fileURLToPath(new URL('..', import.meta.url))

describe('documentation callout', async () => {
  await setup({ rootDir: websiteRoot, browser: true })

  it('renders the warning callout with Markdown content', async () => {
    const page = await createPage(undefined, {
      colorScheme: 'light',
      storageState: { cookies: [], origins: [] },
    })

    await page.goto(url('/zh/getting-started'), { waitUntil: 'hydration' })

    const callout = page.getByRole('note')
    expect(await callout.count()).toBe(1)
    expect(await callout.getAttribute('data-variant')).toBe('warning')
    const title = callout.locator('.callout__title')
    expect(await title.getByText('安裝提示', { exact: true }).count()).toBe(1)
    expect(await title.locator('svg.callout__icon').count()).toBe(1)
    expect(await callout.locator('.callout__body-container').count()).toBe(1)
    const icon = callout.locator('svg.callout__icon')
    expect(await icon.count()).toBe(1)
    expect(await icon.getAttribute('aria-hidden')).toBe('true')
    expect(await callout.getByText('pnpm approve-builds', { exact: true }).count()).toBe(1)
    expect(await callout.locator('pre').count()).toBe(2)
    expect(await callout.locator('pre.language-bash').count()).toBe(1)
    expect(await callout.locator('pre.language-json').count()).toBe(1)
    const installationLink = callout.locator('a').filter({ hasText: 'Nuxt Content 安裝指南' })
    expect(await installationLink.count()).toBe(1)
    expect(await installationLink.getAttribute('href')).toBe('https://content.nuxt.com/docs/getting-started/installation#automatic-setup')
    expect(await page.getByText('::: info', { exact: true }).count()).toBe(0)
  })

  it('keeps the callout readable across themes and narrow viewports', async () => {
    const page = await createPage(undefined, {
      colorScheme: 'light',
      storageState: { cookies: [], origins: [] },
    })

    await page.goto(url('/zh/getting-started'), { waitUntil: 'hydration' })
    const callout = page.getByRole('note')
    expect(await callout.count()).toBe(1)

    const readStyles = () => callout.evaluate((element) => {
      const style = getComputedStyle(element)
      const title = element.querySelector('.callout__title')
      const body = element.querySelector('.callout__body')
      const titleStyle = title ? getComputedStyle(title) : undefined
      const bodyStyle = body ? getComputedStyle(body) : undefined
      return {
        background: style.backgroundColor,
        border: style.borderTopColor,
        borderInlineStartWidth: style.borderInlineStartWidth,
        borderRadius: style.borderRadius,
        boxShadow: style.boxShadow,
        titleColor: titleStyle?.color ?? '',
        bodyColor: bodyStyle?.color ?? '',
        bodyFontSize: bodyStyle?.fontSize ?? '',
        bodyLineHeight: bodyStyle?.lineHeight ?? '',
        bodyFontWeight: bodyStyle?.fontWeight ?? '',
        width: element.getBoundingClientRect().width,
      }
    })

    const light = await readStyles()
    expect(light.background).not.toBe('rgba(0, 0, 0, 0)')
    expect(light.border).not.toBe('rgba(0, 0, 0, 0)')
    expect(light.borderInlineStartWidth).toBe('1px')
    expect(light.borderRadius).toBe('4px')
    expect(light.boxShadow).toBe('none')
    expect(light.titleColor).not.toBe('')
    expect(light.bodyColor).not.toBe('')
    expect(light.titleColor).toBe(light.bodyColor)
    expect(light.bodyFontSize).toBe('14px')
    expect(light.bodyLineHeight).toBe('20px')
    expect(light.bodyFontWeight).toBe('500')

    await page.locator('.theme-toggle').click()
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark')
    const dark = await readStyles()
    expect(dark.background).not.toBe('rgba(0, 0, 0, 0)')
    expect(dark.border).not.toBe('rgba(0, 0, 0, 0)')
    expect(dark.borderInlineStartWidth).toBe('1px')
    expect(dark.borderRadius).toBe('4px')
    expect(dark.boxShadow).toBe('none')
    expect(dark.titleColor).not.toBe('')
    expect(dark.bodyColor).not.toBe('')
    expect(dark.titleColor).toBe(dark.bodyColor)
    expect(dark.bodyFontSize).toBe('14px')
    expect(dark.bodyLineHeight).toBe('20px')
    expect(dark.bodyFontWeight).toBe('500')
    expect(dark.titleColor).not.toBe(light.titleColor)
    expect(dark.bodyColor).not.toBe(light.bodyColor)
    expect(dark.background).not.toBe(light.background)
    expect(dark.border).not.toBe(light.border)

    await page.setViewportSize({ width: 320, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    expect(await callout.isVisible()).toBe(true)

    const narrowLayout = await callout.evaluate((element) => {
      const calloutRect = element.getBoundingClientRect()
      const preRects = [...element.querySelectorAll('pre')].map(pre => {
        const rect = pre.getBoundingClientRect()
        return {
          left: rect.left,
          right: rect.right,
          className: pre.className,
          scrollWidth: pre.scrollWidth,
          clientWidth: pre.clientWidth,
          overflowX: getComputedStyle(pre).overflowX,
        }
      })

      return {
        callout: {
          left: calloutRect.left,
          right: calloutRect.right,
        },
        pre: preRects,
        viewportWidth: window.innerWidth,
      }
    })

    expect(narrowLayout.callout.left).toBeGreaterThanOrEqual(0)
    expect(narrowLayout.callout.right).toBeLessThanOrEqual(narrowLayout.viewportWidth)
    expect(narrowLayout.pre).toHaveLength(2)
    for (const pre of narrowLayout.pre) {
      expect(pre.left).toBeGreaterThanOrEqual(0)
      expect(pre.right).toBeLessThanOrEqual(narrowLayout.viewportWidth)
      expect(pre.overflowX).toBe('auto')
    }

    const jsonPre = narrowLayout.pre.find(pre => pre.className.includes('language-json'))
    expect(jsonPre).toBeDefined()
    expect(jsonPre!.scrollWidth).toBeGreaterThan(jsonPre!.clientWidth)
  })
})
