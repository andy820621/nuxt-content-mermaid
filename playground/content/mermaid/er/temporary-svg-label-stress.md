---
title: 'TEMPORARY: SVG Label Stress Test'
type: er
variant: svg-download
tags:
  - temporary
  - svg
  - long-labels
config:
  htmlLabels: true
  er:
    layoutDirection: LR
expect: Long bilingual entity aliases and relationship labels remain visible,Dense attribute lists keep stable row height and box dimensions
notes:
  - Temporary manual test fixture; delete after comparing faithful and portable downloads
---

```mermaid
erDiagram
  direction LR

  CUSTOMER_PROFILE["顧客帳戶與偏好設定 Customer Profile"] {
    uuid customer_profile_id PK "主要識別碼／Primary identifier"
    string display_name "顯示名稱與公開暱稱"
    string preferred_locale "偏好的語系與區域設定"
    string notification_preference "很長的電子郵件、推播與簡訊通知偏好說明"
    datetime created_at "建立時間／Creation timestamp"
  }

  PURCHASE_ORDER["跨境電子商務採購訂單 International Purchase Order"] {
    uuid purchase_order_id PK "訂單主要識別碼"
    uuid customer_profile_id FK "對應顧客帳戶"
    decimal total_amount "包含稅額、折扣與運費的最終金額"
    string settlement_currency "結算幣別／Settlement currency"
    string fulfillment_status "揀貨、包裝、出貨與送達狀態"
    datetime placed_at "顧客完成下單的時間"
  }

  PAYMENT_ATTEMPT["付款授權與風險審查紀錄 Payment Authorization Attempt"] {
    uuid payment_attempt_id PK "付款嘗試主要識別碼"
    uuid purchase_order_id FK "對應採購訂單"
    string payment_provider "第三方付款服務供應商名稱"
    string authorization_status "授權成功、拒絕或等待人工審查"
    string risk_review_summary "刻意很長的風險審查結果與人工處理說明"
    datetime attempted_at "付款授權嘗試時間"
  }

  FULFILLMENT_EVENT["物流履約與配送追蹤事件 Fulfillment Tracking Event"] {
    uuid fulfillment_event_id PK "物流事件主要識別碼"
    uuid purchase_order_id FK "對應採購訂單"
    string event_type "已揀貨、已出貨、清關中或已送達"
    string location_description "包含城市、國家與轉運中心的完整位置描述"
    string customer_message "顯示給顧客的雙語物流進度訊息"
    datetime occurred_at "物流事件發生時間"
  }

  CUSTOMER_PROFILE ||--o{ PURCHASE_ORDER : "建立並管理多筆跨境訂單／creates and manages orders"
  PURCHASE_ORDER ||--o{ PAYMENT_ATTEMPT : "可能進行多次付款授權與風險審查"
  PURCHASE_ORDER ||--o{ FULFILLMENT_EVENT : "產生完整的物流履約與配送追蹤歷程"
```
