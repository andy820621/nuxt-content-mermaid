---
status: accepted
---

# Make public runtime configuration a pure-data transport contract

Every setting written to `runtimeConfig.public.contentMermaid` must be strict JSON pure data: `RuntimeOptions` is the build-to-browser transport interface, `ModuleOptions` is `{ enabled?: boolean } & RuntimeOptions`, and `loader.init` uses a named `RuntimeMermaidConfig` that recursively excludes functions, permissive upstream `any` values, and other non-pure values instead of relying on a shallow omission. JSON structure and values must survive transport, but prototypes, property descriptors, frozen state, and reference identity are outside the contract; cycles are rejected, while non-cyclic shared references are accepted without preserving their identity, and numbers must be finite and must not be negative zero.

Validation traverses property descriptors without calling getters, setters, or `toJSON`, and reports the complete path of each invalid entry rather than using `JSON.stringify` as a validator. Raw configuration is validated before merging when Nuxt still exposes it, the final merged value is validated again before it is written to public runtime config, and package defaults obey the same rules by omitting optional properties instead of assigning `undefined`; an explicit `undefined` already erased by Nuxt normalization cannot be reconstructed or diagnosed. Mermaid configuration created directly on the client without crossing runtime config may continue to use the full `MermaidConfig`, and a function-capable client extension seam is deferred until a concrete need exists.
