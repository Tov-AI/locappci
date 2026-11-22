import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, View } from 'react-native';

import { api, ApiError, type SellerApplication } from '@/api';
import { AppText } from '@/components/AppText';
import { Tag } from '@/components/Badge';
import { Button } from '@/components/Button';
import { CityPickerSheet } from '@/components/CityPickerSheet';
import { IconButton } from '@/components/IconButton';
import { ListRow } from '@/components/ListRow';
import { LoginSheet } from '@/components/LoginSheet';
import { Screen } from '@/components/Screen';
import { SectionCard } from '@/components/SectionCard';
import { TextField } from '@/components/TextField';
import { showToast } from '@/components/Toast';
import { useAccount } from '@/data/account';
import { useCities, useLocappciWhatsapp } from '@/data/queries';
import { SELLER_STATUS, useSellerProducts } from '@/data/sellerProducts';
import { colors, radius, space } from '@/theme';
import { formatFcfa } from '@/utils/format';
import { useGoBack } from '@/utils/navigation';
import { formatPhone, normalizePhone, PHONE_PLACEHOLDER } from '@/utils/phone';

type Errors = {
  shopName?: string;
  cityId?: string;
  whatsapp?: string;
  photo?: string;
  form?: string;
};

/**
 * « Devenir vendeur » (client, 21 Nov): a signed-in customer asks to open a shop (one per seller).
 * The owner checks the ID photo and the WhatsApp number (the seller sends a code to LOCAPPCI on WhatsApp),
 * then validates in WordPress. Same shop record as the website.
 */
export default function VendeurScreen() {
  const goBack = useGoBack();
  const account = useAccount();
  const queryClient = useQueryClient();
  const cities = useCities();
  const locappciWhatsapp = useLocappciWhatsapp();
  const [loginOpen, setLoginOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  const application = useQuery({
    queryKey: ['sellerApplication', account?.phone ?? account?.email ?? ''],
    queryFn: () => api.getSellerApplication(),
    enabled: !!account,
    staleTime: 0,
  });
  const a = application.data;
  const cityName = (id: string | null) => cities.data?.find((c) => c.id === id)?.name ?? '';

  // ---- form
  const [shopName, setShopName] = useState('');
  const [cityId, setCityId] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<{ uri: string; base64: string } | null>(null);
  const [cityOpen, setCityOpen] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [sending, setSending] = useState(false);

  // Pre-fill from the request (correcting it) or the account.
  useEffect(() => {
    if (!a) return;
    setShopName((v) => v || a.shopName || '');
    setCityId((v) => v || a.cityId || '');
    setWhatsapp((v) => v || (a.whatsapp ? formatPhone(a.whatsapp) : account?.phone ? formatPhone(account.phone) : ''));
    setDescription((v) => v || a.description || '');
  }, [a, account]);

  const pick = async (camera: boolean) => {
    if (camera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        showToast('Autorisez l’appareil photo dans les réglages du téléphone, ou choisissez une photo.');
        return;
      }
    }
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      quality: 0.5,
      base64: true,
    };
    const result = camera
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset?.base64) {
      showToast('Photo illisible. Réessayez.');
      return;
    }
    setPhoto({ uri: asset.uri, base64: asset.base64 });
    setErrors((e) => ({ ...e, photo: undefined }));
  };

  const submit = async () => {
    const wa = normalizePhone(whatsapp);
    const needPhoto = !(a?.status === 'pending');
    const next: Errors = {
      shopName: shopName.trim().length < 2 ? 'Indiquez le nom de la boutique.' : undefined,
      cityId: cityId ? undefined : 'Choisissez la commune de la boutique.',
      whatsapp: wa ? undefined : 'Numéro WhatsApp invalide (ex. 07 00 00 00 00 ou +33 6…).',
      photo: needPhoto && !photo ? 'Ajoutez une photo de votre pièce d’identité.' : undefined,
    };
    setErrors(next);
    if (next.shopName || next.cityId || next.whatsapp || next.photo || !wa) return;
    setSending(true);
    try {
      const saved = await api.sendSellerApplication({
        shopName: shopName.trim(),
        cityId,
        whatsapp: wa,
        description: description.trim() || undefined,
        idPhoto: photo?.base64,
      });
      queryClient.setQueryData(['sellerApplication', account?.phone ?? account?.email ?? ''], saved);
      setEditing(false);
      setPhoto(null);
      showToast('Demande envoyée. Envoyez maintenant le code à LOCAPPCI sur WhatsApp.');
    } catch (e) {
      setErrors({
        form: e instanceof ApiError ? e.message : 'Envoi impossible. Réessayez.',
      });
    } finally {
      setSending(false);
    }
  };

  const sendCode = (app: SellerApplication) => {
    if (!locappciWhatsapp || !app.verifyCode) return;
    const text = `Bonjour LOCAPPCI, voici mon code vendeur : ${app.verifyCode} (boutique « ${app.shopName ?? ''} »).`;
    Linking.openURL(`https://wa.me/${locappciWhatsapp}?text=${encodeURIComponent(text)}`).catch(() =>
      showToast('WhatsApp n’est pas installé sur ce téléphone.'),
    );
  };

  const header = (
    <View style={styles.header}>
      <IconButton icon="arrow-left" accessibilityLabel="Retour" bordered onPress={goBack} />
      <AppText variant="headerTitle" accessibilityRole="header">
        Vendre sur LOCAPPCI
      </AppText>
    </View>
  );

  if (!account) {
    return (
      <Screen>
        {header}
        <SectionCard>
          <AppText variant="secondary" color={colors.text.body}>
            Ouvrez votre boutique sur LOCAPPCI. Connectez-vous ou créez d’abord votre compte.
          </AppText>
          <Button label="Se connecter ou créer un compte" onPress={() => setLoginOpen(true)} />
        </SectionCard>
        <LoginSheet visible={loginOpen} onClose={() => setLoginOpen(false)} />
      </Screen>
    );
  }

  if (application.isPending) {
    return (
      <Screen>
        {header}
        <AppText variant="secondary" color={colors.text.muted}>
          Chargement…
        </AppText>
      </Screen>
    );
  }

  if (application.isError || !a) {
    return (
      <Screen>
        {header}
        <SectionCard>
          <AppText variant="secondary">Impossible de charger votre demande.</AppText>
          <Button label="Réessayer" variant="outline" onPress={() => application.refetch()} />
        </SectionCard>
      </Screen>
    );
  }

  if (a.status === 'approved') {
    return (
      <Screen>
        {header}
        <SectionCard title={a.shopName ?? 'Ma boutique'}>
          <Tag label="Boutique validée" tone="green" />
          {a.cityId ? (
            <AppText variant="meta" color={colors.text.muted}>
              {cityName(a.cityId)}
            </AppText>
          ) : null}
        </SectionCard>
        <SellerProductsList />
      </Screen>
    );
  }

  if (a.status === 'pending' && !editing) {
    return (
      <Screen>
        {header}
        <SectionCard title={a.shopName ?? 'Ma boutique'}>
          <Tag label="Demande en vérification" />
          <AppText variant="secondary" color={colors.text.body}>
            LOCAPPCI vérifie votre pièce d’identité et votre numéro. Pour prouver que ce WhatsApp est bien le vôtre,
            envoyez ce code à LOCAPPCI depuis ce numéro :
          </AppText>
          <View style={styles.code}>
            <AppText variant="display" color={colors.brand.navy} selectable>
              {a.verifyCode ?? '—'}
            </AppText>
            {a.whatsapp ? (
              <AppText variant="meta" color={colors.text.muted}>
                {`Depuis le ${formatPhone(a.whatsapp)}`}
              </AppText>
            ) : null}
          </View>
          <Button label="Envoyer le code sur WhatsApp" icon="message-circle" onPress={() => sendCode(a)} />
          <Button label="Modifier ma demande" variant="outline" onPress={() => setEditing(true)} />
        </SectionCard>
      </Screen>
    );
  }

  // none, refused, or correcting a pending request
  return (
    <Screen>
      {header}
      {a.status === 'refused' ? (
        <SectionCard title="Demande refusée">
          <AppText variant="secondary" color={colors.status.danger}>
            {a.refusalReason ?? 'Informations incomplètes.'}
          </AppText>
          <AppText variant="meta" color={colors.text.muted}>
            Corrigez puis renvoyez votre demande, avec une nouvelle photo de la pièce.
          </AppText>
        </SectionCard>
      ) : (
        <AppText variant="meta" color={colors.text.muted}>
          Une boutique par vendeur. LOCAPPCI vérifie votre identité et votre numéro avant de valider la boutique.
        </AppText>
      )}
      <SectionCard title="Votre boutique">
        <TextField
          label="Nom de la boutique"
          placeholder="Ex. : Koné Électro"
          value={shopName}
          maxLength={60}
          onChangeText={(v) => (setShopName(v), setErrors((e) => ({ ...e, shopName: undefined })))}
          error={errors.shopName}
        />
        <ListRow
          icon="map-pin"
          label="Commune de la boutique"
          hint={cityId ? cityName(cityId) : 'Choisir'}
          onPress={() => setCityOpen(true)}
        />
        {errors.cityId ? (
          <AppText variant="meta" color={colors.status.danger}>
            {errors.cityId}
          </AppText>
        ) : null}
        <TextField
          label="WhatsApp de la boutique"
          placeholder={PHONE_PLACEHOLDER}
          keyboardType="phone-pad"
          value={whatsapp}
          onChangeText={(v) => (setWhatsapp(v), setErrors((e) => ({ ...e, whatsapp: undefined })))}
          error={errors.whatsapp}
        />
        <TextField
          label="Ce que vous vendez (facultatif)"
          placeholder="Ex. : électroménager neuf, livraison à Abidjan"
          value={description}
          maxLength={1000}
          multiline
          onChangeText={setDescription}
        />
      </SectionCard>
      <SectionCard title="Pièce d’identité">
        <AppText variant="meta" color={colors.text.muted}>
          CNI, passeport ou permis. Elle sert seulement à la vérification et est supprimée après la décision de
          LOCAPPCI.
        </AppText>
        {photo ? (
          <Image source={{ uri: photo.uri }} style={styles.preview} accessibilityLabel="Photo de la pièce" />
        ) : null}
        {!photo && a.status === 'pending' ? (
          <AppText variant="meta" color={colors.text.muted}>
            Photo déjà envoyée. Ajoutez-en une autre seulement pour la remplacer.
          </AppText>
        ) : null}
        <View style={styles.row}>
          <Button
            label="Prendre une photo"
            icon="camera"
            variant="outline"
            style={styles.flex}
            onPress={() => pick(true)}
          />
          <Button label="Galerie" icon="image" variant="outline" style={styles.flex} onPress={() => pick(false)} />
        </View>
        {errors.photo ? (
          <AppText variant="meta" color={colors.status.danger}>
            {errors.photo}
          </AppText>
        ) : null}
      </SectionCard>
      {errors.form ? (
        <AppText variant="secondary" color={colors.status.danger}>
          {errors.form}
        </AppText>
      ) : null}
      <Button
        label={a.status === 'pending' ? 'Enregistrer les modifications' : 'Envoyer ma demande'}
        loading={sending}
        onPress={submit}
      />
      {editing ? <Button label="Annuler" variant="outline" onPress={() => setEditing(false)} /> : null}

      <CityPickerSheet
        visible={cityOpen}
        onClose={() => setCityOpen(false)}
        selected={cityId}
        title="Commune de la boutique"
        onChoose={(id) => (setCityId(id), setErrors((e) => ({ ...e, cityId: undefined })))}
      />
    </Screen>
  );
}

/** « Mes articles »: the seller's sale articles with their state, and « Ajouter un article ». */
function SellerProductsList() {
  const router = useRouter();
  const list = useSellerProducts();
  return (
    <SectionCard title="Mes articles">
      <Button label="Ajouter un article" icon="plus" onPress={() => router.push('/article-vendeur')} />
      {list.isPending ? (
        <AppText variant="meta" color={colors.text.muted}>
          Chargement…
        </AppText>
      ) : list.isError ? (
        <Button label="Réessayer" variant="outline" onPress={() => list.refetch()} />
      ) : list.data.length === 0 ? (
        <AppText variant="meta" color={colors.text.muted}>
          Aucun article pour l’instant. Chaque nouvel article est vérifié par LOCAPPCI avant d’être visible.
        </AppText>
      ) : (
        list.data.map((p) => (
          <Pressable
            key={p.id}
            style={styles.item}
            accessibilityRole="button"
            accessibilityLabel={`${p.name}, ${formatFcfa(p.price)}, ${SELLER_STATUS[p.status].label}`}
            onPress={() => router.push({ pathname: '/article-vendeur', params: { id: p.id } })}>
            {p.photos[0] ? <Image source={{ uri: p.photos[0] }} style={styles.thumb} /> : <View style={styles.thumb} />}
            <View style={styles.flex}>
              <AppText variant="bodyStrong" numberOfLines={1}>
                {p.name}
              </AppText>
              <AppText variant="meta" color={colors.text.muted}>
                {`${formatFcfa(p.price)}${p.stockQuantity !== null ? ` · ${p.stockQuantity} en stock` : ''}`}
              </AppText>
            </View>
            <Tag label={SELLER_STATUS[p.status].label} tone={SELLER_STATUS[p.status].tone} />
          </Pressable>
        ))
      )}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  code: {
    alignItems: 'center',
    gap: space.xs,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.surface.field,
  },
  preview: {
    width: '100%',
    height: 180,
    borderRadius: radius.lg,
    resizeMode: 'cover',
  },
  row: { flexDirection: 'row', gap: space.sm },
  flex: { flex: 1 },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.xs },
  thumb: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.surface.field },
});
