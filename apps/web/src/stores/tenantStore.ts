import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface TenantLodge {
  id: string;
  name: string;
  number: string;
  slug: string | null;
  subdomain: string | null;
  domainStatus: 'NONE' | 'PROVISIONING' | 'PENDING_DNS' | 'PENDING_VERIFICATION' | 'ACTIVE' | 'ERROR';
  siteMode: 'PUBLIC_PAGE' | 'LOGIN_DIRECT';
  crestUrl?: string | null;
  role?: string;
}

interface TenantState {
  activeLodgeId: string | null;
  lodges: TenantLodge[];
  setActive: (id: string | null) => void;
  setLodges: (lodges: TenantLodge[]) => void;
  reset: () => void;
}

export const useTenantStore = create<TenantState>()(
  persist(
    (set) => ({
      activeLodgeId: null,
      lodges: [],
      setActive: (id) => set({ activeLodgeId: id }),
      setLodges: (lodges) => set({ lodges }),
      reset: () => set({ activeLodgeId: null, lodges: [] }),
    }),
    { name: 'lodgekey-tenant' },
  ),
);

export function getActiveLodge(): TenantLodge | null {
  const { activeLodgeId, lodges } = useTenantStore.getState();
  return lodges.find((l) => l.id === activeLodgeId) || null;
}
