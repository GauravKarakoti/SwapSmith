import useSWR from 'swr';

interface AgentReputation {
  totalSwaps: number;
  successRate: number;
  successCount: number;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json()).then(data => data.data);

export function useAgentReputation() {
  const { data, error, isLoading } = useSWR<AgentReputation>('/api/agent-reputation', fetcher, {
    refreshInterval: 60000, // Refresh every minute
    revalidateOnFocus: false,
  });

  return {
    reputation: data,
    isLoading,
    isError: error,
  };
}
