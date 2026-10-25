import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, Switch, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Tag } from '@/components/Badge';
import { Button } from '@/components/Button';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { ListRow } from '@/components/ListRow';
import { LoginSheet } from '@/components/LoginSheet';
import { Screen } from '@/components/Screen';
import { SectionCard } from '@/components/SectionCard';
import { TextField } from '@/components/TextField';
import { showToast } from '@/components/Toast';
import { config } from '@/config';
import { saveAccount, useAccount } from '@/data/account';
import { clearCustomer, useSavedCustomer } from '@/data/customer';
import { useFavouriteIds } from '@/data/favourites';
import { answerNotifications, useNotificationAnswer } from '@/data/notifications';
import { useOnline } from '@/data/online';
import { forgetOrders, isInProgress, useMyOrders } from '@/data/orders';
import { useDeleteAccount } from '@/data/queries';
import { colors, fontFamily, size, space } from '@/theme';
import { maskPhone } from '@/utils/phone';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

/**
 * Compte (Feature 11): profile or "Se connecter", Mes achats, Paramètres, sign out, delete account.
 * Seller tools ("Ma boutique") wait for the client's answer on v1 or v1.1.
 */
export default function CompteScreen() {
  const router = useRouter();
  const online = useOnline();
  const account = useAccount();
  const customer = useSavedCustomer();
  const orders = useMyOrders();
  const favourites = useFavouriteIds();
  const notifications = useNotificationAnswer();
  const deleteAccount = useDeleteAccount();

  const [loginOpen, setLoginOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [deleteError, setDeleteError] = useState<string | undefined>();

  const inProgress = orders.filter(isInProgress).length;
  const commune = customer?.address.split(',')[0].trim();
  const notifyOn = notifications?.answer === 'yes';

  /** Leave no personal data on a shared phone. Favourites and the cart are not personal: they stay. */
  const signOut = () => {
    saveAccount(null);
    clearCustomer();
    forgetOrders();
  };

  const support = () => {
    const url = config.supportWhatsapp
      ? `https://wa.me/${config.supportWhatsapp}?text=${encodeURIComponent('Bonjour LOCAPPCI, j’ai besoin d’aide.')}`
      : config.website;
    Linking.openURL(url).catch(() => showToast('Impossible d’ouvrir le lien sur ce téléphone.'));
  };

  return (
    <Screen>
      <AppText variant="screenTitle" accessibilityRole="header" style={styles.title}>
        Mon compte
      </AppText>

      {account ? (
        <View style={styles.profile}>
          <View style={styles.avatar}>
            <AppText variant="headerTitle" color={colors.brand.navyDark}>
              {initials(account.name)}
            </AppText>
          </View>
          <View style={styles.flex}>
            <AppText variant="cardTitle">{account.name}</AppText>
            <AppText variant="meta" color={colors.text.muted}>
              {[maskPhone(account.phone), commune].filter(Boolean).join(' · ')}
            </AppText>
          </View>
        </View>
      ) : (
        <SectionCard>
          <View style={styles.profile}>
            <View style={styles.avatar}>
              <Feather name="user" size={22} color={colors.brand.navyDark} />
            </View>
            <View style={styles.flex}>
              <AppText variant="cardTitle">Bienvenue sur LOCAPPCI</AppText>
              <AppText variant="meta" color={colors.text.muted}>
                Pas besoin de compte pour commander. Connectez-vous pour retrouver vos commandes partout.
              </AppText>
            </View>
          </View>
          <Button label="Se connecter" onPress={() => setLoginOpen(true)} />
        </SectionCard>
      )}

      <SectionCard title="Mes achats">
        <ListRow
          icon="package"
          label="Mes commandes"
          right={inProgress > 0 ? <Tag label={`${inProgress} en cours`} /> : undefined}
          onPress={() => router.push('/commandes')}
        />
        <ListRow
          icon="heart"
          label="Favoris"
          right={favourites.size > 0 ? <Count value={favourites.size} /> : undefined}
          onPress={() => router.navigate('/favoris')}
        />
        <ListRow
          icon="map-pin"
          label="Adresses de livraison"
          hint={customer ? customer.address || 'Retrait en boutique' : 'Aucune adresse enregistrée'}
          onPress={() => router.push('/adresses')}
        />
      </SectionCard>

      <SectionCard title="Paramètres">
        <ListRow
          icon="bell"
          label="Notifications"
          hint="Suivi de mes commandes"
          noChevron
          onPress={() => answerNotifications(notifyOn ? 'no' : 'yes')}
          right={
            <Switch
              value={notifyOn}
              onValueChange={(on) => answerNotifications(on ? 'yes' : 'no')}
              trackColor={{ true: colors.brand.navy, false: colors.border.input }}
              thumbColor={colors.surface.card}
              accessibilityLabel="Notifications de suivi de commande"
            />
          }
        />
        <ListRow icon="message-circle" label="Aide et support WhatsApp" onPress={support} />
        <ListRow
          icon="file-text"
          label="Conditions et confidentialité"
          onPress={() => Linking.openURL(config.legalUrl).catch(() => undefined)}
        />
      </SectionCard>

      {account ? (
        <SectionCard>
          <ListRow icon="log-out" label="Se déconnecter" noChevron onPress={() => setLogoutOpen(true)} />
          <ListRow
            icon="trash-2"
            label="Supprimer mon compte"
            danger
            noChevron
            onPress={() => {
              setPassword('');
              setDeleteError(undefined);
              setDeleteOpen(true);
            }}
          />
        </SectionCard>
      ) : null}

      <AppText variant="caption" color={colors.text.muted} style={styles.version}>
        {`LOCAPPCI · version ${config.appVersion}`}
      </AppText>

      {/* Development only: never shown in a store build. */}
      {__DEV__ ? (
        <>
          <Button label="Voir les composants (dev)" variant="outline" icon="grid" onPress={() => router.push('/composants')} />
          <Button label="Voir les données (dev)" variant="outline" icon="database" onPress={() => router.push('/donnees')} />
        </>
      ) : null}

      <LoginSheet visible={loginOpen} onClose={() => setLoginOpen(false)} />

      <ConfirmSheet
        visible={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        title="Se déconnecter ?"
        message="Vos coordonnées et la liste de vos commandes seront effacées de ce téléphone. Vos favoris et votre panier restent."
        confirmLabel="Se déconnecter"
        onConfirm={() => {
          signOut();
          setLogoutOpen(false);
          showToast('Vous êtes déconnecté.');
        }}
      />

      <ConfirmSheet
        visible={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Supprimer mon compte ?"
        message="Votre compte et vos données personnelles seront supprimés. Les commandes déjà passées restent chez les boutiques pour la livraison et la facture. C’est définitif."
        confirmLabel="Supprimer définitivement"
        loading={deleteAccount.isPending}
        disabled={!online || password.length === 0}
        onConfirm={() => {
          if (!account) return;
          deleteAccount.mutate(
            { phone: account.phone, password },
            {
              onSuccess: () => {
                signOut();
                setDeleteOpen(false);
                showToast('Votre compte a été supprimé.');
              },
              onError: (e) => setDeleteError(e.message),
            },
          );
        }}>
        <TextField
          label="Mot de passe, pour confirmer"
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            setDeleteError(undefined);
          }}
          secureTextEntry
          autoCapitalize="none"
          error={deleteError ?? (!online ? 'Connexion internet nécessaire.' : undefined)}
        />
      </ConfirmSheet>
    </Screen>
  );
}

function Count({ value }: { value: number }) {
  return (
    <AppText variant="secondaryStrong" color={colors.text.muted} style={styles.count}>
      {String(value)}
    </AppText>
  );
}

const styles = StyleSheet.create({
  title: { paddingTop: space.lg },
  flex: { flex: 1 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.brand.navyTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: { fontFamily: fontFamily.semibold, minWidth: size.touch / 2, textAlign: 'right' },
  version: { textAlign: 'center' },
});
