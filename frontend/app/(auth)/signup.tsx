import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY } from '../../constants/Theme';
import { useAuthStore } from '../../stores/authStore';

export default function SignupScreen() {
  const router = useRouter();
  const { signup, login: authStoreLogin, isLoading } = useAuthStore();

  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isCreatingGuest, setIsCreatingGuest] = useState(false);

  const handleGuestLogin = async () => {
    setIsCreatingGuest(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const randId = Math.random().toString(36).substring(2, 10);
      const guestEmail = `disciplineos.guest.${randId}@gmail.com`;
      const guestPassword = `GuestPassword_${randId}`;
      const guestUsername = `guest_${randId.substring(0, 5)}`;
      const guestFullName = `Guest Recruit`;

      await signup(guestEmail, guestPassword, guestUsername, guestFullName);
      await authStoreLogin(guestEmail, guestPassword);
      router.replace('/(tabs)');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create guest session.');
    } finally {
      setIsCreatingGuest(false);
    }
  };

  const handleSignup = async () => {
    if (!username || !fullName || !email || !password || !confirmPassword) {
      setErrorMsg('Please fill in all fields.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }
    
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await signup(email, password, username, fullName);
      setSuccessMsg('Account created successfully! You can now log in.');
      
      // Clear fields
      setUsername('');
      setFullName('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      
      // Auto-redirect to login after 2 seconds
      setTimeout(() => {
        router.replace('/(auth)/login');
      }, 2000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Signup failed. Please try again.');
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.headerContainer}>
          <Text style={styles.title}>SIGN UP</Text>
          <Text style={styles.subtitle}>CREATE DISCIPLINE PROFILE</Text>
        </View>

        {errorMsg && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        {successMsg && (
          <View style={styles.successBox}>
            <Text style={styles.successText}>{successMsg}</Text>
          </View>
        )}

        <View style={styles.formContainer}>
          {/* Username */}
          <Text style={styles.inputLabel}>USERNAME</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="e.g. shadow_runner"
              placeholderTextColor={COLORS.textSecondary}
              autoCapitalize="none"
              value={username}
              onChangeText={setUsername}
            />
          </View>

          {/* Full Name */}
          <Text style={styles.inputLabel}>FULL NAME</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="e.g. John Doe"
              placeholderTextColor={COLORS.textSecondary}
              value={fullName}
              onChangeText={setFullName}
            />
          </View>

          {/* Email */}
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

          {/* Password */}
          <Text style={styles.inputLabel}>PASSWORD</Text>
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

          {/* Confirm Password */}
          <Text style={styles.inputLabel}>CONFIRM PASSWORD</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={COLORS.textSecondary}
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
          </View>

          {/* Signup Button */}
          <TouchableOpacity 
            style={styles.signupButton} 
            onPress={handleSignup}
            disabled={isLoading || isCreatingGuest}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Text style={styles.signupButtonText}>ENLIST NOW</Text>
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

        {/* Back to Login */}
        <View style={styles.loginPromptRow}>
          <Text style={styles.loginPromptText}>ALREADY ENLISTED? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.loginLinkText}>LOG IN</Text>
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
    marginBottom: 30,
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
    marginBottom: 20,
  },
  errorText: {
    ...TYPOGRAPHY.body,
    color: COLORS.red,
    fontSize: 14,
    textAlign: 'center',
  },
  successBox: {
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    borderWidth: 1,
    borderColor: COLORS.green,
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  successText: {
    ...TYPOGRAPHY.body,
    color: COLORS.green,
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
    marginBottom: 6,
  },
  inputWrapper: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    height: 52,
    marginBottom: 16,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  input: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    fontSize: 16,
    height: '100%',
  },
  signupButton: {
    backgroundColor: COLORS.green,
    height: 56,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  signupButtonText: {
    ...TYPOGRAPHY.heading,
    color: '#000000',
    fontSize: 16,
    letterSpacing: 2,
  },
  loginPromptRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  loginPromptText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  loginLinkText: {
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
