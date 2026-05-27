/**
 * Roda após a compilação do preload (tsconfig.preload.json).
 *
 * Problema: o package.json raiz tem "type":"module", então Node.js trata
 * TODO .js como ESM — inclusive o preload compilado como CJS.
 * Solução: criar um package.json local dentro de electron-dist/preload/
 * declarando "type":"commonjs". Esse arquivo está mais próximo do preload.js
 * e sobrescreve o comportamento do raiz.
 */

import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dir  = join(root, 'electron-dist', 'preload')

mkdirSync(dir, { recursive: true })
writeFileSync(join(dir, 'package.json'), JSON.stringify({ type: 'commonjs' }, null, 2))

console.log('[postbuild] ✓ electron-dist/preload/package.json → type:commonjs')
