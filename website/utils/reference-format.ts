export function formatReferenceValue(value: unknown): string {
  if (typeof value === 'string') {
    return `'${value.replaceAll('\\', '\\\\').replaceAll('\'', '\\\'')}'`
  }
  if (value === null) return 'null'
  if (Array.isArray(value)) return `[${value.map(formatReferenceValue).join(', ')}]`
  if (typeof value === 'object') {
    const fields = Object.entries(value).map(([key, item]) => (
      `${/^[A-Z_$][\w$]*$/i.test(key) ? key : formatReferenceValue(key)}: ${formatReferenceValue(item)}`
    ))
    return `{ ${fields.join(', ')} }`
  }
  return String(value)
}
