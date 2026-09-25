const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname)

// Cache transforms per project; the machine-wide Metro cache can serve stale transforms from other projects.
config.cacheStores = ({ FileStore }) => [
  new FileStore({ root: path.join(__dirname, 'node_modules', '.cache', 'metro') }),
]

// I package del monorepo (packages/shared) importano con estensione ".js"
// (richiesto da NodeNext) file che sono in realtà ".ts": Metro non lo sa
// risolvere da solo, quindi proviamo prima senza estensione.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('.') && moduleName.endsWith('.js')) {
    try {
      return context.resolveRequest(context, moduleName.slice(0, -3), platform)
    } catch {
      // ci sono davvero file .js: ricade sulla risoluzione normale
    }
  }
  return context.resolveRequest(context, moduleName, platform)
}

module.exports = config
