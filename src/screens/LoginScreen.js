import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import { useAuth } from '../context/AuthContext';

const { width } = Dimensions.get('window');

const INSTANCE_OPTIONS = ['TEST', 'PROD'];

const LoginScreen = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [instance, setInstance] = useState('TEST');
  const [showPassword, setShowPassword] = useState(false);
  const [showInstancePicker, setShowInstancePicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const { login } = useAuth();

  const validateForm = () => {
    const newErrors = {};
    if (!username.trim()) {
      newErrors.username = 'Username is required';
    }
    if (!password.trim()) {
      newErrors.password = 'Password is required';
    }
    if (!instance.trim()) {
      newErrors.instance = 'Instance is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const result = await login(username, password, instance);
      if (!result.success) {
        Alert.alert('Login Failed', result.error || 'Invalid credentials');
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const renderInput = (
    icon,
    placeholder,
    value,
    onChangeText,
    secureTextEntry = false,
    error,
    keyboardType = 'default'
  ) => (
    <View style={styles.inputWrapper}>
      <View style={[styles.inputContainer, error && styles.inputError]}>
        <Ionicons name={icon} size={22} color={colors.textSecondary} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          value={value}
          onChangeText={(text) => {
            onChangeText(text);
            if (error) setErrors((prev) => ({ ...prev, [placeholder.toLowerCase()]: null }));
          }}
          secureTextEntry={secureTextEntry && !showPassword}
          autoCapitalize="none"
          keyboardType={keyboardType}
        />
        {secureTextEntry && (
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
            <Ionicons
              name={showPassword ? 'eye-off' : 'eye'}
              size={22}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.primaryDark, colors.primary, colors.primaryDark]}
        style={styles.gradient}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Logo Section */}
            <View style={styles.logoSection}>
              <View style={styles.logoContainer}>
                <View style={styles.logoCircle}>
                  <Ionicons name="cart" size={50} color={colors.accent} />
                </View>
              </View>
              <Text style={styles.appName}>ReERP POS</Text>
              <Text style={styles.tagline}>Sign in to continue</Text>
            </View>

            {/* Login Form */}
            <View style={styles.formContainer}>
              <View style={styles.formCard}>
                {renderInput(
                  'person-outline',
                  'Username',
                  username,
                  setUsername,
                  false,
                  errors.username
                )}

                {renderInput(
                  'lock-closed-outline',
                  'Password',
                  password,
                  setPassword,
                  true,
                  errors.password
                )}

                {/* Instance Selector */}
                <View style={styles.inputWrapper}>
                  <TouchableOpacity
                    style={[styles.inputContainer, errors.instance && styles.inputError]}
                    onPress={() => setShowInstancePicker(!showInstancePicker)}
                  >
                    <Ionicons name="server-outline" size={22} color={colors.textSecondary} style={styles.inputIcon} />
                    <Text style={[styles.input, { paddingVertical: 0 }]}>
                      {instance}
                    </Text>
                    <Ionicons
                      name={showInstancePicker ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                  {showInstancePicker && (
                    <View style={styles.instanceDropdown}>
                      {INSTANCE_OPTIONS.map((opt) => (
                        <TouchableOpacity
                          key={opt}
                          style={[
                            styles.instanceOption,
                            instance === opt && styles.instanceOptionActive,
                          ]}
                          onPress={() => {
                            setInstance(opt);
                            setShowInstancePicker(false);
                            if (errors.instance) setErrors((prev) => ({ ...prev, instance: null }));
                          }}
                        >
                          <Ionicons
                            name={instance === opt ? 'radio-button-on' : 'radio-button-off'}
                            size={18}
                            color={instance === opt ? colors.accent : colors.textSecondary}
                          />
                          <Text style={[
                            styles.instanceOptionText,
                            instance === opt && styles.instanceOptionTextActive,
                          ]}>
                            {opt}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  {errors.instance && <Text style={styles.errorText}>{errors.instance}</Text>}
                </View>

                {/* Login Button */}
                <TouchableOpacity
                  style={styles.loginButton}
                  onPress={handleLogin}
                  disabled={isLoading}
                >
                  <LinearGradient
                    colors={[colors.secondary, colors.secondaryDark]}
                    style={styles.buttonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    {isLoading ? (
                      <ActivityIndicator color={colors.textPrimary} size="small" />
                    ) : (
                      <>
                        <Text style={styles.loginButtonText}>SIGN IN</Text>
                        <Ionicons name="arrow-forward" size={20} color={colors.textPrimary} />
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                {/* Forgot Password */}
                <TouchableOpacity style={styles.forgotButton}>
                  <Text style={styles.forgotText}>Forgot Password?</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>Powered by Oracle Fusion</Text>
              <View style={styles.versionContainer}>
                <Ionicons name="shield-checkmark" size={14} color={colors.accentGreen} />
                <Text style={styles.secureText}>Secure Connection</Text>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    marginBottom: 20,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.backgroundCard,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.accent,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.textPrimary,
    letterSpacing: 2,
  },
  tagline: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
    letterSpacing: 1,
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  formCard: {
    backgroundColor: 'rgba(26, 47, 74, 0.8)',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputWrapper: {
    marginBottom: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    height: 56,
  },
  inputError: {
    borderColor: colors.error,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 16,
  },
  eyeIcon: {
    padding: 4,
  },
  errorText: {
    color: colors.error,
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
  },
  loginButton: {
    marginTop: 24,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  loginButtonText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  forgotButton: {
    alignItems: 'center',
    marginTop: 20,
  },
  forgotText: {
    color: colors.accent,
    fontSize: 14,
  },
  footer: {
    alignItems: 'center',
    marginTop: 40,
  },
  footerText: {
    color: colors.textMuted,
    fontSize: 12,
    letterSpacing: 1,
  },
  versionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  secureText: {
    color: colors.accentGreen,
    fontSize: 12,
  },
  instanceDropdown: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 4,
    overflow: 'hidden',
  },
  instanceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 10,
  },
  instanceOptionActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },
  instanceOptionText: {
    color: colors.textSecondary,
    fontSize: 15,
  },
  instanceOptionTextActive: {
    color: colors.accent,
    fontWeight: '600',
  },
});

export default LoginScreen;
