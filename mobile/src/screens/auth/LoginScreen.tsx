import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Alert
} from 'react-native';
import { Mail, Lock, Eye, EyeOff, Zap, ShieldCheck, AlertCircle, ArrowRight } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';

import { AuthStackParamList } from '../../types/navigation';
import { useAuth } from '../../hooks/useAuth';
import { theme } from '../../theme/theme';

type LoginScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');

    const navigation = useNavigation<LoginScreenNavigationProp>();
    const { login, isLoading } = useAuth();

    const handleLogin = async () => {
        setError('');
        if (!email || !password) {
            setError('Please fill in all fields');
            return;
        }

        try {
            await login(email, password);
        } catch (err: any) {
            const msg = String(err);
            if (msg.includes('user-not-found') || msg.includes('wrong-password') || msg.includes('invalid-credential')) {
                setError('Invalid email or password');
            } else {
                setError('Authentication failed');
            }
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <LinearGradient
                colors={[theme.colors.backgroundAlt, theme.colors.background]}
                style={StyleSheet.absoluteFill}
            />

            {/* Background Glow */}
            <View style={styles.topGlow} />

            <View style={styles.content}>
                {/* Logo Header */}
                <View style={styles.headerContainer}>
                    <View style={styles.logoItem}>
                        <View style={styles.logoIconContainer}>
                            <Zap color={theme.colors.accentLight} size={20} />
                        </View>
                        <Text style={styles.logoText}>SwapSmith</Text>
                    </View>
                    <Text style={styles.title}>Welcome</Text>
                    <Text style={styles.subtitle}>Access your terminal and continue your on-chain journey.</Text>
                </View>

                {/* Error State */}
                {error ? (
                    <View style={styles.errorContainer}>
                        <AlertCircle color={theme.colors.error} size={16} />
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                ) : null}

                {/* Form Inputs */}
                <View style={styles.formContainer}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>EMAIL ADDRESS</Text>
                        <View style={styles.inputContainer}>
                            <Mail color={theme.colors.tertiary} size={18} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="you@example.com"
                                placeholderTextColor={theme.colors.tertiary}
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                keyboardType="email-address"
                                editable={!isLoading}
                            />
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>PASSWORD</Text>
                        <View style={styles.inputContainer}>
                            <Lock color={theme.colors.tertiary} size={18} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="••••••••"
                                placeholderTextColor={theme.colors.tertiary}
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry={!showPassword}
                                editable={!isLoading}
                            />
                            <TouchableOpacity
                                style={styles.eyeBtn}
                                onPress={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? (
                                    <EyeOff color={theme.colors.tertiary} size={18} />
                                ) : (
                                    <Eye color={theme.colors.tertiary} size={18} />
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Login Button */}
                    <TouchableOpacity
                        style={[styles.loginBtn, isLoading && styles.loginBtnDisabled]}
                        onPress={handleLogin}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <View style={styles.btnContentSpacer}>
                                <Text style={styles.loginBtnText}>Sign In</Text>
                                <ArrowRight color="#fff" size={16} />
                            </View>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Divider */}
                <View style={styles.dividerContainer}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>OR</Text>
                    <View style={styles.dividerLine} />
                </View>

                {/* Register Link */}
                <TouchableOpacity
                    style={styles.registerBtn}
                    onPress={() => navigation.navigate('Register')}
                >
                    <Text style={styles.registerBtnText}>Create a free account</Text>
                </TouchableOpacity>

                <View style={styles.footerInfo}>
                    <ShieldCheck color={theme.colors.tertiary} size={14} />
                    <Text style={styles.footerText}>Non-custodial. Your keys, your assets</Text>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    topGlow: {
        position: 'absolute',
        top: -100,
        left: '20%',
        width: '60%',
        height: 200,
        backgroundColor: 'rgba(79,70,229,0.15)',
        borderRadius: 100,
        transform: [{ scaleY: 0.5 }],
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 32,
    },
    headerContainer: {
        marginBottom: 32,
    },
    logoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    logoIconContainer: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: 'rgba(96,165,250,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(96,165,250,0.22)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    logoText: {
        color: theme.colors.primary,
        fontSize: 18,
        fontFamily: theme.typography.fontFamily.bold,
    },
    title: {
        color: theme.colors.primary,
        fontSize: 36,
        fontFamily: theme.typography.fontFamily.bold,
        marginBottom: 8,
    },
    subtitle: {
        color: theme.colors.secondary,
        fontSize: 14,
        lineHeight: 22,
        fontFamily: theme.typography.fontFamily.regular,
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(239,68,68,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(239,68,68,0.2)',
        borderRadius: theme.borderRadius.md,
        padding: 12,
        marginBottom: 24,
    },
    errorText: {
        color: theme.colors.error,
        fontSize: 13,
        marginLeft: 8,
        flex: 1,
    },
    formContainer: {
        gap: 16,
    },
    inputGroup: {
        gap: 8,
    },
    label: {
        color: theme.colors.tertiary,
        fontSize: 11,
        fontFamily: theme.typography.fontFamily.bold,
        letterSpacing: 1,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.inputBackground,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.borderRadius.lg,
        paddingHorizontal: 16,
        height: 56,
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        color: theme.colors.primary,
        fontSize: 15,
        fontFamily: theme.typography.fontFamily.regular,
        height: '100%',
    },
    eyeBtn: {
        padding: 8,
        marginRight: -8,
    },
    loginBtn: {
        backgroundColor: theme.colors.accent,
        height: 60,
        borderRadius: theme.borderRadius.lg,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 8,
        shadowColor: theme.colors.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
        elevation: 8,
    },
    loginBtnDisabled: {
        opacity: 0.5,
    },
    btnContentSpacer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    loginBtnText: {
        color: '#fff',
        fontSize: 16,
        fontFamily: theme.typography.fontFamily.bold,
    },
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 24,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: theme.colors.border,
    },
    dividerText: {
        color: theme.colors.tertiary,
        paddingHorizontal: 16,
        fontSize: 11,
        fontFamily: theme.typography.fontFamily.bold,
        letterSpacing: 1,
    },
    registerBtn: {
        height: 56,
        borderRadius: theme.borderRadius.lg,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    registerBtnText: {
        color: theme.colors.secondary,
        fontSize: 14,
        fontFamily: theme.typography.fontFamily.semibold,
    },
    footerInfo: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 32,
        gap: 6,
    },
    footerText: {
        color: theme.colors.tertiary,
        fontSize: 12,
    }
});
