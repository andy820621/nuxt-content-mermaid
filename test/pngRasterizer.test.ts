import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { rasterizePngSnapshot } from '../src/runtime/png-rasterizer'

const htmlToImage = vi.hoisted(() => ({
  getFontEmbedCSS: vi.fn(),
  toBlob: vi.fn(),
}))

vi.mock('html-to-image', () => htmlToImage)

interface FakeNode {
  marker: string
  ownerDocument: FakeDocument
  cloneNode: ReturnType<typeof vi.fn>
}

interface FakeHost {
  style: Record<string, string>
  children: FakeNode[]
  isConnected: boolean
  appendChild: (node: FakeNode) => FakeNode
  remove: ReturnType<typeof vi.fn>
}

interface FakeDocument {
  fonts?: { ready: Promise<unknown> }
  styleSheets: ArrayLike<CSSStyleSheet>
  hosts: FakeHost[]
  body: { appendChild: (host: FakeHost) => FakeHost }
  createElement: (tagName: string) => FakeHost
}

function createDocument(options: {
  fontsReady?: Promise<unknown>
  styleSheets?: ArrayLike<CSSStyleSheet>
} = {}): FakeDocument {
  const document: FakeDocument = {
    fonts: options.fontsReady ? { ready: options.fontsReady } : undefined,
    styleSheets: options.styleSheets ?? [],
    hosts: [],
    body: {
      appendChild(host: FakeHost) {
        host.isConnected = true
        return host
      },
    },
    createElement() {
      const host: FakeHost = {
        style: {},
        children: [],
        isConnected: false,
        appendChild(node) {
          this.children.push(node)
          return node
        },
        remove: vi.fn(() => {
          host.isConnected = false
        }),
      }
      document.hosts.push(host)
      return host
    },
  }

  return document
}

function createSvg(document: FakeDocument, marker = 'safe foreignObject') {
  const clone = {
    marker,
    ownerDocument: document,
    cloneNode: vi.fn(),
  } as unknown as FakeNode
  const source = {
    marker,
    ownerDocument: document,
    cloneNode: vi.fn(() => clone),
  } as unknown as FakeNode

  return {
    clone,
    sourceNode: source,
    source: source as unknown as SVGSVGElement,
  }
}

function pngBlob() {
  return new Blob(['png'], { type: 'image/png' })
}

beforeEach(() => {
  htmlToImage.getFontEmbedCSS.mockReset().mockResolvedValue(
    '@font-face { src: url(data:font/woff2;base64,AA==) format("woff2"); }',
  )
  htmlToImage.toBlob.mockReset().mockResolvedValue(pngBlob())
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('PNG snapshot rasterizer', () => {
  it.each([
    ['zero width', 0, 100],
    ['negative height', 100, -1],
    ['infinite width', Number.POSITIVE_INFINITY, 100],
    ['NaN height', 100, Number.NaN],
  ])('rejects %s before invoking html-to-image', async (_label, width, height) => {
    const document = createDocument()
    const { source } = createSvg(document)

    await expect(rasterizePngSnapshot({ svg: source, width, height }))
      .rejects.toThrow('[nuxt-content-mermaid] Invalid PNG snapshot dimensions')
    expect(htmlToImage.getFontEmbedCSS).not.toHaveBeenCalled()
    expect(htmlToImage.toBlob).not.toHaveBeenCalled()
    expect(document.hosts).toHaveLength(0)
  })

  it('waits for document fonts before collecting embeddable font CSS', async () => {
    let resolveFonts!: () => void
    const fontsReady = new Promise<void>((resolve) => {
      resolveFonts = resolve
    })
    const document = createDocument({ fontsReady })
    const { source } = createSvg(document)

    const result = rasterizePngSnapshot({ svg: source, width: 1445, height: 477 })
    await Promise.resolve()
    expect(htmlToImage.getFontEmbedCSS).not.toHaveBeenCalled()

    resolveFonts()
    await expect(result).resolves.toEqual(expect.objectContaining({ type: 'image/png' }))
    expect(htmlToImage.getFontEmbedCSS).toHaveBeenCalledOnce()
  })

  it('fails before rasterization when a stylesheet is not readable', async () => {
    const blockedSheet = {
      href: 'https://fonts.example.test/blocked.css',
      get cssRules() {
        throw new DOMException('Blocked', 'SecurityError')
      },
    } as unknown as CSSStyleSheet
    const document = createDocument({ styleSheets: [blockedSheet] })
    const { source } = createSvg(document)

    await expect(rasterizePngSnapshot({ svg: source, width: 1445, height: 477 }))
      .rejects.toThrow(
        '[nuxt-content-mermaid] Cannot read stylesheet for PNG rasterization: https://fonts.example.test/blocked.css',
      )
    expect(htmlToImage.getFontEmbedCSS).not.toHaveBeenCalled()
    expect(htmlToImage.toBlob).not.toHaveBeenCalled()
  })

  it('fails before rasterization when font CSS retains a non-data URL', async () => {
    const document = createDocument()
    const { source } = createSvg(document)
    htmlToImage.getFontEmbedCSS.mockResolvedValue(
      '@font-face { src: local("Noto Sans TC"), url("https://fonts.example.test/font.woff2"); }',
    )

    await expect(rasterizePngSnapshot({ svg: source, width: 1445, height: 477 }))
      .rejects.toThrow('[nuxt-content-mermaid] PNG font embedding left an external URL')
    expect(htmlToImage.toBlob).not.toHaveBeenCalled()
    expect(document.hosts[0]?.remove).toHaveBeenCalledOnce()
  })

  it('rasterizes a cloned safe snapshot with exact transparent CSS-pixel options', async () => {
    const document = createDocument()
    const { clone, source, sourceNode } = createSvg(document)
    const blob = pngBlob()
    htmlToImage.toBlob.mockResolvedValue(blob)

    await expect(rasterizePngSnapshot({ svg: source, width: 1445, height: 477 }))
      .resolves.toBe(blob)

    const host = document.hosts[0]
    expect(host).toBeDefined()
    expect(source.cloneNode).toHaveBeenCalledWith(true)
    expect(host?.children).toEqual([clone])
    expect(host?.style).toMatchObject({
      position: 'fixed',
      left: '-100000px',
      top: '0',
      width: '1445px',
      height: '477px',
      margin: '0px',
      padding: '0px',
      background: 'transparent',
      pointerEvents: 'none',
    })
    expect(htmlToImage.getFontEmbedCSS).toHaveBeenCalledWith(host, {
      width: 1445,
      height: 477,
      canvasWidth: 1445,
      canvasHeight: 477,
      pixelRatio: 1,
    })
    expect(htmlToImage.toBlob).toHaveBeenCalledWith(host, {
      width: 1445,
      height: 477,
      canvasWidth: 1445,
      canvasHeight: 477,
      pixelRatio: 1,
      fontEmbedCSS: '@font-face { src: url(data:font/woff2;base64,AA==) format("woff2"); }',
    })
    expect(host?.remove).toHaveBeenCalledOnce()
    expect(host?.isConnected).toBe(false)
    expect(sourceNode.marker).toBe('safe foreignObject')
  })

  it.each([
    ['null output', null],
    ['non-PNG output', new Blob(['svg'], { type: 'image/svg+xml' })],
  ])('rejects %s and cleans the temporary host', async (_label, output) => {
    const document = createDocument()
    const { source } = createSvg(document)
    htmlToImage.toBlob.mockResolvedValue(output)

    await expect(rasterizePngSnapshot({ svg: source, width: 1445, height: 477 }))
      .rejects.toThrow('[nuxt-content-mermaid] PNG rasterization did not produce an image/png blob')
    expect(document.hosts[0]?.remove).toHaveBeenCalledOnce()
  })

  it('cleans the temporary host after html-to-image fails', async () => {
    const document = createDocument()
    const { source } = createSvg(document)
    htmlToImage.toBlob.mockRejectedValue(new Error('raster failed'))

    await expect(rasterizePngSnapshot({ svg: source, width: 1445, height: 477 }))
      .rejects.toThrow('raster failed')
    expect(document.hosts[0]?.remove).toHaveBeenCalledOnce()
  })
})
