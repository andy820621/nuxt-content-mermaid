---
title: Class Diagram - relationships
type: class
variant: associations
config:
  class:
    diagramPadding: 32
    nodeSpacing: 60
    rankSpacing: 80
    htmlLabels: true
    hideEmptyMembersBox: true
expect: Shows inheritance, composition/aggregation, interface implementation, and labelled associations.
notes:
  - Includes attributes/methods to verify layout and font rendering.
  - Interface uses Mermaid realization syntax (..|>), composition uses *--, aggregation uses o--.
---

```mermaid
classDiagram
direction LR

class User {
  +String id
  +String name
  +login()
  -hashPassword()
}

class Admin {
  +suspendUser(id)
}

class Session {
  +token: String
  +expiresAt: Date
}

class Cart {
  +items: CartItem[]
  +addItem(item)
}

class CartItem {
  +sku: String
  +qty: Number
}

class PaymentGateway {
  <<interface>>
  +charge(amount)
}

class StripeGateway {
  +charge(amount)
}

User <|-- Admin
User "1" --> "many" Session : creates
User "1" o-- "1" Cart : aggregates
Cart "1" *-- "*" CartItem : composed of
Cart --> PaymentGateway : uses
StripeGateway ..|> PaymentGateway : implements
Session --> Cart : binds
```
