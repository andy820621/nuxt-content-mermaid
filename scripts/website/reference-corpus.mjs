import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { loadReferenceRecords } from './reference-parity.mjs'

export const WEBSITE_REFERENCE_CORPUS_PATH = fileURLToPath(
  new URL('../../website/reference/records.v1.json', import.meta.url),
)

export async function loadWebsiteReferenceCorpus({
  artifact,
  repositoryRoot,
  readText = path => readFile(path, 'utf8'),
} = {}) {
  const source = await readText(WEBSITE_REFERENCE_CORPUS_PATH)
  const records = JSON.parse(source)
  return loadReferenceRecords(records, {
    artifact,
    workspaceRoot: repositoryRoot,
  })
}
