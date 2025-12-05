---
title: ER Diagram - content tagging
type: er
variant: posts-tags
tags:
  - erDiagram
  - many-to-many
config:
  er:
    layoutDirection: LR
    diagramPadding: 28
    entityPadding: 10
    nodeSpacing: 36
    rankSpacing: 56
expect: Shows a many-to-many tagging relationship between posts and tags via a junction table, plus authorship.
notes:
  - Focuses on modelling many-to-many with an explicit junction entity.
  - Use this to compare how ER diagrams render dense relationships and attribute lists.
---

```mermaid
erDiagram
  AUTHOR {
    string author_id
    string name
    string email
  }

  POST {
    string post_id
    string title
    date published_at
    boolean is_published
  }

  TAG {
    string tag_id
    string label
  }

  POST_TAG {
    string post_id
    string tag_id
    date tagged_at
  }

  AUTHOR ||--o{ POST : writes
  POST   ||--o{ POST_TAG : "has tag"
  TAG    ||--o{ POST_TAG : "used in"
```
