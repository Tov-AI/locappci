import { Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Tag } from '@/components/Badge';
import { FavouriteButton } from '@/components/FavouriteButton';
import { IconButton } from '@/components/IconButton';
import { PHOTO_HEIGHT, PhotoCarousel } from '@/components/PhotoCarousel';
import { Skeleton } from '@/components/Skeleton';
import { useFavourite } from '@/data/favourites';
import { colors, space } from '@/theme';

type Props = {
  productId: string;
  images: string[];
  name: string;
  /** Text sent by "Partager": name, price and link. */
  shareMessage: string;
  onBack: () => void;
  rental?: boolean;
};

/** Top of a detail screen: photos with back, share and favourite on top, "Location" tag for rentals. */
export function PhotoHeader({ productId, images, name, shareMessage, onBack, rental = false }: Props) {
  const insets = useSafeAreaInsets();
  const [saved, toggleSaved] = useFavourite(productId);

  const share = () => {
    Share.share({ message: shareMessage }).catch(() => {
      // The person closed the share menu or no app could share: nothing to do.
    });
  };

  return (
    <View>
      <PhotoCarousel images={images} name={name} rental={rental} />
      {rental ? <Tag label="Location" style={styles.tag} /> : null}
      <View style={[styles.buttons, { top: insets.top + space.sm }]} pointerEvents="box-none">
        <IconButton icon="arrow-left" accessibilityLabel="Retour" onPress={onBack} />
        <View style={styles.row}>
          <IconButton icon="share-2" accessibilityLabel="Partager" onPress={share} />
          <FavouriteButton saved={saved} onToggle={toggleSaved} />
        </View>
      </View>
    </View>
  );
}

/** Same shape while the product loads; back already works. */
export function PhotoHeaderSkeleton({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View>
      <Skeleton height={PHOTO_HEIGHT} borderRadius={0} />
      <View style={[styles.buttons, { top: insets.top + space.sm }]}>
        <IconButton icon="arrow-left" accessibilityLabel="Retour" onPress={onBack} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  buttons: {
    position: 'absolute',
    left: space.gutter,
    right: space.gutter,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  // Bottom left, clear of the "1 / 3" counter on the right.
  // White behind the orange text: readable on the orange-tinted photo area (as in the design).
  tag: { position: 'absolute', left: space.gutter, bottom: space.md, backgroundColor: colors.surface.card },
});
