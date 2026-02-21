import { z } from 'zod';

export const SideShiftQuoteSchema = z.object({
    id: z.string().optional(),
    depositCoin: z.string(),
    depositNetwork: z.string(),
    settleCoin: z.string(),
    settleNetwork: z.string(),
    depositAmount: z.string(),
    settleAmount: z.string(),
    rate: z.string(),
    affiliateId: z.string(),
    error: z.object({
        code: z.string(),
        message: z.string(),
    }).optional(),
    memo: z.string().optional(),
    expiry: z.string().optional(),
});

export const SideShiftCheckoutResponseSchema = z.object({
    id: z.string(),
    url: z.string(),
    settleAmount: z.string(),
    settleCoin: z.string(),
});

export const CoinNetworkSchema = z.object({
    network: z.string(),
    tokenContract: z.string().optional(),
    depositAddressType: z.string().optional(),
    depositOffline: z.boolean().optional(),
    settleOffline: z.boolean().optional(),
});

export const CoinSchema = z.object({
    coin: z.string(),
    name: z.string(),
    networks: z.array(CoinNetworkSchema),
    chainData: z.object({
        chain: z.string(),
        mainnet: z.boolean(),
    }).optional(),
});

export const CoinPriceSchema = z.object({
    coin: z.string(),
    name: z.string(),
    network: z.string(),
    usdPrice: z.string().optional(),
    btcPrice: z.string().optional(),
    available: z.boolean(),
});

export type SideShiftQuote = z.infer<typeof SideShiftQuoteSchema>;
export type SideShiftCheckoutResponse = z.infer<typeof SideShiftCheckoutResponseSchema>;
export type Coin = z.infer<typeof CoinSchema>;
export type CoinPrice = z.infer<typeof CoinPriceSchema>;
