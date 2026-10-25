import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { api, type RentalCalendar, type RentalProduct } from '@/api';
import { AppText } from '@/components/AppText';
import { BottomActionBar } from '@/components/BottomActionBar';
import { Button } from '@/components/Button';
import { CalendarSheet } from '@/components/CalendarSheet';
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
import { showToast } from '@/components/Toast';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import { addRentalToCart, useCartLine } from '@/data/cart';
import { useOnline } from '@/data/online';
import { keys, useCities, useRentalCalendar, useRentalCheck, useShop } from '@/data/queries';
import { colors, space } from '@/theme';
import {
  addDays,
  formatDayCompact,
  formatDays,
  formatDayShort,
  rentalDays,
  today,
  type IsoDate,
} from '@/utils/dates';
import { formatFcfa, formatTime } from '@/utils/format';
import { useGoBack } from '@/utils/navigation';

type StartChoice = 'today' | 'tomorrow' | 'other';

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/**
 * Location détail (Feature 7): pick a start day and a duration, see the return date,
 * the total and the deposit, then "Réserver". Booked days come from the rental calendar;
 * "Réserver" re-checks availability and price live before the booking goes in the cart.
 */
export function RentalDetail({ product: p, savedAt }: { product: RentalProduct; savedAt: number }) {
  const router = useRouter();
  const goBack = useGoBack();
  const queryClient = useQueryClient();
  const online = useOnline();
  const shop = useShop(p.shopId);
  const cities = useCities();
  const calendar = useRentalCalendar(p.id);
  const rentalCheck = useRentalCheck();
  const booking = useCartLine(p.id)?.rental;

  // Start from the booking already in the cart (if still in the future), else tomorrow.
  const [start, setStart] = useState<IsoDate>(() =>
    booking && booking.startDate >= today() ? booking.startDate : addDays(today(), 1),
  );
  const [days, setDays] = useState(() => clamp(booking?.days ?? p.minDays, p.minDays, p.maxDays));
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const choice: StartChoice = start === today() ? 'today' : start === addDays(today(), 1) ? 'tomorrow' : 'other';
  const bookedDates = useMemo(() => calendar.data?.bookedDates ?? [], [calendar.data]);
  const booked = useMemo(() => new Set(bookedDates), [bookedDates]);
  const conflict = rentalDays(start, days).find((d) => booked.has(d));
  const returnDate = addDays(start, days);
  const total = p.pricePerDay * days;

  const cityNames = useMemo(() => new Map((cities.data ?? []).map((c) => [c.id, c.name])), [cities.data]);
  const perDay = formatFcfa(p.pricePerDay);

  const reserve = () => {
    if (!online) {
      showToast('Connexion nécessaire pour vérifier les disponibilités avant de réserver.');
      return;
    }
    rentalCheck.mutate(
      { productId: p.id, request: { startDate: start, days, shownPricePerDay: p.pricePerDay } },
      {
        onSuccess: async (check) => {
          // Trust the live answer straight away: price, deposit and newly booked days.
          queryClient.setQueryData<RentalProduct>(keys.product(p.id), (old) =>
            old ? { ...old, pricePerDay: check.pricePerDay, deposit: check.deposit } : old,
          );
          if (!check.available) {
            queryClient.setQueryData<RentalCalendar>(keys.rentalCalendar(p.id), (old) => ({
              productId: p.id,
              bookedDates: [...new Set([...(old?.bookedDates ?? []), ...check.conflicts])],
            }));
            showToast('Ces dates viennent d’être réservées. Choisissez d’autres dates.');
            return;
          }

          // The shop name may still be loading if the person tapped very fast.
          const shopName =
            shop.data?.name ??
            (await queryClient
              .ensureQueryData({ queryKey: keys.shop(p.shopId), queryFn: () => api.getShop(p.shopId) })
              .then((s) => s.name)
              .catch(() => ''));

          const outcome = addRentalToCart({
            productId: p.id,
            name: p.name,
            coverUrl: p.images[0] ?? null,
            shopId: p.shopId,
            shopName,
            rental: { startDate: start, days, pricePerDay: check.pricePerDay, deposit: check.deposit },
          });

          const priceNote = check.priceChanged
            ? `Le prix a changé : ${formatFcfa(check.pricePerDay)} / jour. `
            : '';
          const message = outcome === 'added' ? 'Réservation ajoutée au panier.' : 'Réservation mise à jour.';
          showToast(priceNote + message, { label: 'Voir le panier', onPress: () => router.dismissTo('/panier') });
        },
        onError: (error) => showToast(error.message),
      },
    );
  };

  const reserveLabel = booking ? 'Modifier la réservation' : 'Réserver';

  return (
    <View style={styles.fill}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <PhotoHeader
          productId={p.id}
          images={p.images}
          name={p.name}
          shareMessage={`${p.name} – ${perDay} / jour\n${p.webUrl}`}
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
              <AppText variant="secondary" color={colors.text.muted}>
                {' / jour'}
              </AppText>
            </AppText>
            <AppText variant="meta" color={colors.text.body}>
              {`Caution : ${formatFcfa(p.deposit)}, rendue au retour du matériel`}
            </AppText>
          </View>

          <SectionCard title="Quand en avez-vous besoin ?">
            <View style={styles.choices} accessibilityRole="radiogroup">
              <OptionCard
                label="Aujourd’hui"
                hideRadio
                selected={choice === 'today'}
                onSelect={() => setStart(today())}
                style={styles.choice}
              />
              <OptionCard
                label="Demain"
                hideRadio
                selected={choice === 'tomorrow'}
                onSelect={() => setStart(addDays(today(), 1))}
                style={styles.choice}
              />
              <OptionCard
                label={choice === 'other' ? formatDayCompact(start) : 'Autre date'}
                hideRadio
                selected={choice === 'other'}
                onSelect={() => setCalendarOpen(true)}
                style={styles.choice}
              />
            </View>

            <View style={styles.duration}>
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

            {conflict ? (
              <AppText variant="meta" color={colors.status.danger} accessibilityRole="alert">
                {`Déjà réservé le ${formatDayShort(conflict)}. Changez la date ou la durée.`}
              </AppText>
            ) : (
              <AppText variant="meta" color={colors.text.muted} accessibilityLiveRegion="polite">
                {`${days === 1 ? `Le ${formatDayShort(start)}` : `Du ${formatDayShort(start)} au ${formatDayShort(addDays(returnDate, -1))}`}. Retour prévu le ${formatDayShort(returnDate)}.`}
              </AppText>
            )}
          </SectionCard>

          <SellerRow
            shop={shop.data}
            loading={shop.isPending}
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

      <BottomActionBar summary={`${formatDays(days)} · caution en plus`} total={formatFcfa(total)}>
        {shop.data?.whatsapp ? (
          <WhatsAppButton
            number={shop.data.whatsapp}
            name={shop.data.name}
            message={
              `Bonjour ${shop.data.name}, je voudrais louer « ${p.name} » ` +
              `${formatDays(days)} à partir du ${formatDayShort(start)} sur LOCAPPCI. Est-ce disponible ?\n${p.webUrl}`
            }
          />
        ) : null}
        <Button
          label={reserveLabel}
          disabled={!!conflict}
          loading={rentalCheck.isPending}
          onPress={reserve}
          style={styles.flex}
        />
      </BottomActionBar>

      <CalendarSheet
        visible={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        value={start}
        days={days}
        bookedDates={bookedDates}
        onChoose={setStart}
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
  choice: { flex: 1, justifyContent: 'center', paddingHorizontal: space.sm },
  duration: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
