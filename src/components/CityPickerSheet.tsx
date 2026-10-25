import { ScrollView, StyleSheet } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { OptionCard } from '@/components/OptionCard';
import { Skeleton } from '@/components/Skeleton';
import { setCity } from '@/data/city';
import { useCities, waitingForNetwork } from '@/data/queries';
import { colors, space } from '@/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Currently chosen commune id ('' = all of Côte d'Ivoire). */
  selected: string | null | undefined;
  /** First launch: different title and a "Passer" button. */
  firstLaunch?: boolean;
};

/** Commune picker: first-launch question and the city chip on Accueil share it. */
export function CityPickerSheet({ visible, onClose, selected, firstLaunch = false }: Props) {
  const cities = useCities();

  const choose = (id: string) => {
    setCity(id);
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={firstLaunch ? () => choose('') : onClose}
      title={firstLaunch ? 'Où êtes-vous ?' : 'Choisir ma commune'}
      headerAction={firstLaunch ? { label: 'Passer', onPress: () => choose('') } : undefined}>
      {firstLaunch ? (
        <AppText variant="meta" color={colors.text.body}>
          Nous affichons d'abord les annonces près de chez vous. Vous pourrez changer à tout moment.
        </AppText>
      ) : null}
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {waitingForNetwork(cities) || cities.isError ? (
          // No list yet (first launch offline, or server down): "Toute la Côte d'Ivoire" still works.
          <AppText variant="meta" color={colors.text.muted}>
            Liste des communes indisponible sans connexion. Vous pourrez choisir plus tard.
          </AppText>
        ) : cities.isPending
          ? [0, 1, 2, 3].map((i) => <Skeleton key={i} height={56} />)
          : (cities.data ?? []).map((c) => (
              <OptionCard
                key={c.id}
                label={c.name}
                hint={c.region}
                selected={selected === c.id}
                onSelect={() => choose(c.id)}
              />
            ))}
        <OptionCard
          label="Toute la Côte d'Ivoire"
          selected={selected === ''}
          onSelect={() => choose('')}
        />
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: { maxHeight: 440 },
  listContent: { gap: space.sm },
});
