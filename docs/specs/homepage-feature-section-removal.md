# Homepage feature section removal

**Date:** 2026-08-17  
**Status:** Approved design  
**Scope:** Documentation website homepage

## Summary

The documentation homepage ends after the existing hero. The numbered `01 / 02 / 03` feature cards are removed and are not replaced by another section.

The hero already completes the homepage's three jobs:

1. the title and description explain what the module does;
2. the Markdown／Rendered UI demo proves the input and result;
3. the `Get started` CTA provides the next action.

The removed cards repeat those claims without adding proof, navigation, or an action. Their visual weight therefore exceeds their information value.

This decision is supported by the first-party comparisons in [Nuxt ecosystem documentation homepage patterns](../research/nuxt-ecosystem-homepage-patterns.md).

## Mental model

Every large homepage section must change a visitor decision by providing at least one of:

- **Proof:** a real demo, code sample, result, integration, or other evidence;
- **Choice:** a meaningful route to a different package, component, template, or use case;
- **Action:** an immediate way to install, try, or continue reading.

The hero already provides proof and action. The three feature cards provide none of these roles, so removing them makes the information hierarchy more honest and direct.

## Decision

The landing page contains one primary section: the existing hero with copy, CTA, and the source／preview demo.

After the hero:

- no feature grid is rendered;
- no replacement cards, benefit strip, final CTA, or decorative filler is added;
- the normal landing container bottom padding closes the page;
- the site footer remains the next global element.

The homepage may be short. Shortness is not treated as a defect when the visitor has already understood the product, seen it work, and received a next step.

## Goals

- Remove repeated marketing copy from the homepage.
- Restore a clear visual hierarchy in which the real demo is the primary proof.
- Remove the false sequence implied by `01 / 02 / 03`.
- Reduce homepage-only markup, translations, and CSS with no remaining caller.
- Preserve the existing hero behavior, content pipeline, accessibility, themes, and responsive layout.

## Non-goals

- Do not redesign the hero.
- Do not add a copyable install command in this change.
- Do not add new sections, screenshots, testimonials, metrics, integrations, or feature lists.
- Do not change the homepage title, description, Mermaid source, CTA label, or CTA destination.
- Do not change documentation routes, navigation, the footer, or the package runtime.

## Presentation contract

`website/pages/index.vue` remains responsible for:

- querying the localized homepage content;
- returning the existing 404 when no homepage content exists;
- setting title and description metadata;
- rendering the hero copy and localized `Get started` CTA;
- rendering the page content through `ContentRenderer` and `LandingMermaidDemo`.

It no longer owns a feature section or hard-coded feature presentation.

`website/components/LandingMermaidDemo.vue`, `website/content/1.index.md`, and `website/content/zh/1.index.md` are unchanged. The Markdown and Rendered UI views must continue to project the same localized Mermaid source through the real rendering pipeline.

## Content and localization

The feature-only localization keys are removed from both locale files:

- `landing.features`;
- `landing.feature1Title` and `landing.feature1Description`;
- `landing.feature2Title` and `landing.feature2Description`;
- `landing.feature3Title` and `landing.feature3Description`.

The `landing.eyebrow` and `landing.getStarted` keys remain. No replacement copy is introduced.

## Styling and responsive behavior

All selectors that exist only for the removed section are deleted:

- `.feature-grid`;
- `.feature-card` and its descendant rules;
- `.feature-card__number`;
- the mobile `.feature-grid` override.

The landing container, hero grid, demo surface, CTA, breakpoints, and global tokens remain unchanged. Desktop and mobile both end after the hero; neither layout receives a compensating spacer or minimum page height.

## Accessibility

Removing the section also removes its localized `aria-label`. No replacement landmark is needed because no content takes its place.

The remaining page keeps one `<main>` and the existing hero content. Keyboard behavior, tab semantics, focus states, reduced-motion handling, and heading structure in the hero remain unchanged.

## Verification

Implementation is complete when:

- English and Traditional Chinese homepages contain no numbered feature cards or former feature copy;
- the hero title, description, CTA, Markdown tab, Rendered UI tab, and real diagram still render;
- no feature-only translation keys or CSS selectors remain;
- the page has no horizontal overflow at narrow viewports in either theme;
- the existing landing hero interaction and locale tests pass;
- the website test suite and static generation pass;
- lint and type checks covering the changed files pass.

Visual verification should cover a representative desktop viewport and a 320 px viewport in light and dark themes. The check is for hierarchy and accidental empty space, not pixel-identical screenshots.

## Existing specification changes

This design supersedes only the feature-card requirements in `docs/specs/documentation-website.md`, including:

- the `Vue presentation` requirement to render three fixed cards and their prescribed copy;
- the `Visual direction` requirement for a three-column desktop／single-column mobile card grid;
- file-scope descriptions that assign landing card markup and styles to `website/pages/index.vue` and `website/assets/css/main.css`.

The hero, content-query, source／preview, metadata, navigation, theme, and accessibility contracts in the existing documentation website specifications remain in force.
