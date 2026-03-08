import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { Terminal, TrendingUp, PieChart, Star, User } from 'lucide-react-native';

import { MainTabParamList } from '../types/navigation';
import { theme } from '../theme/theme';

import TerminalScreen from '../screens/main/TerminalScreen';
import PricesScreen from '../screens/main/PricesScreen';
import PortfolioScreen from '../screens/main/PortfolioScreen';
import WatchlistScreen from '../screens/main/WatchlistScreen';
import ProfileScreen from '../screens/main/ProfileScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainNavigator() {
    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarStyle: styles.tabBar,
                tabBarShowLabel: false,
                tabBarBackground: () => (
                    <View style={[StyleSheet.absoluteFill, styles.tabBarBackground]} />
                ),
            }}
        >
            <Tab.Screen
                name="Terminal"
                component={TerminalScreen}
                options={{
                    tabBarIcon: ({ color, focused }) => (
                        <TabIcon Icon={Terminal} name="Chat" focused={focused} color={color} />
                    ),
                }}
            />
            <Tab.Screen
                name="Prices"
                component={PricesScreen}
                options={{
                    tabBarIcon: ({ color, focused }) => (
                        <TabIcon Icon={TrendingUp} name="Prices" focused={focused} color={color} />
                    ),
                }}
            />
            <Tab.Screen
                name="Portfolio"
                component={PortfolioScreen}
                options={{
                    tabBarIcon: ({ color, focused }) => (
                        <TabIcon Icon={PieChart} name="Portfolio" focused={focused} color={color} />
                    ),
                }}
            />
            <Tab.Screen
                name="Watchlist"
                component={WatchlistScreen}
                options={{
                    tabBarIcon: ({ color, focused }) => (
                        <TabIcon Icon={Star} name="Watchlist" focused={focused} color={color} />
                    ),
                }}
            />
            <Tab.Screen
                name="Profile"
                component={ProfileScreen}
                options={{
                    tabBarIcon: ({ color, focused }) => (
                        <TabIcon Icon={User} name="Profile" focused={focused} color={color} />
                    ),
                }}
            />
        </Tab.Navigator>
    );
}

const TabIcon = ({ Icon, name, focused, color }: any) => {
    return (
        <View style={[
            styles.iconContainer,
            focused && { backgroundColor: 'rgba(59, 130, 246, 0.1)' }
        ]}>
            <Icon
                color={focused ? theme.colors.accentLight : theme.colors.tertiary}
                size={24}
                strokeWidth={focused ? 2.5 : 2}
            />
            {focused && (
                <View style={styles.activeIndicator} />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    tabBar: {
        position: 'absolute',
        borderTopWidth: 0,
        elevation: 0,
        height: Platform.OS === 'ios' ? 88 : 70,
        backgroundColor: 'transparent',
    },
    tabBarBackground: {
        backgroundColor: 'rgba(7, 7, 16, 0.85)', // Glassmorphic background
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.05)',
    },
    iconContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 10,
        borderRadius: 16,
        width: 48,
        height: 48,
        marginTop: Platform.OS === 'ios' ? 10 : 0,
    },
    activeIndicator: {
        position: 'absolute',
        bottom: -8,
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: theme.colors.accentLight,
    }
});
