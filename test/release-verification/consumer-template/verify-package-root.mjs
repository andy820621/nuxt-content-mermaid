import { realpath } from 'node:fs/promises'
import { isAbsolute, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageName = '@barzhsieh/nuxt-content-mermaid'
const consumerRoot = fileURLToPath(new URL('.', import.meta.url))
const packageRoot = await realpath(join(consumerRoot, 'node_modules', ...packageName.split('/')))
const resolvedEntry = await realpath(fileURLToPath(import.meta.resolve(packageName)))
const relativeEntry = relative(packageRoot, resolvedEntry)

if (relativeEntry.startsWith('..') || isAbsolute(relativeEntry)) {
  throw new Error(`Package root import escaped the installed package: ${resolvedEntry}`)
}

const packageModule = await import(packageName)
if (!packageModule.default) {
  throw new Error('Package root import does not expose the Nuxt module default export')
}
