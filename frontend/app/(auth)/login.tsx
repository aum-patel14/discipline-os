import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY } from '../../constants/Theme';
import { useAuthStore } from '../../stores/authStore';

export default function LoginScreen() {
  const router = useRouter();
  const { login, signup, isLoading } = useAuthStore();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isCreatingGuest, setIsCreatingGuest] = useState(false);

  const handleGuestLogin = async () => {
    setIsCreatingGuest(true);
    setErrorMsg(null);
    try {
      const randId = Math.random().toString(36).substring(2, 10);
      const guestEmail = `disciplineos.guest.${randId}@gmail.com`;
      const guestPassword = `GuestPassword_${randId}`;
      const guestUsername = `guest_${randId.substring(0, 5)}`;
      const guestFullName = `Guest Recruit`;

      await signup(guestEmail, guestPassword, guestUsername, guestFullName);
      await login(guestEmail, guestPassword);
      router.replace('/(tabs)');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create guest session.');
    } finally {
      setIsCreatingGuest(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }
    setErrorMsg(null);
    try {
      await login(email, password);
      router.replace('/(tabs)');
    } catch (err: any) {
      setErrorMsg(err.message || 'Login failed. Please check your credentials.');
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    try {
      // Simulate Google token authentication flow
      await useAuthStore.getState().googleLogin('mock_google_id_token');
      router.replace('/(tabs)');
    } catch (err: any) {
      setErrorMsg(err.message || 'Google login failed.');
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.headerContainer}>
          <Text style={styles.title}>LOGIN</Text>
          <Text style={styles.subtitle}>ACCESS DISCIPLINE OS</Text>
        </View>

        {errorMsg && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        <View style={styles.formContainer}>
          {/* Email input */}
          <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="name@domain.com"
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          {/* Password input */}
          <View style={styles.passwordHeader}>
            <Text style={styles.inputLabel}>PASSWORD</Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')}>
              <Text style={styles.forgotText}>FORGOT?</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={COLORS.textSecondary}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          {/* Login Button */}
          <TouchableOpacity 
            style={styles.loginButton} 
            onPress={handleLogin}
            disabled={isLoading || isCreatingGuest}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Text style={styles.loginButtonText}>LOCK IN</Text>
            )}
          </TouchableOpacity>

          {/* Guest Login Button */}
          <TouchableOpacity 
            style={styles.guestButton} 
            onPress={handleGuestLogin}
            disabled={isLoading || isCreatingGuest}
            activeOpacity={0.8}
          >
            {isCreatingGuest ? (
              <ActivityIndicator size="small" color={COLORS.green} />
            ) : (
              <Text style={styles.guestButtonText}>ENTER AS GUEST</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Google Login Button */}
        <TouchableOpacity 
          style={styles.googleButton} 
          onPress={handleGoogleLogin}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          <Text style={styles.googleButtonText}>CONTINUE WITH GOOGLE</Text>
        </TouchableOpacity>

        {/* Link to Signup */}
        <View style={styles.signupPromptRow}>
          <Text style={styles.signupPromptText}>NEW RECRUIT? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
            <Text style={styles.signupLinkText}>SIGN UP</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    ...TYPOGRAPHY.heading,
    fontSize: 32,
    color: COLORS.green,
    letterSpacing: 2,
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    fontSize: 12,
    color: COLORS.textSecondary,
    letterSpacing: 3,
    marginTop: 4,
  },
  errorBox: {
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderWidth: 1,
    borderColor: COLORS.red,
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
  },
  errorText: {
    ...TYPOGRAPHY.body,
    color: COLORS.red,
    fontSize: 14,
    textAlign: 'center',
  },
  formContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    ...TYPOGRAPHY.heading,
    color: COLORS.textSecondary,
    fontSize: 11,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  inputWrapper: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    height: 56,
    marginBottom: 20,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  input: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    fontSize: 16,
    height: '100%',
  },
  passwordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  forgotText: {
    ...TYPOGRAPHY.heading,
    color: COLORS.cyan,
    fontSize: 11,
    letterSpacing: 1,
  },
  loginButton: {
    backgroundColor: COLORS.green,
    height: 56,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  loginButtonText: {
    ...TYPOGRAPHY.heading,
    color: '#000000',
    fontSize: 16,
    letterSpacing: 2,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    ...TYPOGRAPHY.heading,
    color: COLORS.textSecondary,
    fontSize: 12,
    marginHorizontal: 16,
  },
  googleButton: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    height: 56,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  googleButtonText: {
    ...TYPOGRAPHY.heading,
    color: COLORS.text,
    fontSize: 13,
    letterSpacing: 1,
  },
  signupPromptRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signupPromptText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  signupLinkText: {
    ...TYPOGRAPHY.heading,
    color: COLORS.green,
    fontSize: 14,
    letterSpacing: 1,
  },
  guestButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.green,
    height: 56,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  guestButtonText: {
    ...TYPOGRAPHY.heading,
    color: COLORS.green,
    fontSize: 16,
    letterSpacing: 2,
  },
});
