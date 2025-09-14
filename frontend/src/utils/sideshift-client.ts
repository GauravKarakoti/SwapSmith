import axios from 'axios';

const SIDESHIFT_BASE_URL = "https://sideshift.ai/api/v2";
// Read credentials from environment variables for security
const AFFILIATE_ID = process.env.NEXT_PUBLIC_AFFILIATE_ID;
const API_KEY = process.env.NEXT_PUBLIC_SIDESHIFT_API_KEY;

// Define TypeScript interfaces to match the SideShift API response
interface SideShiftPair {
  depositCoin: string,
  settleCoin: string,
  depositNetwork: string,
  settleNetwork: string,
  min: string,
  max: string,
  rate: string
}

interface SideShiftQuote {
  depositCoin: string,
  depositNetwork: string,
  settleCoin: string,
  settleNetwork: string,
  depositAmount: string | null,
  settleAmount: string | null,
  affiliateId: string,
}

/**
 * Fetches the list of all available trading pairs from the SideShift API.
 * @returns {Promise<SideShiftPair[]>} A promise that resolves to an array of pair objects.
 */
export async function getPairs(from:string,to:string): Promise<SideShiftPair[]> {
  try {
    const response = await axios.get<SideShiftPair[]>(`${SIDESHIFT_BASE_URL}/pairs?affiliateId=${AFFILIATE_ID}&pairs=${from},${to}`, {
      headers: { 
        'x-sideshift-secret': API_KEY 
      },
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching SideShift pairs:", error);
    // Check if it's an Axios error to extract the specific API message
    if (axios.isAxiosError(error) && error.response) {
      const apiErrorMessage = error.response.data?.error?.message || 'Failed to fetch trading pairs.';
      throw new Error(apiErrorMessage);
    }
    // Fallback for non-API errors
    throw new Error("Failed to fetch trading pairs.");
  }
}

/**
 * Creates a swap quote using the SideShift API based on dynamic user input.
 * @param {string} fromAsset - The symbol of the asset to deposit (e.g., "MATIC").
 * @param {string} fromNetwork - The network of the deposit asset (e.g., "Polygon").
 * @param {string} toAsset - The symbol of the asset to receive (e.g., "USDC").
 * @param {string} toNetwork - The network of the settle asset (e.g., "Arbitrum").
 * @param {number} amount - The amount of the deposit asset to swap.
 * @returns {Promise<SideShiftQuote>} A promise that resolves to the quote object.
 */
export async function createQuote(fromAsset: string, fromNetwork: string, toAsset: string, toNetwork: string, amount: number): Promise<SideShiftQuote> {
  try {
    const pairs = await getPairs(`${fromAsset.toLowerCase()}-${fromNetwork.toLowerCase()}`, `${toAsset.toLowerCase()}-${toNetwork.toLowerCase()}`);
    console.log("Available pairs:", pairs);
    
    // Find if the requested pair exists
    const pair = pairs.find(
      (p) => p.depositCoin === fromAsset && p.settleCoin === toAsset &&
             p.depositNetwork === fromNetwork && p.settleNetwork === toNetwork
    );
    
    if (!pair) {
      throw new Error(`Trading pair ${fromAsset} on ${fromNetwork} to ${toAsset} on ${toNetwork} not found`);
    }

    let config = {
      depositCoin: fromAsset,
      depositNetwork: fromNetwork,
      settleCoin: toAsset,
      settleNetwork: toNetwork,
      depositAmount: amount,
      settleAmount: null,
      affiliateId: AFFILIATE_ID,
    };
    console.log("Quote request config:", config);

    // Create the quote using the validated methods
    const response = await axios.post<SideShiftQuote>(`${SIDESHIFT_BASE_URL}/quotes`, config, {
      headers: {
        'Content-Type': 'application/json',
        'x-sideshift-secret': API_KEY
      }
    });

    return response.data;

  } catch (error) {
    console.error("Error creating SideShift quote:", error);
    // Check if it's an Axios error to extract the specific API message
    if (axios.isAxiosError(error) && error.response) {
        const apiErrorMessage = error.response.data?.error?.message || `Failed to create quote for ${fromAsset} to ${toAsset}.`;
        throw new Error(apiErrorMessage);
    }
    // Fallback for non-API errors
    throw new Error(`Failed to create quote for ${fromAsset} to ${toAsset}.`);
  }
}