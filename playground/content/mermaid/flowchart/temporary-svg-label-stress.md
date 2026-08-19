---
title: 'TEMPORARY: SVG Label Stress Test'
type: flowchart
variant: svg-download
tags:
  - temporary
  - svg
  - markdown
config:
  htmlLabels: true
  markdownAutoWrap: true
  flowchart:
    wrappingWidth: 180
    curve: basis
expect: Bilingual Markdown labels keep their formatting and line wrapping,Long node, edge, and subgraph labels remain visible after SVG download
notes:
  - Temporary manual test fixture; delete after comparing faithful and portable downloads
---

```mermaid
flowchart LR
  subgraph CHECKOUT["`**結帳與付款流程**
  Checkout *and* payment workflow with a deliberately long bilingual subgraph label`"]
    START(["`**開始結帳**
    Start checkout`"])
    VERIFY["`**驗證顧客資料**
    Validate customer profile, shipping address, invoice preferences, and contact details.
    中文第二行用來觀察行高與自動換行。`"]
    PAY{"`**付款授權成功嗎？**
    Was payment *authorization* successful?`"}
  end

  START -->|"`**提交訂單**
  Submit a long bilingual edge label／送出包含多項商品的訂單`"| VERIFY
  VERIFY --> PAY
  PAY -->|"`**成功**
  Payment approved`"| DONE["`**建立訂單並寄送通知**
  Create the order, reserve inventory, and send a confirmation email.
  這段故意很長，用來比較 HTML 與原生 SVG 的換行。`"]
  PAY -->|"`*失敗*／Declined`"| RETRY["`**重新輸入付款資訊**
  Update card details and try again`"]
  RETRY --> PAY
```
