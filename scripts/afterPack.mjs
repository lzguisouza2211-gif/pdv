import { readdirSync, rmSync } from 'fs'
import { join } from 'path'

const KEEP_LOCALES = new Set(['pt-BR.pak', 'en-US.pak'])

export default async function afterPack({ appOutDir }) {
  const localesDir = join(appOutDir, 'locales')

  let removed = 0
  for (const file of readdirSync(localesDir)) {
    if (!KEEP_LOCALES.has(file)) {
      rmSync(join(localesDir, file))
      removed++
    }
  }

  console.log(`afterPack: removidos ${removed} locales desnecessários (mantidos: pt-BR, en-US)`)
}
