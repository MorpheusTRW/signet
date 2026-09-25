const { withAppBuildGradle, withGradleProperties } = require('expo/config-plugins')

// Firma la build release con la chiave letta da `keystore.properties` (gitignored)
// invece che con la chiave di debug del template Expo. Se il file manca, la build
// release FALLISCE: mai pubblicare per errore un APK firmato con la chiave di debug.
const MARKER = '// seeker-signal: release signing'

const LOAD_PROPERTIES = `${MARKER}
def keystorePropertiesFile = rootProject.file("../keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystorePropertiesFile.withInputStream { keystoreProperties.load(it) }
}
`

const RELEASE_SIGNING_CONFIG = `        release {
            if (keystorePropertiesFile.exists()) {
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
            }
        }
`

// Il Seeker è arm64: compilare solo quell'ABI dimezza l'APK (meno costo di upload su ArDrive).
function withArm64Only(config) {
  return withGradleProperties(config, (mod) => {
    const key = 'reactNativeArchitectures'
    mod.modResults = mod.modResults.filter((item) => !(item.type === 'property' && item.key === key))
    mod.modResults.push({ type: 'property', key, value: 'arm64-v8a' })
    return mod
  })
}

module.exports = function withReleaseSigning(config) {
  return withArm64Only(withReleaseSigningGradle(config))
}

function withReleaseSigningGradle(config) {
  return withAppBuildGradle(config, (mod) => {
    let gradle = mod.modResults.contents
    if (gradle.includes(MARKER)) return mod

    gradle = gradle.replace(/^android \{/m, `${LOAD_PROPERTIES}\nandroid {`)

    // Aggiunge signingConfigs.release accanto a quello di debug.
    gradle = gradle.replace(/(signingConfigs \{\s*debug \{[\s\S]*?\n        \}\n)/, `$1${RELEASE_SIGNING_CONFIG}`)

    // Il buildType release usa la chiave release e si ferma se manca il keystore.
    gradle = gradle.replace(
      /(release \{\s*\/\/ Caution![\s\S]*?)signingConfig signingConfigs\.debug/,
      `$1if (!keystorePropertiesFile.exists()) {
                throw new GradleException("keystore.properties mancante: la build release non può essere firmata")
            }
            signingConfig signingConfigs.release`,
    )

    mod.modResults.contents = gradle
    return mod
  })
}
