import Feather from '@expo/vector-icons/Feather';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { showToast } from '@/components/Toast';
import { saveSession } from '@/data/account';
import { useOnline } from '@/data/online';
import { useCreateAccount, useLogin } from '@/data/queries';
import { colors, size } from '@/theme';
import { normalizePhone, PHONE_HELP, PHONE_PLACEHOLDER } from '@/utils/phone';

type Props = { visible: boolean; onClose: () => void };

const MIN_PASSWORD = 8;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * "Se connecter" with the website's account (phone or e-mail + password), or "Créer un compte"
 * (name, phone, password; e-mail optional). The session token is saved by saveSession().
 */
export function LoginSheet({ visible, onClose }: Props) {
  const online = useOnline();
  const login = useLogin();
  const create = useCreateAccount();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [identifier, setIdentifier] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!visible) return;
    setMode('login');
    setPassword('');
    setError(undefined);
  }, [visible]);

  const switchTo = (next: 'login' | 'signup') => {
    setMode(next);
    setPassword('');
    setError(undefined);
  };

  const welcome = (fullName: string) => {
    onClose();
    showToast(`Bonjour ${fullName.split(' ')[0]} !`);
  };

  const submitLogin = () => {
    const typed = identifier.trim();
    // A phone number is sent in one format; an e-mail goes as typed.
    const value = typed.includes('@') ? typed : (normalizePhone(typed) ?? typed);
    login.mutate(
      { identifier: value, password },
      {
        onSuccess: (s) => {
          saveSession(s);
          welcome(s.account.name);
        },
        onError: (e) => setError(e.message),
      },
    );
  };

  const submitSignup = () => {
    const cleanName = name.trim().replace(/\s+/g, ' ');
    const normalized = normalizePhone(phone);
    const mail = email.trim();
    if (cleanName.length < 2) return setError('Indiquez votre nom.');
    if (!normalized) return setError(PHONE_HELP);
    if (mail && !EMAIL.test(mail)) return setError('Cette adresse e-mail n’est pas valide.');
    if (password.length < MIN_PASSWORD) return setError(`Mot de passe : ${MIN_PASSWORD} caractères minimum.`);
    create.mutate(
      { name: cleanName, phone: normalized, password, ...(mail ? { email: mail } : {}) },
      {
        onSuccess: (s) => {
          saveSession(s);
          welcome(s.account.name);
        },
        onError: (e) => setError(e.message),
      },
    );
  };

  const clear = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setError(undefined);
  };

  const passwordField = (
    <TextField
      label="Mot de passe"
      placeholder={mode === 'signup' ? `${MIN_PASSWORD} caractères minimum` : undefined}
      value={password}
      onChangeText={clear(setPassword)}
      secureTextEntry={!show}
      autoCapitalize="none"
      autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
      textContentType={mode === 'signup' ? 'newPassword' : 'password'}
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
  );

  const offline = !online ? (
    <AppText variant="meta" color={colors.text.muted}>
      Connexion internet nécessaire.
    </AppText>
  ) : null;

  if (mode === 'signup') {
    return (
      <BottomSheet
        visible={visible}
        onClose={onClose}
        title="Créer un compte"
        footer={
          <Button
            label="Créer mon compte"
            loading={create.isPending}
            disabled={!online || !name.trim() || !phone || password.length === 0}
            onPress={submitSignup}
          />
        }>
        <TextField label="Nom et prénom" autoComplete="name" autoCapitalize="words" value={name} onChangeText={clear(setName)} />
        <TextField
          label="Téléphone"
          placeholder={PHONE_PLACEHOLDER}
          keyboardType="phone-pad"
          autoComplete="tel"
          value={phone}
          onChangeText={clear(setPhone)}
        />
        <TextField
          label="E-mail (facultatif)"
          keyboardType="email-address"
          autoComplete="email"
          autoCapitalize="none"
          value={email}
          onChangeText={clear(setEmail)}
        />
        {passwordField}
        {offline}
        <Pressable accessibilityRole="button" onPress={() => switchTo('login')} style={styles.link}>
          <AppText variant="secondaryStrong" color={colors.brand.navy}>
            J’ai déjà un compte : me connecter
          </AppText>
        </Pressable>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Se connecter"
      footer={
        <Button
          label="Se connecter"
          loading={login.isPending}
          disabled={!online || !identifier.trim() || password.length === 0}
          onPress={submitLogin}
        />
      }>
      <TextField
        label="Téléphone ou e-mail"
        placeholder="07 00 00 00 00 ou nom@exemple.com"
        keyboardType="email-address"
        autoComplete="username"
        autoCapitalize="none"
        autoCorrect={false}
        value={identifier}
        onChangeText={clear(setIdentifier)}
      />
      {passwordField}
      {offline}
      <AppText variant="meta" color={colors.text.muted}>
        Utilisez le compte que vous avez sur locappci.fr, ou créez-en un ici.
      </AppText>
      <Pressable accessibilityRole="button" onPress={() => switchTo('signup')} style={styles.link}>
        <AppText variant="secondaryStrong" color={colors.brand.navy}>
          Pas encore de compte ? Créer un compte
        </AppText>
      </Pressable>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  eye: { width: size.touch, height: size.touch, alignItems: 'center', justifyContent: 'center' },
  link: { minHeight: size.touch, justifyContent: 'center' },
});
