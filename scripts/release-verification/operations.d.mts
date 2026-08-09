import type { ReleaseVerificationOperations } from './runner.mjs'

export interface CommandInvocation {
  command: string
  args: string[]
  cwd: string
  env?: Record<string, string | undefined>
}

export interface CommandResult {
  stdout?: string
  stderr?: string
}

export interface ReleaseVerificationOperationOptions {
  templateDirectory: string
  commandRunner?: (invocation: CommandInvocation) => Promise<CommandResult | undefined>
  runtimeSmoke?: (input: { consumerDirectory: string }) => Promise<void>
  temporaryRoot?: string
}

export function runCommand(invocation: CommandInvocation): Promise<CommandResult>

export function createReleaseVerificationOperations(
  options: ReleaseVerificationOperationOptions,
): ReleaseVerificationOperations
