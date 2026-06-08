import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY } from '../../constants/Theme';
import { supabase } from '../../utils/api';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleResetPassword = async () => {
    if (!email) {
      setErrorMsg('Please enter your email address.');
      return;
    }
    
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'disciplineos://reset-password',
      });

      if (error) throw error;
      
      setSuccessMsg('Reset instructions sent! Please check your email.');
      setEmail('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to send recovery email.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.headerContainer}>
          <Text style={styles.title}>RESET PASSWORD</Text>
          <Text style={styles.subtitle}>RECOVER DISCIPLINE OS KEY</Text>
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
          <Text style={styles.description}>
            Enter the email address associated with your account. We will send you instructions to reset your passcode.
          </Text>

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

          {/* Submit Button */}
          <TouchableOpacity 
            style={styles.submitButton} 
            onPress={handleResetPassword}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Text style={styles.submitButtonText}>SEND INSTRUCTIONS</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Back to Login */}
        <TouchableOpacity style={styles.backButton} onPress={() => router.push('/(auth)/login')}>
          <Text style={styles.backButtonText}>BACK TO LOGIN</Text>
        </TouchableOpacity>
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
    marginBottom: 35,
  },
  title: {
    ...TYPOGRAPHY.heading,
    fontSize: 28,
    color: COLORS.green,
    letterSpacing: 2,
    textAlign: 'center',
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
  description: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 30,
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
  submitButton: {
    backgroundColor: COLORS.green,
    height: 56,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  submitButtonText: {
    ...TYPOGRAPHY.heading,
    color: '#000000',
    fontSize: 15,
    letterSpacing: 1.5,
  },
  backButton: {
    alignItems: 'center',
    padding: 12,
    marginTop: 20,
  },
  backButtonText: {
    ...TYPOGRAPHY.heading,
    color: COLORS.green,
    fontSize: 13,
    letterSpacing: 1,
  },
});
