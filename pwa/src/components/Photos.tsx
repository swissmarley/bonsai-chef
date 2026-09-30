import { CircleAlert, ImagePlus, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { Photo } from '../../shared/model';
import { api, photoUrl } from '../lib/api';
import { prepareImage } from '../lib/images';
import { Dialog } from './Dialog';
import { Spinner } from './States';
import { useToast } from './Toast';

export interface PhotoItem {
  key: string;
  id?: string;
  src: string;
  status: 'uploading' | 'ready' | 'error';
  error?: string;
}

export const toPhotoItems = (photos: Photo[]): PhotoItem[] =>
  photos.map((p) => ({ key: p.id, id: p.id, src: photoUrl(p.id), status: 'ready' }));

/** Photo section of the add/edit forms: pick several images, upload them right away, remove with ×. */
export function PhotoEditor({ items, setItems }: { items: PhotoItem[]; setItems: Dispatch<SetStateAction<PhotoItem[]>> }) {
  const input = useRef<HTMLInputElement>(null);
  const toast = useToast();

  async function addFiles(files: File[]) {
    const added = files.map((file) => ({
      file,
      item: { key: crypto.randomUUID(), src: URL.createObjectURL(file), status: 'uploading' } as PhotoItem,
    }));
    setItems((list) => [...list, ...added.map((a) => a.item)]);
    // One at a time: decoding several full-size camera photos at once can exhaust memory on phones.
    for (const { file, item } of added) {
      try {
        const image = await prepareImage(file);
        const photo = await api.uploadPhoto(image.blob, image.width, image.height);
        setItems((list) => list.map((p) => (p.key === item.key ? { ...p, id: photo.id, status: 'ready' } : p)));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Caricamento non riuscito.';
        setItems((list) => list.map((p) => (p.key === item.key ? { ...p, status: 'error', error: message } : p)));
        toast(message, 'error');
      }
    }
  }

  function remove(item: PhotoItem) {
    if (item.src.startsWith('blob:')) URL.revokeObjectURL(item.src);
    setItems((list) => list.filter((p) => p.key !== item.key));
  }

  return (
    <div className="photo-editor">
      {items.map((item, i) => (
        <div key={item.key} className="photo-tile">
          <img src={item.src} alt={`Foto ${i + 1}`} />
          {item.status === 'uploading' && (
            <div className="photo-tile-overlay">
              <Spinner label="Caricamento foto…" />
            </div>
          )}
          {item.status === 'error' && (
            <div className="photo-tile-overlay is-error" title={item.error}>
              <CircleAlert size={22} aria-hidden="true" />
              <span>Errore</span>
            </div>
          )}
          <button type="button" className="photo-tile-remove" aria-label={`Rimuovi foto ${i + 1}`} onClick={() => remove(item)}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      ))}
      <button type="button" className="photo-tile photo-tile-add" onClick={() => input.current?.click()}>
        <ImagePlus size={26} aria-hidden="true" />
        <span>Aggiungi Foto</span>
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (files.length) void addFiles(files);
        }}
      />
    </div>
  );
}

export function PhotoGrid({ photos, onOpen }: { photos: (Photo & { caption?: string })[]; onOpen: (index: number) => void }) {
  return (
    <div className="photo-grid">
      {photos.map((p, i) => (
        <button
          key={p.id}
          type="button"
          className="photo-grid-item"
          onClick={() => onOpen(i)}
          aria-label={`Apri foto ${i + 1} di ${photos.length}${p.caption ? `: ${p.caption}` : ''}`}
        >
          <img src={photoUrl(p.id)} alt="" loading="lazy" />
          {p.caption && <span className="photo-caption">{p.caption.split(' · ')[0]}</span>}
        </button>
      ))}
    </div>
  );
}

/** Full-screen, swipeable gallery (the iOS ImageFullScreenView). */
export function PhotoViewer({ photos, index, onClose }: { photos: (Photo & { caption?: string })[]; index: number; onClose: () => void }) {
  const track = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(index);

  useLayoutEffect(() => {
    const el = track.current!;
    el.scrollLeft = index * el.clientWidth;
  }, [index]);

  const go = (i: number) => {
    const el = track.current!;
    el.scrollTo({ left: Math.max(0, Math.min(photos.length - 1, i)) * el.clientWidth, behavior: 'smooth' });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(current + 1);
      if (e.key === 'ArrowLeft') go(current - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <Dialog title="Foto" onClose={onClose} variant="viewer">
      <div
        ref={track}
        className="viewer-track"
        onScroll={(e) => setCurrent(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
      >
        {photos.map((p, i) => (
          <div key={p.id} className="viewer-slide">
            <img src={photoUrl(p.id)} alt={`Foto ${i + 1} di ${photos.length}`} />
          </div>
        ))}
      </div>
      <div className="viewer-bar">
        <span className="viewer-count">
          {photos[current]?.caption && <span className="viewer-caption">{photos[current].caption}</span>}
          {photos.length > 1 ? `${current + 1} di ${photos.length}` : ''}
        </span>
        <button type="button" className="btn btn-light" onClick={onClose} autoFocus>
          Chiudi
        </button>
      </div>
    </Dialog>
  );
}
