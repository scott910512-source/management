import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useData } from '../context/DataContext';
import type { Photo, Region, Visit, VisitStatus, Visibility } from '../types';
import { STATUS_META, VISIBILITY_META } from '../utils/constants';
import { todayInput } from '../utils/format';
import { PhotoUploader } from './PhotoUploader';

interface Props {
  region: Region;
  onClose: () => void;
}

export function VisitModal({ region, onClose }: Props) {
  const { visitByRegion, upsertVisit, deleteVisit, toggleWishlist, wishlistRegionIds } = useData();
  const existing: Visit | undefined = visitByRegion.get(region.id);

  const [status, setStatus] = useState<VisitStatus>(existing?.status ?? 'VISITED');
  const [visitDate, setVisitDate] = useState<string>(
    existing?.visitDate ? existing.visitDate.slice(0, 10) : todayInput(),
  );
  const [memo, setMemo] = useState(existing?.memo ?? '');
  const [visibility, setVisibility] = useState<Visibility>(existing?.visibility ?? 'PRIVATE');
  const [photos, setPhotos] = useState<Photo[]>(existing?.photos ?? []);
  const [saving, setSaving] = useState(false);
  const [currentVisitId, setCurrentVisitId] = useState<string | undefined>(existing?.id);

  const isWished = wishlistRegionIds.has(region.id);

  useEffect(() => {
    if (currentVisitId) {
      api.get<Photo[]>(`/photos/visit/${currentVisitId}`).then(setPhotos).catch(() => {});
    }
  }, [currentVisitId]);

  const save = async () => {
    setSaving(true);
    try {
      const visit = await upsertVisit({
        regionId: region.id,
        status,
        visitDate: status === 'VISITED' ? visitDate : null,
        memo,
        visibility,
      });
      setCurrentVisitId(visit.id);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (existing && confirm('이 방문 기록을 삭제할까요?')) {
      await deleteVisit(existing.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="glass relative z-10 max-h-[92vh] w-full max-w-lg animate-pop overflow-auto p-6 sm:rounded-3xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <div className="text-xs text-slate-500">{region.provinceName}</div>
            <h2 className="text-xl font-extrabold">{region.district}</h2>
          </div>
          <button onClick={onClose} className="btn-ghost px-2.5 py-1.5">
            ✕
          </button>
        </div>

        {/* 상태 선택 */}
        <label className="mb-1 block text-sm font-semibold">방문 상태</label>
        <div className="mb-4 grid grid-cols-3 gap-2">
          {(Object.keys(STATUS_META) as VisitStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`rounded-xl border-2 px-2 py-2.5 text-sm font-semibold transition ${
                status === s ? 'border-brand bg-brand/10' : 'border-transparent bg-white/40 dark:bg-white/5'
              }`}
            >
              <span
                className="mr-1 inline-block h-3 w-3 rounded-full align-middle"
                style={{ background: STATUS_META[s].color }}
              />
              {STATUS_META[s].label}
            </button>
          ))}
        </div>

        {/* 방문일 */}
        {status === 'VISITED' && (
          <div className="mb-4">
            <label className="mb-1 block text-sm font-semibold">방문일</label>
            <input
              type="date"
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
              className="glass-input"
            />
          </div>
        )}

        {/* 메모 */}
        <div className="mb-4">
          <label className="mb-1 block text-sm font-semibold">여행 메모</label>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={4}
            placeholder={'예) 하회마을 관광\n찜닭 맛집 방문'}
            className="glass-input resize-none"
          />
        </div>

        {/* 공개 범위 */}
        <div className="mb-4">
          <label className="mb-1 block text-sm font-semibold">공개 범위</label>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(VISIBILITY_META) as Visibility[]).map((v) => (
              <button
                key={v}
                onClick={() => setVisibility(v)}
                title={VISIBILITY_META[v].desc}
                className={`rounded-xl border-2 px-2 py-2 text-xs font-semibold transition ${
                  visibility === v ? 'border-brand bg-brand/10' : 'border-transparent bg-white/40 dark:bg-white/5'
                }`}
              >
                {VISIBILITY_META[v].emoji} {VISIBILITY_META[v].label}
              </button>
            ))}
          </div>
        </div>

        {/* 사진 */}
        <div className="mb-5">
          <label className="mb-1 block text-sm font-semibold">
            사진 {photos.length > 0 && <span className="text-slate-500">({photos.length}/20)</span>}
          </label>
          {currentVisitId ? (
            <PhotoUploader visitId={currentVisitId} photos={photos} onChange={setPhotos} />
          ) : (
            <p className="rounded-xl bg-white/30 px-3 py-3 text-xs text-slate-500 dark:bg-white/5">
              먼저 기록을 저장하면 사진을 추가할 수 있어요.
            </p>
          )}
        </div>

        {/* 액션 */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => toggleWishlist(region.id)}
            className={`btn-ghost ${isWished ? 'text-amber-500' : ''}`}
            title="버킷리스트"
          >
            {isWished ? '⭐ 버킷' : '☆ 버킷'}
          </button>
          <div className="flex-1" />
          {existing && (
            <button onClick={remove} className="btn-ghost text-red-500">
              삭제
            </button>
          )}
          <button onClick={save} className="btn-primary" disabled={saving}>
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
