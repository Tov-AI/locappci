import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { colors } from '@/theme';

type Props = {
  uri: string | null | undefined;
  /** Size of the placeholder icon shown while loading, without a photo, or when it fails. */
  iconSize: number;
  /** Orange tint for rentals, navy tint for sales (placeholder only). */
  rental?: boolean;
};

/**
 * A product photo that fills its parent and is always shown whole: never zoomed, never cut.
 * Sellers upload photos of every shape (wide, tall, square) and phones come in every size, so the
 * photo is fitted inside the frame ("contain") on a white background, like a picture on a mat.
 * The parent gives the size (and `overflow: 'hidden'` if it has rounded corners).
 */
export function ProductPhoto({ uri, iconSize, rental = false }: Props) {
  return <Photo key={uri ?? 'none'} uri={uri} iconSize={iconSize} rental={rental} />;
}

/** Keyed by the address above, so a recycled list row never shows the previous photo's state. */
function Photo({ uri, iconSize, rental }: Required<Pick<Props, 'iconSize' | 'rental'>> & Pick<Props, 'uri'>) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const show = !!uri && !failed;

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        styles.center,
        { backgroundColor: loaded && show ? colors.surface.card : rental ? colors.brand.orangeTint : colors.brand.navyTint },
      ]}>
      {loaded && show ? null : (
        <Feather name="image" size={iconSize} color={rental ? colors.brand.orangeBorder : colors.brand.navyMuted} />
      )}
      {show ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          resizeMode="contain"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
