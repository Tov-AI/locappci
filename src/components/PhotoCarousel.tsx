import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { FlatList, Image, StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors, radius, space } from '@/theme';

export const PHOTO_HEIGHT = 300;

type Props = {
  images: string[];
  /** Product name, read aloud with each photo. */
  name: string;
  /** Orange tint for rentals, navy tint for sales (shown behind and instead of photos). */
  rental?: boolean;
};

/**
 * Full-width photos, swipe left/right, "1 / 5" counter bottom right.
 * With no photos, shows one tinted placeholder so the screen keeps its shape.
 */
export function PhotoCarousel({ images, name, rental = false }: Props) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const slides = images.length > 0 ? images : [null];
  const tint = rental ? colors.brand.orangeTint : colors.brand.navyTint;
  const iconColor = rental ? colors.brand.orangeBorder : colors.brand.navyMuted;

  return (
    <View style={[styles.wrap, { backgroundColor: tint }]}>
      <FlatList
        data={slides}
        keyExtractor={(uri, i) => `${i}-${uri ?? 'none'}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={slides.length > 1}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        renderItem={({ item: uri, index: i }) => (
          <View
            style={[styles.slide, { width }]}
            accessible
            accessibilityRole="image"
            accessibilityLabel={
              uri ? `${name}, photo ${i + 1} sur ${slides.length}` : `${name}, pas de photo`
            }>
            {/* Stays visible if the photo is missing or fails to load. */}
            <Feather name="image" size={48} color={iconColor} />
            {uri ? <Image source={{ uri }} style={styles.image} resizeMode="cover" /> : null}
          </View>
        )}
      />
      {slides.length > 1 ? (
        <View style={styles.counter} importantForAccessibility="no-hide-descendants">
          <AppText variant="caption" color={colors.text.inverse}>
            {`${index + 1} / ${slides.length}`}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: PHOTO_HEIGHT },
  slide: { height: PHOTO_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  image: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  counter: {
    position: 'absolute',
    right: space.md,
    bottom: space.md,
    paddingHorizontal: 10,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.scrim,
  },
});
