import type { $Fetch } from 'ofetch';
import { $fetch } from 'ofetch';
import { createContext, useContext } from 'react';

export const FetchContext = createContext<$Fetch>($fetch);

export function useFetch() {
  return useContext(FetchContext);
}
