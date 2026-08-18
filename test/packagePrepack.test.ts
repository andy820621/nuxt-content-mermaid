import { execFile } from 'node:child_process'
import { access, copyFile, lstat, mkdir, mkdtemp, readdir, readlink, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'

const execFileAsync = promisify(execFile)
const repositoryRoot = process.cwd()
const temporaryDirectories: string[] = []

async function createCleanTrackedWorkspace() {
  const workspace = await mkdtemp(join(tmpdir(), 'nuxt-content-mermaid-prepack-'))
  temporaryDirectories.push(workspace)

  const { stdout } = await execFileAsync('git', ['ls-files', '-z'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  })

  for (const relativePath of stdout.split('\0').filter(Boolean)) {
    const source = resolve(repositoryRoot, relativePath)
    const destination = resolve(workspace, relativePath)
    const sourceStats = await lstat(source)

    await mkdir(dirname(destination), { recursive: true })
    if (sourceStats.isSymbolicLink()) {
      await symlink(await readlink(source), destination)
    }
    else {
      await copyFile(source, destination)
    }
  }

  await symlink(resolve(repositoryRoot, 'node_modules'), join(workspace, 'node_modules'), 'dir')
  return workspace
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, {
    force: true,
    recursive: true,
  })))
})

describe('package prepack lifecycle', () => {
  it('packs successfully from a clean tracked workspace without generated Nuxt state', async () => {
    const workspace = await createCleanTrackedWorkspace()
    const artifactDirectory = join(workspace, 'artifacts')
    await mkdir(artifactDirectory)

    await execFileAsync('pnpm', [
      'pack',
      '--json',
      '--pack-destination',
      artifactDirectory,
    ], {
      cwd: workspace,
      env: {
        ...process.env,
        CI: '1',
      },
      timeout: 60_000,
    })

    await expect(access(join(workspace, '.nuxt', 'tsconfig.json'))).resolves.toBeUndefined()
    const archives = (await readdir(artifactDirectory)).filter(filename => filename.endsWith('.tgz'))
    expect(archives).toHaveLength(1)
  }, 70_000)
})
