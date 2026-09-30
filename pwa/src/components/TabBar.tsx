import { Link, useLocation } from 'react-router';
import { lastTab, TABS } from '../lib/navigation';

export function TabBar() {
  const { pathname } = useLocation();
  // Detail pages keep the tab they were opened from highlighted, like a pushed iOS view.
  const active = TABS.some((t) => t.path === pathname) ? pathname : lastTab();
  return (
    <nav className="tab-bar" aria-label="Sezioni">
      {TABS.map(({ path, label, icon: Icon }) => (
        <Link key={path} to={path} className={`tab${active === path ? ' is-active' : ''}`} aria-current={active === path ? 'page' : undefined}>
          <Icon size={24} aria-hidden="true" strokeWidth={active === path ? 2.4 : 1.8} />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
