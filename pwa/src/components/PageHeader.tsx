import { ChevronLeft } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useGoBack } from '../lib/navigation';

/**
 * iOS-style navigation bar. With `large`, the big title scrolls with the page and the
 * compact title fades into the bar once it is gone (like UINavigationBar large titles).
 */
export function PageHeader({
  title,
  large = false,
  back,
  left,
  right,
}: {
  title: string;
  large?: boolean;
  /** Where "Indietro" goes when there is no in-app history (e.g. opened from a notification). */
  back?: string;
  left?: ReactNode;
  right?: ReactNode;
}) {
  const goBack = useGoBack();
  const largeTitle = useRef<HTMLHeadingElement>(null);
  const [collapsed, setCollapsed] = useState(!large);

  useEffect(() => {
    if (!large || !largeTitle.current) return;
    const observer = new IntersectionObserver(([entry]) => setCollapsed(!entry.isIntersecting), {
      rootMargin: '-64px 0px 0px 0px',
    });
    observer.observe(largeTitle.current);
    return () => observer.disconnect();
  }, [large]);

  return (
    <>
      <header className={`page-header${collapsed ? ' is-collapsed' : ''}`}>
        <div className="page-header-bar">
          <div className="page-header-side">
            {back ? (
              <button type="button" className="nav-button nav-back" onClick={() => goBack(back)}>
                <ChevronLeft size={28} aria-hidden="true" />
                <span>Indietro</span>
              </button>
            ) : (
              left
            )}
          </div>
          {large ? (
            <div className="page-header-title" aria-hidden="true">
              {title}
            </div>
          ) : (
            <h1 className="page-header-title">{title}</h1>
          )}
          <div className="page-header-side is-right">{right}</div>
        </div>
      </header>
      {large && (
        <h1 ref={largeTitle} className="page-header-large">
          {title}
        </h1>
      )}
    </>
  );
}
