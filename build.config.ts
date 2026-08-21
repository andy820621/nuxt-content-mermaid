import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: [
    {
      builder: 'copy',
      input: 'src/types',
      outDir: 'dist/types',
    },
  ],
  externals: ['mermaid'],
})
