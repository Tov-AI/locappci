import Feather from '@expo/vector-icons/Feather';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { showToast } from '@/components/Toast';
import { saveAccount } from '@/data/account';
import { useOnline } from '@/data/online';
import { useLogin } from '@/data/queries';
import { colors, size } from '@/theme';
import { normalizeCiPhone } from '@/utils/phone';

type Props = { visible: boolean; onClose: () => void };

/** "Se connecter" with phone and password. The session token is added with Feature 14. */
export function LoginSheet({ visible, onClose }: Props) {
  const online = useOnline();
  const login = useLogin();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!visible) return;
    setPassword('');
    setError(undefined);
  }, [visible]);

  const submit = () => {
    const normalized = normalizeCiPhone(phone);
    if (!normalized) {
      setError('Numéro ivoirien à 10 chiffres, ex. 07 00 00 00 00.');
      return;
    }
    login.mutate(
      { phone: normalized, password },
      {
        onSuccess: (a) => {
          saveAccount(a);
          onClose();
          showToast(`Bonjour ${a.name.split(' ')[0]} !`);
        },
        onError: (e) => setError(e.message),
      },
    );
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Se connecter"
      footer={
        <Button
          label="Se connecter"
          loading={login.isPending}
          disabled={!online || !phone || password.length === 0}
          onPress={submit}
        />
      }>
      <TextField
        label="Téléphone"
        placeholder="07 00 00 00 00"
        keyboardType="phone-pad"
        autoComplete="tel"
        value={phone}
        onChangeText={(v) => {
          setPhone(v);
          setError(undefined);
        }}
      />
      <TextField
        label="Mot de passe"
        value={password}
        onChangeText={(v) => {
          setPassword(v);
          setError(undefined);
        }}
        secureTextEntry={!show}
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        error={error}
        trailing={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            onPress={() => setShow((s) => !s)}
            style={styles.eye}>
            <Feather name={show ? 'eye-off' : 'eye'} size={20} color={colors.text.muted} />
          </Pressable>
        }
      />
      {!online ? (
        <AppText variant="meta" color={colors.text.muted}>
          Connexion internet nécessaire.
        </AppText>
      ) : null}
      <AppText variant="meta" color={colors.text.muted}>
        Pas encore de compte ? Il se crée en un geste après votre première commande.
      </AppText>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  eye: { width: size.touch, height: size.touch, alignItems: 'center', justifyContent: 'center' },
});
