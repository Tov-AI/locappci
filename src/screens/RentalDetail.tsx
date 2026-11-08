import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { RentalProduct } from '@/api';
import { AppText } from '@/components/AppText';
import { BottomActionBar } from '@/components/BottomActionBar';
import { Button } from '@/components/Button';
import { CalendarSheet } from '@/components/CalendarSheet';
import { CityPickerSheet } from '@/components/CityPickerSheet';
import { Description } from '@/components/Description';
import { InfoBlock } from '@/components/InfoBlock';
import { OfflineBanner } from '@/components/OfflineBanner';
import { OptionCard } from '@/components/OptionCard';
import { PhotoHeader } from '@/components/PhotoHeader';
import { RentalTermsSheet } from '@/components/RentalTermsSheet';
import { ReportSheet } from '@/components/ReportSheet';
import { SectionCard } from '@/components/SectionCard';
import { SellerRow } from '@/components/SellerRow';
import { Stepper } from '@/components/Stepper';
import { clearToast, showToast } from '@/components/Toast';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import { useCity } from '@/data/city';
import { useOnline } from '@/data/online';
import { useCities, useShop } from '@/data/queries';
import { putRequestLine, useRequestLine } from '@/data/rentalRequest';
import { colors, radius, size, space } from '@/theme';
import { addDays, formatDayCompact, formatDays, formatDayShort, today, type IsoDate } from '@/utils/dates';
import { formatFcfa, formatTime } from '@/utils/format';
import { useGoBack } from '@/utils/navigation';

type StartChoice = 'today' | 'tomorrow' | 'other';

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const MAX_QUANTITY = 20;
const formatUnits = (n: number) => `${n} unité${n > 1 ? 's' : ''}`;

/**
 * Location détail (Feature 14, replaces the booking of Feature 7).
 * Like on the website, renting works by request: pick when, how long, how many and where,
 * then "Ajouter à ma demande". The loueur confirms availability and price; nothing is paid here.
 */
export function RentalDetail({ product: p, savedAt }: { product: RentalProduct; savedAt: number }) {
  const router = useRouter();
  const goBack = useGoBack();
  const online = useOnline();
  const shop = useShop(p.shopId);
  const cities = useCities();
  const myCity = useCity();
  const inRequest = useRequestLine(p.id);

  // Start from what is already in the request (if still in the future), else tomorrow.
  const [start, setStart] = useState<IsoDate>(() =>
    inRequest && inRequest.startDate >= today() ? inRequest.startDate : addDays(today(), 1),
  );
  const [days, setDays] = useState(() => clamp(inRequest?.days ?? p.minDays, p.minDays, p.maxDays));
  const [quantity, setQuantity] = useState(() => clamp(inRequest?.quantity ?? 1, 1, MAX_QUANTITY));
  // Where the item is needed: what was chosen before, else the person's commune, else the item's.
  const [cityId, setCityId] = useState(() => inRequest?.cityId || myCity || p.cityId);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  // A message about this product shouldn't follow the person to the next screen.
  useEffect(() => clearToast, []);

  const choice: StartChoice = start === today() ? 'today' : start === addDays(today(), 1) ? 'tomorrow' : 'other';
  const returnDate = addDays(start, days);
  const priced = p.pricePerDay > 0;
  const estimate = p.pricePerDay * days * quantity;

  const cityNames = useMemo(() => new Map((cities.data ?? []).map((c) => [c.id, c.name])), [cities.data]);
  const cityName = cityNames.get(cityId) ?? '';
  const perDay = priced ? formatFcfa(p.pricePerDay) : 'Prix à confirmer';

  const add = () => {
    const outcome = putRequestLine({
      productId: p.id,
      name: p.name,
      coverUrl: p.images[0] ?? null,
      shopId: p.shopId,
      shopName: shop.data?.name ?? '',
      pricePerDay: p.pricePerDay,
      minDays: p.minDays,
      maxDays: p.maxDays,
      startDate: start,
      days,
      quantity,
      cityId,
    });
    if (outcome === 'full') {
      showToast('Votre demande contient déjà 20 matériels. Envoyez-la avant d’en ajouter.', {
        label: 'Voir ma demande',
        onPress: () => router.push('/demande-location'),
      });
      return;
    }
    showToast(outcome === 'added' ? 'Ajouté à votre demande de location.' : 'Demande mise à jour.', {
      label: 'Voir ma demande',
      onPress: () => router.push('/demande-location'),
    });
  };

  const period =
    days === 1
      ? `Le ${formatDayShort(start)}`
      : `Du ${formatDayShort(start)} au ${formatDayShort(addDays(returnDate, -1))}`;

  return (
    <View style={styles.fill}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <PhotoHeader
          productId={p.id}
          images={p.images}
          name={p.name}
          shareMessage={`${p.name}${priced ? ` – ${perDay} / jour` : ''}\n${p.webUrl}`}
          onBack={goBack}
          rental
        />

        {!online ? <OfflineBanner savedAt={savedAt ? formatTime(savedAt) : undefined} /> : null}

        <View style={styles.body}>
          <View style={styles.titleBlock}>
            <AppText variant="productTitle" accessibilityRole="header">
              {p.name}
            </AppText>
            <AppText variant="display" color={colors.brand.navy}>
              {perDay}
              {priced ? (
                <AppText variant="secondary" color={colors.text.muted}>
                  {' / jour'}
                </AppText>
              ) : null}
            </AppText>
            {p.deposit > 0 ? (
              <AppText variant="meta" color={colors.text.body}>
                {`Caution demandée : ${formatFcfa(p.deposit)}, rendue au retour du matériel`}
              </AppText>
            ) : null}
            {p.condition ? (
              <AppText variant="meta" color={colors.text.body}>
                {`État : ${p.condition}`}
              </AppText>
            ) : null}
            {p.delivery ? (
              <AppText variant="meta" color={colors.text.body}>
                {p.delivery}
              </AppText>
            ) : null}
          </View>

          <SectionCard title="Votre demande">
            <AppText variant="secondaryStrong">À partir de quand ?</AppText>
            <View style={styles.choices} accessibilityRole="radiogroup">
              <OptionCard
                label="Aujourd’hui"
                compact
                selected={choice === 'today'}
                onSelect={() => setStart(today())}
                style={styles.choice}
              />
              <OptionCard
                label="Demain"
                compact
                selected={choice === 'tomorrow'}
                onSelect={() => setStart(addDays(today(), 1))}
                style={styles.choice}
              />
              <OptionCard
                label={choice === 'other' ? formatDayCompact(start) : 'Autre date'}
                compact
                selected={choice === 'other'}
                onSelect={() => setCalendarOpen(true)}
                style={styles.choice}
              />
            </View>

            <View style={styles.row}>
              <AppText variant="secondaryStrong">Durée</AppText>
              <Stepper
                value={days}
                onChange={setDays}
                min={p.minDays}
                max={p.maxDays}
                format={formatDays}
                accessibilityLabel="Durée de location"
              />
            </View>
            <AppText variant="meta" color={colors.text.muted} accessibilityLiveRegion="polite">
              {`${period}. Retour prévu le ${formatDayShort(returnDate)}.`}
            </AppText>

            <View style={styles.row}>
              <AppText variant="secondaryStrong">Quantité</AppText>
              <Stepper
                value={quantity}
                onChange={setQuantity}
                min={1}
                max={MAX_QUANTITY}
                format={formatUnits}
                accessibilityLabel="Quantité"
              />
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Commune d’utilisation : ${cityName || 'à choisir'}. Changer`}
              onPress={() => setCityOpen(true)}
              style={({ pressed }) => [styles.cityRow, pressed && styles.pressed]}>
              <Feather name="map-pin" size={18} color={colors.brand.navy} />
              <View style={styles.flex}>
                <AppText variant="caption" color={colors.text.muted}>
                  Commune d’utilisation
                </AppText>
                <AppText variant="secondaryStrong">{cityName || 'À choisir'}</AppText>
              </View>
              <AppText variant="secondaryStrong" color={colors.brand.navy}>
                Changer
              </AppText>
            </Pressable>

            <AppText variant="meta" color={colors.text.body}>
              Le loueur vous confirme la disponibilité et le prix. Rien n’est payé dans l’appli.
            </AppText>
          </SectionCard>

          <SellerRow
            shop={shop.data}
            loading={shop.isPending && shop.fetchStatus !== 'paused'}
            cityName={shop.data ? cityNames.get(shop.data.cityId) : undefined}
          />

          <Description text={p.description} />

          <InfoBlock
            icon="file-text"
            title="Avant de louer"
            text="Vérifiez le matériel au retrait, avec le loueur. Pièce d’identité demandée."
            links={[
              { label: 'Conditions de location', onPress: () => setTermsOpen(true) },
              { icon: 'flag', label: 'Signaler cette annonce', onPress: () => setReportOpen(true) },
            ]}
          />
        </View>
      </ScrollView>

      <BottomActionBar
        summary={`${formatDays(days)} · ${formatUnits(quantity)}`}
        total={priced ? `≈ ${formatFcfa(estimate)}` : 'Prix à confirmer'}>
        {shop.data?.whatsapp ? (
          <WhatsAppButton
            number={shop.data.whatsapp}
            name={shop.data.name}
            message={
              `Bonjour ${shop.data.name}, je voudrais louer « ${p.name} »` +
              `${quantity > 1 ? ` (${formatUnits(quantity)})` : ''} ${formatDays(days)} à partir du ${formatDayShort(start)}` +
              `${cityName ? ` à ${cityName}` : ''} sur LOCAPPCI. Est-ce disponible ?\n${p.webUrl}`
            }
          />
        ) : null}
        <Button
          label={inRequest ? 'Mettre à jour ma demande' : 'Ajouter à ma demande'}
          disabled={!cityName && !!cities.data}
          onPress={add}
          style={styles.flex}
        />
      </BottomActionBar>

      <CalendarSheet
        visible={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        value={start}
        days={days}
        bookedDates={[]}
        onChoose={setStart}
      />
      <CityPickerSheet
        visible={cityOpen}
        onClose={() => setCityOpen(false)}
        selected={cityId}
        onChoose={setCityId}
        title="Où en avez-vous besoin ?"
      />
      <RentalTermsSheet visible={termsOpen} onClose={() => setTermsOpen(false)} product={p} />
      <ReportSheet visible={reportOpen} onClose={() => setReportOpen(false)} productId={p.id} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.surface.card },
  flex: { flex: 1 },
  scroll: { paddingBottom: space.xxl },
  body: { padding: space.gutter, gap: space.xl },
  titleBlock: { gap: space.xs },
  choices: { flexDirection: 'row', gap: space.sm },
  choice: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: size.touch,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface.field,
  },
  pressed: { opacity: 0.7 },
});
