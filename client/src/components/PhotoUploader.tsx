import { useRef, useState } from 'react';
import { api, tokenStore } from '../api/client';
import type { Photo } from '../types';

interface Props {
  visitId: string;
  photos: Photo[];
  onChange: (photos: Photo[]) => void;
}

const MAX = 20;

export function PhotoUploader({ visitId, photos, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const upload = async (files: FileList) => {
    setError('');
    const remaining = MAX - photos.length;
    const list = Array.from(files).slice(0, remaining);
    if (files.length > remaining) setError(`최대 ${MAX}장까지 가능합니다.`);
    setUploading(true);
    try {
      const added: Photo[] = [];
      for (const file of list) {
        const form = new FormData();
        form.append('image', file);
        // fetch 직접 사용 (api.post 도 FormData 지원하나 명시적으로 처리)
        const res = await fetch(`/api/photos/visit/${visitId}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${tokenStore.get()}` },
          body: form,
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d?.error?.message ?? '업로드 실패');
        }
        added.push(await res.json());
      }
      onChange([...photos, ...added]);
    } catch (e) {
      setError(e instanceof Error ? e.message : '업로드 실패');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const remove = async (id: string) => {
    await api.delete(`/photos/${id}`);
    onChange(photos.filter((p) => p.id !== id));
  };

  return (
    <div>
      <div className="grid grid-cols-4 gap-2">
        {photos.map((p) => (
          <div key={p.id} className="group relative aspect-square overflow-hidden rounded-xl">
            <img src={p.imagePath} alt={p.caption ?? ''} className="h-full w-full object-cover" />
            <button
              onClick={() => remove(p.id)}
              className="absolute right-1 top-1 hidden rounded-full bg-black/60 px-1.5 text-xs text-white group-hover:block"
            >
              ✕
            </button>
          </div>
        ))}
        {photos.length < MAX && (
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex aspect-square items-center justify-center rounded-xl border-2 border-dashed border-white/50 bg-white/30 text-2xl text-slate-400 transition hover:bg-white/50 dark:bg-white/5"
          >
            {uploading ? '…' : '＋'}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && upload(e.target.files)}
      />
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
    </div>
  );
}
