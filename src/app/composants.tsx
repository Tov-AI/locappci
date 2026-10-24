import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { CountBadge, DotBadge, Tag } from '@/components/Badge';
import { BottomActionBar } from '@/components/BottomActionBar';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { FavouriteButton } from '@/components/FavouriteButton';
import { IconButton } from '@/components/IconButton';
import { OfflineBanner } from '@/components/OfflineBanner';
import { InitialTile, OptionCard } from '@/components/OptionCard';
import { Screen } from '@/components/Screen';
import { SectionCard } from '@/components/SectionCard';
import { Skeleton } from '@/components/Skeleton';
import { Stepper } from '@/components/Stepper';
import { TextField } from '@/components/TextField';
import { colors, radius, space } from '@/theme';

/**
 * Developer screen: every Feature 2 component in one place, interactive.
 * Opened from Compte › "Voir les composants" in development builds only.
 */
export default function ComposantsScreen() {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [pay, setPay] = useState<'wave' | 'om' | 'cod'>('wave');
  const [days, setDays] = useState(2);
  const [chip, setChip] = useState(false);
  const [phone, setPhone] = useState('');
  const [sheet, setSheet] = useState(false);
  const [loading, setLoading] = useState(false);

  const phoneError = phone.length > 0 && phone.replace(/\D/g, '').length < 10 ? 'Numéro incomplet : 10 chiffres attendus.' : undefined;

  const fakeLoad = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 1500);
  };

  return (
    <View style={styles.fill}>
      <Screen edges={['top']}>
        <View style={styles.header}>
          <IconButton icon="arrow-left" accessibilityLabel="Retour" bordered onPress={() => router.back()} />
          <AppText variant="headerTitle" accessibilityRole="header">
            Composants
          </AppText>
        </View>

        <Group title="Boutons">
          <Button label="Ajouter au panier" onPress={fakeLoad} loading={loading} />
          <Button label="WhatsApp" variant="outline" icon="message-circle" />
          <Button label="Épuisé" disabled />
          <View style={styles.row}>
            <Button label="Contacter sur WhatsApp" variant="outline" icon="message-circle" iconOnly />
            <Button label="Réserver" style={styles.grow} />
          </View>
          <AppText variant="caption" color={colors.text.muted}>
            Touchez « Ajouter au panier » : le bouton affiche un chargement 1,5 s.
          </AppText>
        </Group>

        <Group title="Boutons ronds et favori">
          <View style={[styles.row, styles.photo]}>
            <IconButton icon="arrow-left" accessibilityLabel="Retour" />
            <IconButton icon="share" accessibilityLabel="Partager" />
            <FavouriteButton saved={saved} onToggle={() => setSaved((s) => !s)} />
            <FavouriteButton saved={saved} onToggle={() => setSaved((s) => !s)} small />
          </View>
        </Group>

        <Group title="Badges et étiquettes">
          <View style={[styles.row, styles.center]}>
            <CountBadge count={1} />
            <CountBadge count={12} />
            <DotBadge />
            <Tag label="Location" />
            <Tag label="En stock" tone="green" />
            <Tag label="1 en cours" tone="navy" />
            <Tag label="v1.1" tone="neutral" />
          </View>
        </Group>

        <Group title="Puces">
          <View style={[styles.row, styles.wrap]}>
            <Chip label="Filtres · 2" icon="sliders" active onPress={() => {}} />
            <Chip label="Cocody" active={chip} onPress={() => setChip((c) => !c)} />
            <Chip label="Prix croissant" onPress={() => {}} />
            <Chip label="Services" muted />
          </View>
        </Group>

        <Group title="Choix (paiement)">
          <OptionCard
            label="Wave"
            hint="Paiement sécurisé, sans frais pour vous"
            leading={<InitialTile text="W" />}
            selected={pay === 'wave'}
            onSelect={() => setPay('wave')}
          />
          <OptionCard
            label="Orange Money"
            hint="Code de confirmation par SMS"
            leading={<InitialTile text="OM" />}
            selected={pay === 'om'}
            onSelect={() => setPay('om')}
          />
          <OptionCard
            label="Paiement à la livraison"
            hint="En espèces, après vérification"
            leading={<InitialTile text="₣" />}
            selected={pay === 'cod'}
            onSelect={() => setPay('cod')}
          />
        </Group>

        <Group title="Compteur">
          <View style={styles.between}>
            <AppText variant="secondaryStrong">Durée</AppText>
            <Stepper
              value={days}
              onChange={setDays}
              min={1}
              max={30}
              accessibilityLabel="Durée"
              format={(n) => `${n} jour${n > 1 ? 's' : ''}`}
            />
          </View>
        </Group>

        <Group title="Champ de texte">
          <TextField
            label="Téléphone"
            placeholder="+225 07 00 00 00 00"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            error={phoneError}
          />
        </Group>

        <Group title="Carte de section">
          <SectionCard title="Vos coordonnées">
            <AppText variant="meta" color={colors.text.body}>
              Pas besoin de compte. Vous pourrez le créer après le paiement.
            </AppText>
          </SectionCard>
          <SectionCard title="Gardez le suivi de vos commandes" highlighted>
            <AppText variant="meta" color={colors.text.body}>
              Carte mise en avant (bordure navy 2 pt).
            </AppText>
          </SectionCard>
        </Group>

        <Group title="Bandeau hors connexion">
          <View style={styles.bleed}>
            <OfflineBanner savedAt="14 h 32" />
          </View>
        </Group>

        <Group title="Chargement">
          <View style={styles.row}>
            <Skeleton width={92} height={92} />
            <View style={[styles.grow, { gap: space.sm }]}>
              <Skeleton height={14} width="80%" />
              <Skeleton height={16} width="45%" />
              <Skeleton height={12} width="60%" />
            </View>
          </View>
        </Group>

        <Group title="État vide">
          <SectionCard>
            <EmptyState
              icon="search"
              title="Aucun résultat"
              message="Essayez un autre mot ou retirez des filtres."
              actionLabel="Effacer les filtres"
              onAction={() => {}}
            />
          </SectionCard>
        </Group>

        <Group title="Panneau du bas">
          <Button label="Ouvrir les filtres" variant="outline" icon="sliders" onPress={() => setSheet(true)} />
        </Group>
      </Screen>

      <BottomActionBar summary="1 article · livraison incluse" total="20 000 FCFA">
        <Button label="Payer avec Wave" icon="lock" style={styles.grow} />
      </BottomActionBar>

      <BottomSheet
        visible={sheet}
        onClose={() => setSheet(false)}
        title="Filtres"
        headerAction={{ label: 'Réinitialiser', onPress: () => setChip(false) }}
        footer={<Button label="Afficher les résultats" onPress={() => setSheet(false)} />}>
        <View style={[styles.row, styles.wrap]}>
          <Chip label="Tout" active={!chip} onPress={() => setChip(false)} />
          <Chip label="Location" active={chip} onPress={() => setChip(true)} />
        </View>
      </BottomSheet>
    </View>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <AppText variant="metaStrong" color={colors.text.muted} style={styles.groupTitle}>
        {title.toUpperCase()}
      </AppText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.surface.ground },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingTop: space.md },
  group: { gap: space.md },
  groupTitle: { letterSpacing: 0.5 },
  row: { flexDirection: 'row', gap: space.md },
  wrap: { flexWrap: 'wrap', gap: space.sm },
  center: { alignItems: 'center', flexWrap: 'wrap' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  grow: { flex: 1 },
  photo: { alignItems: 'center', padding: space.md, borderRadius: radius.lg, backgroundColor: colors.brand.navyTint },
  bleed: { marginHorizontal: -space.gutter },
});
