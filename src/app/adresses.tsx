import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { Screen } from '@/components/Screen';
import { SectionCard } from '@/components/SectionCard';
import { TextField } from '@/components/TextField';
import { showToast } from '@/components/Toast';
import { clearCustomer, saveCustomer, useSavedCustomer } from '@/data/customer';
import { colors, space } from '@/theme';
import { useGoBack } from '@/utils/navigation';
import { formatCiPhone, normalizeCiPhone } from '@/utils/phone';

type Errors = { name?: string; phone?: string };

/** Adresses de livraison: the details used to pre-fill Paiement, kept on this phone. */
export default function AdressesScreen() {
  const goBack = useGoBack();
  const saved = useSavedCustomer();
  const [name, setName] = useState(saved?.name ?? '');
  const [phone, setPhone] = useState(saved ? formatCiPhone(saved.phone) : '');
  const [address, setAddress] = useState(saved?.address ?? '');
  const [errors, setErrors] = useState<Errors>({});

  const save = () => {
    const normalized = normalizeCiPhone(phone);
    const next: Errors = {
      name: name.trim().length < 2 ? 'Indiquez votre nom.' : undefined,
      phone: normalized ? undefined : 'Numéro ivoirien à 10 chiffres, ex. 07 00 00 00 00.',
    };
    setErrors(next);
    if (next.name || !normalized) return;
    saveCustomer({ name: name.trim(), phone: normalized, address: address.trim() });
    showToast('Coordonnées enregistrées.');
    goBack();
  };

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton icon="arrow-left" accessibilityLabel="Retour" bordered onPress={goBack} />
        <AppText variant="headerTitle" accessibilityRole="header">
          Adresses de livraison
        </AppText>
      </View>
      <AppText variant="meta" color={colors.text.muted}>
        Utilisées pour remplir le paiement plus vite. Elles restent sur ce téléphone.
      </AppText>
      <SectionCard>
        <TextField label="Nom et prénom" placeholder="Aya Koné" value={name} onChangeText={(v) => (setName(v), setErrors((e) => ({ ...e, name: undefined })))} error={errors.name} />
        <TextField
          label="Téléphone"
          placeholder="07 00 00 00 00"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={(v) => (setPhone(v), setErrors((e) => ({ ...e, phone: undefined })))}
          error={errors.phone}
        />
        <TextField label="Commune et adresse" placeholder="Cocody, Riviera 2, près de…" value={address} onChangeText={setAddress} />
      </SectionCard>
      <Button label="Enregistrer" onPress={save} />
      {saved ? (
        <Button
          label="Effacer mes coordonnées"
          variant="outline"
          icon="trash-2"
          onPress={() => {
            clearCustomer();
            setName('');
            setPhone('');
            setAddress('');
            showToast('Coordonnées effacées de ce téléphone.');
          }}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingTop: space.md },
});
