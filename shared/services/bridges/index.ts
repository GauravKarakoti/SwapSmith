/**
 * Bridge Adapters Index
 * Export all bridge protocol adapters
 */

import { BaseBridgeAdapter } from './base-bridge-adapter';
import { AcrossAdapter, createAcrossAdapter } from './across-adapter';
import { StargateAdapter, createStargateAdapter } from './stargate-adapter';
import { LayerZeroAdapter, createLayerZeroAdapter } from './layerzero-adapter';
import { WormholeAdapter, createWormholeAdapter } from './wormhole-adapter';

export {
  BaseBridgeAdapter,
  AcrossAdapter,
  StargateAdapter,
  LayerZeroAdapter,
  WormholeAdapter,
  createAcrossAdapter,
  createStargateAdapter,
  createLayerZeroAdapter,
  createWormholeAdapter,
};

// Export types
export type {
  BridgeQuote,
  BridgeOrder,
  BridgeQuoteRequest,
  BridgeOrderRequest,
} from './base-bridge-adapter';

// Factory function to create all adapters
export function createAllAdapters(): Map<string, BaseBridgeAdapter> {
  const adapters = new Map<string, BaseBridgeAdapter>();
  
  adapters.set('across', createAcrossAdapter());
  adapters.set('stargate', createStargateAdapter());
  adapters.set('layerzero', createLayerZeroAdapter());
  adapters.set('wormhole', createWormholeAdapter());
  
  return adapters;
}

// Create a specific adapter
export function createAdapter(bridgeName: string): BaseBridgeAdapter | null {
  const adapters: Record<string, () => BaseBridgeAdapter> = {
    across: createAcrossAdapter,
    stargate: createStargateAdapter,
    layerzero: createLayerZeroAdapter,
    wormhole: createWormholeAdapter,
  };
  
  const factory = adapters[bridgeName.toLowerCase()];
  return factory ? factory() : null;
}
