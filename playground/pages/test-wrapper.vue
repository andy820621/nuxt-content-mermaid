<template>
  <WrapperMermaid
    title="Demo Diagram"
    spinner="MySpinner"
  >
    <pre>
      <code>
        graph TD
        A --> B
        B --> C
        C --> D
        D --> E
        E --> G
        C --> G
        G --> A
      </code>
    </pre>
  </WrapperMermaid>
</template>
