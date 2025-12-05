---
title: ER Diagram - customers & orders
type: er
variant: customer-orders
tags:
  - erDiagram
  - cardinality
config:
  er:
    layoutDirection: LR
    diagramPadding: 32
    entityPadding: 12
    nodeSpacing: 40
    rankSpacing: 60
expect: Demonstrates basic one-to-many and mandatory/optional relationships between customers, orders, line items, and delivery addresses.
notes:
  - Based on the classic CUSTOMER / ORDER / LINE-ITEM example from the Mermaid docs.
  - Use this to verify that ER diagrams render correctly and labels remain legible in both themes.
---

```mermaid
erDiagram
  CUSTOMER {
    string customer_id
    string name
    string email
  }

  ORDER {
    string order_id
    date placed_at
    string status
  }

  LINE_ITEM {
    string line_id
    int quantity
    float unit_price
  }

  DELIVERY_ADDRESS {
    string address_id
    string street
    string city
    string country
  }

  CUSTOMER ||--o{ ORDER : places
  ORDER   ||--|{ LINE_ITEM : contains
  CUSTOMER }|..|{ DELIVERY_ADDRESS : "can ship to"
```
