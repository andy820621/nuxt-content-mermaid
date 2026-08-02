---
status: accepted
---

# Treat expand booleans as reset presets

`resolveExpandOptions` consumes expand layers in their fixed low-to-high order. A present boolean replaces the accumulator directly: `true` creates a fresh enabled copy of package defaults, while `false` creates a fresh disabled copy; a plain object is instead a Property-Presence patch over the accumulator, and an absent property makes no change. Package defaults must not be passed through `mergeByPresence` as an ordinary high-priority object when interpreting a boolean, because the boolean contract is a complete reset rather than a partial patch.

## Transformation matrix

| Higher-priority input | Result | Lower-priority custom values survive |
| --- | --- | --- |
| Property absent | Existing accumulator | Yes |
| `true` | Fresh package defaults with `enabled: true` | No |
| `false` | Fresh package defaults with `enabled: false` | No |
| `{}` | Existing accumulator | Yes |
| Object without `enabled` | Property-Presence patch; existing enabled state is preserved | Yes, except explicitly patched properties |
| Object with `enabled: true` | Property-Presence patch that explicitly enables expansion | Yes, except explicitly patched properties |
| Object with `enabled: false` | Property-Presence patch that explicitly disables expansion | Yes, except explicitly patched properties |
| Invalid domain value such as `null` | Validation error at its full source path | Not applicable |

In particular, a lower `false` followed by a higher `{ margin: 32 }` remains disabled, while `{ enabled: true, margin: 32 }` explicitly re-enables it. This deliberately fixes the undocumented behavior where `defu` could backfill `enabled: true` and silently re-enable a lower disabled value; the 3.0 migration note must call out the explicit re-enable requirement, and contract tests must cover the matrix, especially lower `false` followed by an empty object, an object without `enabled`, and an object with `enabled: true`.
