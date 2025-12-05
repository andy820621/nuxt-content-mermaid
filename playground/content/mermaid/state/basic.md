---
title: State Diagram - basic patterns
type: state
variant: lifecycle-and-auth
tags:
  - stateDiagram
  - stateDiagram-v2
  - lifecycle
  - nested-states
config:
  state:
    nodeSpacing: 60
    rankSpacing: 80
    fontSize: 14
    radius: 4
    defaultRenderer: dagre-wrapper
expect: Demonstrates basic state transitions, start/end markers, labels, and a nested auth state machine.
notes:
  - Use this page to verify that state diagrams render correctly with the module and respond to theme changes.
  - Includes both a flat async request lifecycle and a nested login/auth flow to exercise composite states.
---

## Basic async request lifecycle

```mermaid
stateDiagram-v2
  [*] --> Idle
  Idle --> Loading: Click "Fetch data"
  Loading --> Success: 200 OK
  Loading --> Error: 4xx / 5xx
  Error --> Idle: Retry
  Success --> [*]
```

## Nested auth state machine

```mermaid
stateDiagram-v2
  [*] --> Auth
  Auth --> [*]: Logout

  state Auth {
    [*] --> LoggedOut
    LoggedOut --> LoggingIn: Submit credentials
    LoggingIn --> LoggedIn: Success
    LoggingIn --> LoginError: Failure
    LoginError --> LoggedOut: Retry
    LoggedIn --> LoggedOut: Logout
  }
```
