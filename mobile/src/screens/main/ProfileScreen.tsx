import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    SafeAreaView,
    TouchableOpacity,
    Switch
} from 'react-native';
import {
    User,
    Mail,
    Settings,
    LogOut,
    ShieldCheck,
    ChevronRight,
    Bell,
    Wallet
} from 'lucide-react-native';

import { theme } from '../../theme/theme';
import { useAuth } from '../../hooks/useAuth';

export default function ProfileScreen() {
    const { user, logout } = useAuth();

    // Mock Settings State
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const [biometricsEnabled, setBiometricsEnabled] = useState(false);

    const handleLogout = async () => {
        try {
            await logout();
        } catch (err) {
            console.error('Logout failed', err);
        }
    };

    const SettingRow = ({ icon: Icon, label, value, type, onToggle }: any) => (
        <View style={styles.settingRow}>
            <View style={styles.settingRowLeft}>
                <View style={styles.settingIconBox}>
                    <Icon color={theme.colors.secondary} size={18} />
                </View>
                <Text style={styles.settingLabel}>{label}</Text>
            </View>

            <View style={styles.settingRowRight}>
                {type === 'toggle' ? (
                    <Switch
                        value={value}
                        onValueChange={onToggle}
                        trackColor={{ false: theme.colors.cardBorder, true: theme.colors.accentLight }}
                        thumbColor={'#fff'}
                    />
                ) : type === 'value' ? (
                    <View style={styles.valueRow}>
                        <Text style={styles.settingValue}>{value}</Text>
                        <ChevronRight color={theme.colors.tertiary} size={16} />
                    </View>
                ) : (
                    <ChevronRight color={theme.colors.tertiary} size={16} />
                )}
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerTitleContainer}>
                    <View style={styles.iconBox}>
                        <User color="#fff" size={20} />
                    </View>
                    <Text style={styles.headerTitle}>My <Text style={styles.headerTitleAccent}>Profile</Text></Text>
                </View>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Profile Card */}
                <View style={styles.profileCard}>
                    <View style={styles.avatarContainer}>
                        <View style={styles.avatar}>
                            <User color="#fff" size={32} />
                        </View>
                        <View style={styles.avatarBadge}>
                            <ShieldCheck color="#fff" size={12} />
                        </View>
                    </View>

                    <Text style={styles.emailText}>{user?.email || 'user@example.com'}</Text>
                    <View style={styles.statusBadge}>
                        <Text style={styles.statusText}>Pro Plan Active</Text>
                    </View>
                </View>

                {/* Settings Sections */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>ACCOUNT</Text>
                    <View style={styles.settingsGroup}>
                        <SettingRow
                            icon={Mail}
                            label="Email Address"
                            value={user?.email}
                            type="value"
                        />
                        <SettingRow
                            icon={Wallet}
                            label="Connected Wallets"
                            value="1 Wallet"
                            type="value"
                        />
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>PREFERENCES</Text>
                    <View style={styles.settingsGroup}>
                        <SettingRow
                            icon={Bell}
                            label="Push Notifications"
                            value={notificationsEnabled}
                            onToggle={setNotificationsEnabled}
                            type="toggle"
                        />
                        <SettingRow
                            icon={ShieldCheck}
                            label="Biometric Auth"
                            value={biometricsEnabled}
                            onToggle={setBiometricsEnabled}
                            type="toggle"
                        />
                        <SettingRow
                            icon={Settings}
                            label="App Settings"
                            type="link"
                        />
                    </View>
                </View>

                {/* Logout Button */}
                <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                    <LogOut color={theme.colors.error} size={20} style={{ marginRight: 8 }} />
                    <Text style={styles.logoutText}>Sign Out</Text>
                </TouchableOpacity>

                <Text style={styles.versionText}>SwapSmith Mobile v1.0.0</Text>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    header: {
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: theme.colors.backgroundAlt,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    headerTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    iconBox: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#3B82F6',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    headerTitle: {
        color: theme.colors.primary,
        fontSize: 24,
        fontFamily: theme.typography.fontFamily.black,
        letterSpacing: -0.5,
    },
    headerTitleAccent: {
        color: '#60A5FA',
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 100, // For bottom tabs
    },
    profileCard: {
        alignItems: 'center',
        backgroundColor: theme.colors.card,
        borderRadius: theme.borderRadius.xl,
        padding: 24,
        borderWidth: 1,
        borderColor: theme.colors.border,
        marginBottom: 24,
    },
    avatarContainer: {
        position: 'relative',
        marginBottom: 16,
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 24,
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        borderWidth: 2,
        borderColor: theme.colors.accentLight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarBadge: {
        position: 'absolute',
        bottom: -4,
        right: -4,
        backgroundColor: theme.colors.success,
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: theme.colors.background,
    },
    emailText: {
        color: theme.colors.primary,
        fontSize: 18,
        fontFamily: theme.typography.fontFamily.bold,
        marginBottom: 8,
    },
    statusBadge: {
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    statusText: {
        color: theme.colors.accentLight,
        fontSize: 12,
        fontFamily: theme.typography.fontFamily.bold,
        textTransform: 'uppercase',
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        color: theme.colors.tertiary,
        fontSize: 12,
        fontFamily: theme.typography.fontFamily.bold,
        letterSpacing: 1.5,
        marginBottom: 12,
        marginLeft: 4,
    },
    settingsGroup: {
        backgroundColor: theme.colors.card,
        borderRadius: theme.borderRadius.lg,
        borderWidth: 1,
        borderColor: theme.colors.border,
        overflow: 'hidden',
    },
    settingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.cardBorder,
    },
    settingRowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    settingIconBox: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    settingLabel: {
        color: theme.colors.primary,
        fontSize: 15,
        fontFamily: theme.typography.fontFamily.medium,
    },
    settingRowRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    valueRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    settingValue: {
        color: theme.colors.secondary,
        fontSize: 14,
        fontFamily: theme.typography.fontFamily.medium,
    },
    logoutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(248, 113, 113, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(248, 113, 113, 0.2)',
        paddingVertical: 16,
        borderRadius: theme.borderRadius.lg,
        marginTop: 8,
        marginBottom: 24,
    },
    logoutText: {
        color: theme.colors.error,
        fontSize: 16,
        fontFamily: theme.typography.fontFamily.bold,
    },
    versionText: {
        color: theme.colors.tertiary,
        fontSize: 12,
        textAlign: 'center',
        fontFamily: theme.typography.fontFamily.regular,
    }
});
