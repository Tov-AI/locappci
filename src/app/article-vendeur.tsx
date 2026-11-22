import { useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { api, ApiError, type SellerProduct, type SellerProductSend } from '@/api';
import { AppText } from '@/components/AppText';
import { Tag } from '@/components/Badge';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { ListRow } from '@/components/ListRow';
import { OptionCard } from '@/components/OptionCard';
import { Screen } from '@/components/Screen';
import { SectionCard } from '@/components/SectionCard';
import { TextField } from '@/components/TextField';
import { showToast } from '@/components/Toast';
import { useCategories } from '@/data/queries';
import { SELLER_STATUS, sellerProductsKey, useSellerProducts } from '@/data/sellerProducts';
import { colors, radius, space } from '@/theme';
import { formatFcfa } from '@/utils/format';
import { useGoBack } from '@/utils/navigation';

const MAX_PHOTOS = 5;

type Errors = {
  name?: string;
  price?: string;
  categoryId?: string;
  stock?: string;
  photos?: string;
  form?: string;
};

/**
 * Add or change one sale article (validated sellers). New articles, and changes to the name, description,
 * category or photos, are checked by LOCAPPCI before they show; price and stock changes show at once.
 */
export default function ArticleVendeurScreen() {
  const goBack = useGoBack();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const list = useSellerProducts();
  const current = id ? list.data?.find((p) => p.id === id) : undefined;
  const categories = useCategories('vente');

  const [name, setName] = useState<string | null>(null);
  const [price, setPrice] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [stock, setStock] = useState<string | null>(null);
  const [photos, setPhotos] = useState<{ uri: string; base64: string }[]>([]);
  const [catOpen, setCatOpen] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  // Fields start from the article being changed; null = untouched.
  const v = {
    name: name ?? current?.name ?? '',
    price: price ?? (current ? String(current.price) : ''),
    categoryId: categoryId ?? current?.categoryId ?? '',
    description: description ?? current?.description ?? '',
    stock: stock ?? (current?.stockQuantity != null ? String(current.stockQuantity) : ''),
  };

  const catName = useMemo(() => {
    const all = categories.data ?? [];
    const c = all.find((x) => x.id === v.categoryId);
    if (!c) return '';
    const parent = c.parentId ? all.find((x) => x.id === c.parentId) : undefined;
    return parent ? `${parent.name} › ${c.name}` : c.name;
  }, [categories.data, v.categoryId]);

  const pick = async (camera: boolean) => {
    if (photos.length >= MAX_PHOTOS) return showToast(`${MAX_PHOTOS} photos au plus.`);
    if (camera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted)
        return showToast('Autorisez l’appareil photo dans les réglages du téléphone, ou choisissez une photo.');
    }
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      quality: 0.6,
      base64: true,
    };
    const result = camera
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets[0]?.base64) return;
    const a = result.assets[0];
    setPhotos((p) => [...p, { uri: a.uri, base64: a.base64! }].slice(0, MAX_PHOTOS));
    setErrors((e) => ({ ...e, photos: undefined }));
  };

  const save = async () => {
    const priceN = Number(v.price.replace(/\s/g, ''));
    const stockN = v.stock.trim() === '' ? null : Number(v.stock);
    const next: Errors = {
      name: v.name.trim().length < 3 ? 'Indiquez le nom de l’article (3 caractères au moins).' : undefined,
      price: !Number.isInteger(priceN) || priceN < 100 ? 'Prix en FCFA, 100 au moins.' : undefined,
      categoryId: v.categoryId ? undefined : 'Choisissez une catégorie.',
      stock: stockN !== null && (!Number.isInteger(stockN) || stockN < 0) ? 'Quantité invalide.' : undefined,
      photos: !current && photos.length === 0 ? 'Ajoutez au moins une photo.' : undefined,
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    // Only what changed is sent, so a price change does not send the article back for checking.
    const body: SellerProductSend = {};
    if (!current || v.name.trim() !== current.name) body.name = v.name.trim();
    if (!current || priceN !== current.price) body.price = priceN;
    if (!current || v.categoryId !== current.categoryId) body.categoryId = v.categoryId;
    if (!current || v.description.trim() !== current.description) body.description = v.description.trim();
    if (!current || stockN !== current.stockQuantity) body.stockQuantity = stockN;
    if (photos.length) body.photos = photos.map((p) => p.base64);

    setSaving(true);
    try {
      const saved = current ? await api.updateSellerProduct(current.id, body) : await api.createSellerProduct(body);
      queryClient.setQueryData<SellerProduct[]>(sellerProductsKey, (old) => [
        saved,
        ...(old ?? []).filter((p) => p.id !== saved.id),
      ]);
      showToast(
        saved.status === 'pending' ? 'Enregistré. LOCAPPCI vérifie l’article avant de l’afficher.' : 'Enregistré.',
      );
      goBack();
    } catch (e) {
      setErrors({
        form: e instanceof ApiError ? e.message : 'Enregistrement impossible. Réessayez.',
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleHidden = async () => {
    if (!current) return;
    setSaving(true);
    try {
      const saved = await api.updateSellerProduct(current.id, {
        hidden: current.status !== 'hidden',
      });
      queryClient.setQueryData<SellerProduct[]>(sellerProductsKey, (old) =>
        (old ?? []).map((p) => (p.id === saved.id ? saved : p)),
      );
      showToast(saved.status === 'hidden' ? 'Article masqué.' : 'Article remis en ligne.');
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Un problème est survenu. Réessayez.');
    } finally {
      setSaving(false);
    }
  };

  const shownPhotos = photos.length ? photos.map((p) => p.uri) : (current?.photos ?? []);

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton icon="arrow-left" accessibilityLabel="Retour" bordered onPress={goBack} />
        <AppText variant="headerTitle" accessibilityRole="header">
          {current ? 'Modifier l’article' : 'Nouvel article'}
        </AppText>
      </View>

      {current ? (
        <View style={styles.statusRow}>
          <Tag label={SELLER_STATUS[current.status].label} tone={SELLER_STATUS[current.status].tone} />
          {current.refusalReason ? (
            <AppText variant="meta" color={colors.status.danger} style={styles.flex}>
              {current.refusalReason}
            </AppText>
          ) : null}
        </View>
      ) : null}

      <SectionCard title={`Photos (${MAX_PHOTOS} au plus)`}>
        {shownPhotos.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photos}>
            {shownPhotos.map((uri, i) => (
              <View key={uri + i}>
                <Image source={{ uri }} style={styles.photo} accessibilityLabel={`Photo ${i + 1}`} />
                {photos.length ? (
                  <Pressable
                    style={styles.remove}
                    accessibilityLabel={`Retirer la photo ${i + 1}`}
                    onPress={() => setPhotos((p) => p.filter((_, j) => j !== i))}>
                    <AppText variant="caption" color={colors.text.inverse}>
                      ✕
                    </AppText>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </ScrollView>
        ) : null}
        {current && !photos.length ? (
          <AppText variant="meta" color={colors.text.muted}>
            Ajoutez de nouvelles photos pour remplacer celles-ci (l’article sera vérifié à nouveau).
          </AppText>
        ) : null}
        <View style={styles.row}>
          <Button
            label="Appareil photo"
            icon="camera"
            variant="outline"
            style={styles.flex}
            onPress={() => pick(true)}
          />
          <Button label="Galerie" icon="image" variant="outline" style={styles.flex} onPress={() => pick(false)} />
        </View>
        {errors.photos ? (
          <AppText variant="meta" color={colors.status.danger}>
            {errors.photos}
          </AppText>
        ) : null}
      </SectionCard>

      <SectionCard title="L’article">
        <TextField
          label="Nom"
          placeholder="Ex. : Ventilateur sur pied 16 pouces"
          value={v.name}
          maxLength={120}
          onChangeText={(t) => (setName(t), setErrors((e) => ({ ...e, name: undefined })))}
          error={errors.name}
        />
        <TextField
          label="Prix (FCFA)"
          placeholder="Ex. : 18500"
          keyboardType="number-pad"
          value={v.price}
          onChangeText={(t) => (setPrice(t.replace(/[^0-9]/g, '')), setErrors((e) => ({ ...e, price: undefined })))}
          error={errors.price}
        />
        {v.price && Number(v.price) >= 100 ? (
          <AppText variant="meta" color={colors.text.muted}>
            {`Affiché : ${formatFcfa(Number(v.price))}`}
          </AppText>
        ) : null}
        <ListRow icon="tag" label="Catégorie" hint={catName || 'Choisir'} onPress={() => setCatOpen(true)} />
        {errors.categoryId ? (
          <AppText variant="meta" color={colors.status.danger}>
            {errors.categoryId}
          </AppText>
        ) : null}
        <TextField
          label="Quantité en stock (facultatif)"
          placeholder="Vide = toujours disponible"
          keyboardType="number-pad"
          value={v.stock}
          onChangeText={(t) => (setStock(t.replace(/[^0-9]/g, '')), setErrors((e) => ({ ...e, stock: undefined })))}
          error={errors.stock}
        />
        <TextField
          label="Description (facultatif)"
          placeholder="État, taille, couleur, livraison…"
          value={v.description}
          maxLength={3000}
          multiline
          onChangeText={setDescription}
        />
      </SectionCard>

      {errors.form ? (
        <AppText variant="secondary" color={colors.status.danger}>
          {errors.form}
        </AppText>
      ) : null}
      <Button label={current ? 'Enregistrer' : 'Envoyer à LOCAPPCI'} loading={saving} onPress={save} />
      {current ? (
        <Button
          label={current.status === 'hidden' ? 'Remettre en ligne' : 'Masquer l’article'}
          icon={current.status === 'hidden' ? 'eye' : 'eye-off'}
          variant="outline"
          loading={saving}
          onPress={toggleHidden}
        />
      ) : null}

      <BottomSheet visible={catOpen} onClose={() => setCatOpen(false)} title="Catégorie">
        {(categories.data ?? [])
          .filter((c) => c.parentId !== null || !(categories.data ?? []).some((x) => x.parentId === c.id))
          .map((c) => {
            const parent = c.parentId ? categories.data?.find((x) => x.id === c.parentId) : undefined;
            return (
              <OptionCard
                key={c.id}
                label={c.name}
                hint={parent?.name}
                selected={v.categoryId === c.id}
                onSelect={() => {
                  setCategoryId(c.id);
                  setErrors((e) => ({ ...e, categoryId: undefined }));
                  setCatOpen(false);
                }}
              />
            );
          })}
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  photos: { gap: space.sm },
  photo: { width: 96, height: 96, borderRadius: radius.md },
  remove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', gap: space.sm },
  flex: { flex: 1 },
});
