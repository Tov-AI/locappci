import { useState } from 'react';
import { FlatList, StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { ProductPhoto } from '@/components/ProductPhoto';
import { colors, radius, space } from '@/theme';

/**
 * Height of the photo area for a screen width: about 4:5 of the width, so it scales with the phone,
 * but never so small that a photo is hard to see nor so tall that it pushes the price off screen.
 */
export const photoHeight = (width: number) => Math.round(Math.min(Math.max(width * 0.8, 260), 440));

type Props = {
  images: string[];
  /** Product name, read aloud with each photo. */
  name: string;
  /** Orange tint for rentals, navy tint for sales (shown behind and instead of photos). */
  rental?: boolean;
};

/**
 * Full-width photos shown whole (never cropped), swipe left/right, "1 / 5" counter bottom right.
 * With no photos, shows one tinted placeholder so the screen keeps its shape.
 */
export function PhotoCarousel({ images, name, rental = false }: Props) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const slides = images.length > 0 ? images : [null];
  const height = photoHeight(width);

  return (
    <View style={[styles.wrap, { height }]}>
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
            style={{ width, height }}
            accessible
            accessibilityRole="image"
            accessibilityLabel={
              uri ? `${name}, photo ${i + 1} sur ${slides.length}` : `${name}, pas de photo`
            }>
            {/* Whole photo, never cropped; a tinted placeholder when it is missing or fails to load. */}
            <ProductPhoto uri={uri} iconSize={48} rental={rental} />
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
  // Hairline under the photos: a white photo must not melt into the white page.
  wrap: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border.default },
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
