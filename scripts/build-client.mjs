import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { build } from 'esbuild'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const result = await build({
  absWorkingDir: root,
  entryPoints: ['./src/client/index.jsx'],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: ['es2022'],
  jsx: 'transform',
  jsxFactory: 'React.createElement',
  jsxFragment: 'React.Fragment',
  external: ['react', 'react/jsx-runtime', '@deepseek-ai/dsh-client-ui-primitives'],
  write: false,
  minify: false,
  sourcemap: false,
  logLevel: 'info',
})

const body = result.outputFiles[0].text
const wrapped = `window.__ModuleLoader__.load({
  id: "dsh-taskify",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
${body}
    return module.exports;
  }
});
`
writeFileSync(join(root, 'client.js'), wrapped)
