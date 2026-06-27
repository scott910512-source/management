import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api } from '../api/client';
import type { Region, Visit, WishlistItem, VisitStatus, Visibility } from '../types';
import { useAuth } from './AuthContext';

interface UpsertArgs {
  regionId: string;
  status: VisitStatus;
  visitDate?: string | null;
  memo?: string | null;
  visibility?: Visibility;
}

interface DataCtx {
  regions: Region[];
  visits: Visit[];
  wishlist: WishlistItem[];
  loading: boolean;
  /** regionId → Visit */
  visitByRegion: Map<string, Visit>;
  /** regionId 집합 (버킷리스트) */
  wishlistRegionIds: Set<string>;
  newBadges: string[];
  clearNewBadges: () => void;
  refresh: () => Promise<void>;
  upsertVisit: (args: UpsertArgs) => Promise<Visit>;
  deleteVisit: (visitId: string) => Promise<void>;
  toggleWishlist: (regionId: string) => Promise<void>;
}

const Ctx = createContext<DataCtx | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [regions, setRegions] = useState<Region[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newBadges, setNewBadges] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [r, v, w] = await Promise.all([
        api.get<Region[]>('/regions'),
        api.get<Visit[]>('/visits'),
        api.get<WishlistItem[]>('/wishlist'),
      ]);
      setRegions(r);
      setVisits(v);
      setWishlist(w);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) void refresh();
  }, [user, refresh]);

  const upsertVisit = useCallback(async (args: UpsertArgs) => {
    const res = await api.put<{ visit: Visit; newBadges: string[] }>('/visits', args);
    setVisits((prev) => {
      const idx = prev.findIndex((v) => v.regionId === args.regionId);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = res.visit;
        return copy;
      }
      return [res.visit, ...prev];
    });
    if (res.newBadges.length) setNewBadges((b) => [...b, ...res.newBadges]);
    return res.visit;
  }, []);

  const deleteVisit = useCallback(async (visitId: string) => {
    await api.delete(`/visits/${visitId}`);
    setVisits((prev) => prev.filter((v) => v.id !== visitId));
  }, []);

  const toggleWishlist = useCallback(
    async (regionId: string) => {
      const exists = wishlist.some((w) => w.regionId === regionId);
      if (exists) {
        await api.delete(`/wishlist/${regionId}`);
        setWishlist((prev) => prev.filter((w) => w.regionId !== regionId));
      } else {
        const item = await api.post<WishlistItem>('/wishlist', { regionId });
        setWishlist((prev) => [item, ...prev]);
      }
    },
    [wishlist],
  );

  const visitByRegion = useMemo(() => {
    const map = new Map<string, Visit>();
    for (const v of visits) map.set(v.regionId, v);
    return map;
  }, [visits]);

  const wishlistRegionIds = useMemo(
    () => new Set(wishlist.map((w) => w.regionId)),
    [wishlist],
  );

  const value: DataCtx = {
    regions,
    visits,
    wishlist,
    loading,
    visitByRegion,
    wishlistRegionIds,
    newBadges,
    clearNewBadges: () => setNewBadges([]),
    refresh,
    upsertVisit,
    deleteVisit,
    toggleWishlist,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
