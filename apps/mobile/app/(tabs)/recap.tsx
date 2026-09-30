import Clipboard from '@react-native-clipboard/clipboard'
import { useQuery } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { Asset, requestPermissionsAsync } from 'expo-media-library'
import * as Sharing from 'expo-sharing'
import { useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'
import { captureRef } from 'react-native-view-shot'
import { useMobileWallet } from '@wallet-ui/react-native-web3js'
import { ConnectHero } from '@/components/connect-hero'
import { FingerprintRings } from '@/components/fingerprint-rings'
import { Button } from '@/components/ui/button'
import { Screen } from '@/components/ui/screen'
import { Text } from '@/components/ui/text'
import { fonts, motion, palette } from '@/constants/theme'
import { getRecap } from '@/lib/api/client'
import type { RecapResponse } from '@/lib/api/types'
import { formatError } from '@/utils/format-error'

/** Gli anelli pari dell'impronta più quello esterno, come sfondo della card. */
const CARD_RINGS = [1, 3, 5, 6]

function caption(recap: RecapResponse): string {
  return `Signet · week ${recap.week}: kept out of ${recap.rugsDodged} rugs, ${recap.streakDays}-day discipline streak. Built for Solana Seeker.`
}

/** La card che diventa immagine: niente importi né profitti, solo rug evitati e costanza. */
function RecapCard({ recap }: { recap: RecapResponse | undefined }) {
  return (
    <View style={styles.card}>
      <FingerprintRings
        size={260}
        rings={CARD_RINGS}
        color={palette.onAccent}
        ringOpacity={() => 0.14}
        style={styles.cardRings}
      />
      <Text style={styles.cardTitle}>{recap ? `signet · week ${recap.week}` : 'signet'}</Text>
      <View style={{ gap: 4 }}>
        <Text style={styles.cardNumber}>{recap ? String(recap.rugsDodged) : '–'}</Text>
        <Text variant="heading" color={palette.onAccent} style={{ fontSize: 18 }}>
          rugs dodged
        </Text>
      </View>
      <View style={styles.tiles}>
        <View style={styles.tile}>
          <Text style={styles.tileNumber}>{recap ? String(recap.signalsApproved) : '–'}</Text>
          <Text variant="secondary" style={{ fontSize: 13 }}>
            signals approved
          </Text>
        </View>
        <View style={styles.tile}>
          <Text style={styles.tileNumber}>{recap ? `${recap.streakDays}d` : '–'}</Text>
          <Text variant="secondary" style={{ fontSize: 13 }}>
            discipline streak
          </Text>
        </View>
      </View>
      <Text variant="label" color={palette.onAccent}>
        Built for Solana Seeker
      </Text>
    </View>
  )
}

export default function RecapScreen() {
  const { account } = useMobileWallet()
  const pubkey = account?.address.toBase58()
  const cardRef = useRef<View>(null)
  const [note, setNote] = useState<string | null>(null)
  const [busy, setBusy] = useState<'share' | 'save' | null>(null)

  const query = useQuery({ queryKey: ['recap', pubkey], queryFn: () => getRecap(pubkey!), enabled: !!pubkey })

  if (!pubkey) return <ConnectHero />

  const capture = () => captureRef(cardRef, { format: 'png', quality: 1, result: 'tmpfile' })

  async function run(kind: 'share' | 'save', action: () => Promise<string>) {
    if (busy) return
    setBusy(kind)
    setNote(null)
    try {
      setNote(await action())
    } catch (error) {
      setNote(formatError(error))
    } finally {
      setBusy(null)
    }
  }

  const share = () =>
    run('share', async () => {
      if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.')
      const uri = await capture()
      // Il foglio di condivisione di Android passa solo l'immagine: il testo va in appunti, pronto da incollare.
      if (query.data) Clipboard.setString(caption(query.data))
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share on X' })
      return 'Caption copied: pick X and paste it in your post.'
    })

  const save = () =>
    run('save', async () => {
      const permission = await requestPermissionsAsync(true, ['photo'])
      if (!permission.granted) throw new Error('Photo access denied: allow it in Android settings to save the image.')
      await Asset.create(await capture())
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      return 'Saved to your photos.'
    })

  return (
    <Screen>
      <Text variant="label" style={{ marginTop: 8 }}>
        Your week · share it
      </Text>

      <Animated.View entering={FadeInDown.duration(motion.base)}>
        {/* collapsable={false}: su Android la view deve esistere nativamente per essere catturata. */}
        <View ref={cardRef} collapsable={false} style={{ backgroundColor: palette.bg }}>
          <RecapCard recap={query.data} />
        </View>
      </Animated.View>

      {query.isError ? <Text variant="secondary">Service unreachable. Pull to retry later.</Text> : null}

      <View style={{ flex: 1 }} />

      {note ? (
        <Animated.View entering={FadeIn.duration(motion.fast)}>
          <Text variant="secondary" style={{ textAlign: 'center' }}>
            {note}
          </Text>
        </Animated.View>
      ) : null}
      <View style={{ gap: 12, paddingBottom: 20 }}>
        <Button title="Share on X" variant="ivory" loading={busy === 'share'} disabled={!query.data} onPress={() => void share()} />
        <Button title="Save image" variant="ghost" loading={busy === 'save'} disabled={!query.data} onPress={() => void save()} />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  card: {
    gap: 22,
    padding: 26,
    borderRadius: 28,
    backgroundColor: palette.accent,
    overflow: 'hidden',
  },
  cardRings: { position: 'absolute', right: -80, top: -60 },
  cardTitle: { fontFamily: fonts.display, fontSize: 20, color: palette.onAccent },
  cardNumber: { fontFamily: fonts.display, fontSize: 72, lineHeight: 80, letterSpacing: -3, color: palette.onAccent },
  tiles: { flexDirection: 'row', gap: 12 },
  tile: { flex: 1, gap: 2, padding: 14, borderRadius: 16, backgroundColor: palette.bg },
  tileNumber: { fontFamily: fonts.display, fontSize: 28, lineHeight: 36, color: palette.text },
})
