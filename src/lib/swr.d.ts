import type * as React from 'react';

declare module 'swr' {
  export interface SWRConfiguration<Data = any> {
    refreshInterval?: number;
    revalidateOnFocus?: boolean;
    revalidateOnReconnect?: boolean;
    dedupingInterval?: number;
    errorRetryCount?: number;
    fallback?: Record<string, any>;
    fetcher?: (key: string) => Promise<Data>;
  }

  export interface SWRResponse<Data = any> {
    data: Data | undefined;
    error: any;
    isLoading: boolean;
    isValidating: boolean;
    mutate: (
      data?:
        | Data
        | undefined
        | Promise<Data | undefined>
        | ((prev: Data | undefined) => Data | undefined),
      shouldRevalidate?: boolean
    ) => Promise<Data | undefined>;
  }

  export type SWRConfigProps<Data = any> = {
    value: SWRConfiguration<Data>;
    children?: React.ReactNode;
  };

  export function SWRConfig<Data = any>(
    props: SWRConfigProps<Data>
  ): React.ReactElement | null;

  export default function useSWR<Data = any>(
    key: string | null,
    fetcher?: (key: string) => Promise<Data>,
    config?: SWRConfiguration<Data>
  ): SWRResponse<Data>;
}

