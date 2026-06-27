import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { PageHeader, EmptyState } from '../components/ui';

export function WishlistPage() {
  const { wishlist, toggleWishlist, visitByRegion } = useData();
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="버킷리스트" desc="가고 싶은 지역을 모아두세요." icon="⭐" />

      {wishlist.length === 0 ? (
        <EmptyState icon="⭐" text="아직 버킷리스트가 비어있어요. 지도에서 가고 싶은 지역을 담아보세요!" />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {wishlist.map((w) => {
            const visited = visitByRegion.get(w.regionId)?.status === 'VISITED';
            return (
              <div key={w.id} className="glass relative p-4">
                <button
                  onClick={() => toggleWishlist(w.regionId)}
                  className="absolute right-2 top-2 text-amber-400 transition hover:scale-110"
                  title="버킷리스트에서 제거"
                >
                  ⭐
                </button>
                <div className="text-xs text-slate-500">{w.region?.provinceName}</div>
                <div className="mt-1 text-lg font-bold">{w.region?.district}</div>
                {visited ? (
                  <span className="mt-2 inline-block rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-600">
                    ✅ 방문 완료
                  </span>
                ) : (
                  <button
                    onClick={() => navigate(`/map?region=${w.regionId}`)}
                    className="mt-2 text-xs text-brand-600 hover:underline"
                  >
                    기록하러 가기 →
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
