import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { SortOrder, Universe } from '@/api';
import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { OptionCard } from '@/components/OptionCard';
import { TextField } from '@/components/TextField';
import { useProductCount } from '@/data/queries';
import { space } from '@/theme';

export type Filters = {
  universe?: Universe;
  minPrice?: number;
  maxPrice?: number;
  sort: SortOrder;
};

export const DEFAULT_FILTERS: Filters = { sort: 'nearest' };

/** How many filters differ from the default, for the "Filtres · N" chip. */
export function countActiveFilters(f: Filters) {
  return (f.universe ? 1 : 0) + (f.minPrice != null || f.maxPrice != null ? 1 : 0) + (f.sort !== 'nearest' ? 1 : 0);
}

export const SORT_LABELS: Record<SortOrder, string> = {
  nearest: 'Plus proches',
  price_asc: 'Prix croissant',
  newest: 'Plus récents',
};

type Props = {
  visible: boolean;
  onClose: () => void;
  value: Filters;
  onApply: (next: Filters) => void;
  /** Search text and commune, so the live count matches what the list will show. */
  search?: string;
  cityId?: string;
  categoryId?: string;
};

const toNumber = (s: string) => {
  const digits = s.replace(/\D/g, '');
  return digits ? Number(digits) : undefined;
};

/**
 * Filtres sheet from the handoff. Changes stay in a draft until "Afficher N résultats":
 * closing the sheet any other way leaves the current filters untouched.
 */
export function FiltersSheet({ visible, onClose, value, onApply, search, cityId, categoryId }: Props) {
  const [draft, setDraft] = useState<Filters>(value);
  const [minText, setMinText] = useState('');
  const [maxText, setMaxText] = useState('');

  // Each time the sheet opens, start from the filters currently applied.
  useEffect(() => {
    if (!visible) return;
    setDraft(value);
    setMinText(value.minPrice != null ? String(value.minPrice) : '');
    setMaxText(value.maxPrice != null ? String(value.maxPrice) : '');
  }, [visible, value]);

  const minPrice = toNumber(minText);
  const maxPrice = toNumber(maxText);
  const priceError =
    minPrice != null && maxPrice != null && minPrice > maxPrice
      ? 'Le minimum dépasse le maximum.'
      : undefined;

  const next: Filters = { ...draft, minPrice, maxPrice };
  const count = useProductCount(
    { ...next, search, cityId, categoryId },
    visible && !priceError,
  );

  const reset = () => {
    setDraft(DEFAULT_FILTERS);
    setMinText('');
    setMaxText('');
  };

  const total = count.data;
  const label =
    total == null
      ? 'Afficher les résultats'
      : total === 0
        ? 'Aucun résultat'
        : `Afficher ${total} résultat${total > 1 ? 's' : ''}`;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Filtres"
      headerAction={{ label: 'Réinitialiser', onPress: reset }}
      footer={
        <Button
          label={label}
          disabled={!!priceError || total === 0}
          onPress={() => {
            onApply(next);
            onClose();
          }}
        />
      }>
      <View style={styles.group}>
        <AppText variant="secondaryStrong">Type</AppText>
        <View style={styles.three}>
          {(
            [
              [undefined, 'Tout'],
              ['vente', 'Vente'],
              ['location', 'Location'],
            ] as const
          ).map(([u, text]) => (
            <OptionCard
              key={text}
              label={text}
              hideRadio
              selected={draft.universe === u}
              onSelect={() => setDraft((d) => ({ ...d, universe: u }))}
              style={styles.third}
            />
          ))}
        </View>
      </View>

      <View style={styles.group}>
        <AppText variant="secondaryStrong">Prix (FCFA)</AppText>
        <View style={styles.two}>
          <View style={styles.half}>
            <TextField
              label="Minimum"
              placeholder="0"
              keyboardType="number-pad"
              value={minText}
              onChangeText={setMinText}
            />
          </View>
          <View style={styles.half}>
            <TextField
              label="Maximum"
              placeholder="50 000"
              keyboardType="number-pad"
              value={maxText}
              onChangeText={setMaxText}
              error={priceError}
            />
          </View>
        </View>
      </View>

      <View style={styles.group}>
        <AppText variant="secondaryStrong">Trier par</AppText>
        <View style={styles.chips}>
          {(Object.keys(SORT_LABELS) as SortOrder[]).map((s) => (
            <Chip
              key={s}
              label={SORT_LABELS[s]}
              active={draft.sort === s}
              onPress={() => setDraft((d) => ({ ...d, sort: s }))}
            />
          ))}
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.sm },
  three: { flexDirection: 'row', gap: space.sm },
  third: { flex: 1, justifyContent: 'center' },
  two: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  half: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
