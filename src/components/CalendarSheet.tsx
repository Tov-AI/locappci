import Feather from '@expo/vector-icons/Feather';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { colors, fontFamily, radius, size, space } from '@/theme';
import {
  addDays,
  formatDayLong,
  formatDayShort,
  formatMonth,
  fromIsoDate,
  rentalDays,
  today,
  toIsoDate,
  type IsoDate,
} from '@/utils/dates';

/** How far ahead people can book. */
export const BOOKING_WINDOW_DAYS = 90;

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Start date currently chosen on the screen. */
  value: IsoDate;
  /** Rental length, to show the whole period on the calendar. */
  days: number;
  bookedDates: IsoDate[];
  onChoose: (start: IsoDate) => void;
};

/**
 * "Autre date": month calendar, weeks start on Monday (French habit).
 * Past days and days after the booking window can't be chosen; booked days are struck through.
 * The chosen period (start + duration) is shaded so the person sees what they book.
 */
export function CalendarSheet({ visible, onClose, value, days, bookedDates, onChoose }: Props) {
  const first = today();
  const last = addDays(first, BOOKING_WINDOW_DAYS - 1);
  const [draft, setDraft] = useState(value);
  const [month, setMonth] = useState(() => monthOf(value));

  // Each time the sheet opens, start from the date chosen on the screen.
  useEffect(() => {
    if (!visible) return;
    setDraft(value);
    setMonth(monthOf(value));
  }, [visible, value]);

  const booked = useMemo(() => new Set(bookedDates), [bookedDates]);
  const period = useMemo(() => new Set(rentalDays(draft, days)), [draft, days]);
  const conflict = rentalDays(draft, days).find((d) => booked.has(d));
  const cells = useMemo(() => monthCells(month.year, month.month), [month]);

  const canPrev = monthKey(month) > monthKey(monthOf(first));
  const canNext = monthKey(month) < monthKey(monthOf(last));
  const shift = (n: number) =>
    setMonth(({ year, month: m }) => {
      const d = new Date(year, m + n, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Date de début"
      footer={
        <View style={styles.footer}>
          {conflict ? (
            <AppText variant="meta" color={colors.status.danger} accessibilityRole="alert">
              {`Déjà réservé le ${formatDayShort(conflict)}. Choisissez un autre début ou une durée plus courte.`}
            </AppText>
          ) : null}
          <Button
            label={`Commencer le ${formatDayShort(draft)}`}
            disabled={!!conflict}
            onPress={() => {
              onChoose(draft);
              onClose();
            }}
          />
        </View>
      }>
      <View style={styles.monthBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mois précédent"
          accessibilityState={{ disabled: !canPrev }}
          disabled={!canPrev}
          onPress={() => shift(-1)}
          style={[styles.arrow, !canPrev && styles.hidden]}>
          <Feather name="chevron-left" size={22} color={colors.text.primary} />
        </Pressable>
        <AppText variant="bodyStrong" accessibilityRole="header" accessibilityLiveRegion="polite">
          {formatMonth(month.year, month.month)}
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mois suivant"
          accessibilityState={{ disabled: !canNext }}
          disabled={!canNext}
          onPress={() => shift(1)}
          style={[styles.arrow, !canNext && styles.hidden]}>
          <Feather name="chevron-right" size={22} color={colors.text.primary} />
        </Pressable>
      </View>

      <View>
        <View style={styles.week} importantForAccessibility="no-hide-descendants">
          {WEEKDAYS.map((d, i) => (
            <AppText key={i} variant="caption" color={colors.text.muted} style={styles.weekday}>
              {d}
            </AppText>
          ))}
        </View>
        <View style={styles.grid}>
          {cells.map((iso, i) => {
            if (!iso) return <View key={`empty-${i}`} style={styles.cell} />;
            const outside = iso < first || iso > last;
            const isBooked = booked.has(iso);
            const isStart = iso === draft;
            const inPeriod = period.has(iso);
            const disabled = outside || isBooked;
            const day = fromIsoDate(iso).getDate();
            return (
              <View key={iso} style={styles.cell}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${formatDayLong(iso)}${isBooked ? ', réservé' : ''}${inPeriod ? ', dans votre période' : ''}`}
                  accessibilityState={{ disabled, selected: isStart }}
                  disabled={disabled}
                  onPress={() => setDraft(iso)}
                  style={[
                    styles.day,
                    inPeriod && styles.inPeriod,
                    inPeriod && isBooked && styles.periodConflict,
                    isStart && styles.start,
                  ]}>
                  <AppText
                    variant="secondaryStrong"
                    color={
                      isStart
                        ? colors.text.inverse
                        : disabled
                          ? colors.text.placeholder
                          : colors.text.primary
                    }
                    style={isBooked ? styles.struck : undefined}>
                    {String(day)}
                  </AppText>
                </Pressable>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.legend} importantForAccessibility="no-hide-descendants">
        <View style={styles.legendItem}>
          <View style={[styles.swatch, styles.start]} />
          <AppText variant="caption" color={colors.text.muted}>
            Début
          </AppText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, styles.inPeriod]} />
          <AppText variant="caption" color={colors.text.muted}>
            Votre période
          </AppText>
        </View>
        <View style={styles.legendItem}>
          <AppText variant="caption" color={colors.text.placeholder} style={styles.struck}>
            12
          </AppText>
          <AppText variant="caption" color={colors.text.muted}>
            Déjà réservé
          </AppText>
        </View>
      </View>
    </BottomSheet>
  );
}

type Month = { year: number; month: number };

const monthOf = (iso: IsoDate): Month => {
  const d = fromIsoDate(iso);
  return { year: d.getFullYear(), month: d.getMonth() };
};
const monthKey = (m: Month) => m.year * 12 + m.month;

/** The month's days as ISO dates, with empty cells before the 1st so weeks start on Monday. */
export function monthCells(year: number, month: number): (IsoDate | null)[] {
  const firstDay = new Date(year, month, 1, 12);
  const lead = (firstDay.getDay() + 6) % 7; // Monday = 0 … Sunday = 6
  const count = new Date(year, month + 1, 0).getDate();
  const cells: (IsoDate | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= count; d++) cells.push(toIsoDate(new Date(year, month, d, 12)));
  return cells;
}

const styles = StyleSheet.create({
  footer: { gap: space.sm },
  monthBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrow: { width: size.touch, height: size.touch, alignItems: 'center', justifyContent: 'center' },
  hidden: { opacity: 0 },
  week: { flexDirection: 'row' },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', fontFamily: fontFamily.semibold, paddingBottom: space.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, height: size.touch, padding: 2 },
  day: { flex: 1, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  inPeriod: { backgroundColor: colors.brand.navyTint },
  periodConflict: { backgroundColor: colors.brand.orangeTint },
  start: { backgroundColor: colors.brand.navy },
  struck: { textDecorationLine: 'line-through' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  swatch: { width: 14, height: 14, borderRadius: 4 },
});
