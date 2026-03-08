import { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParamList = {
    Terminal: undefined;
    Prices: undefined;
    Portfolio: undefined;
    Watchlist: undefined;
    Profile: undefined;
};

export type AuthStackParamList = {
    Login: undefined;
    Register: undefined;
};

export type RootStackParamList = {
    Auth: NavigatorScreenParams<AuthStackParamList>;
    Main: NavigatorScreenParams<MainTabParamList>;
    Rewards: undefined;
    Strategies: undefined;
};
