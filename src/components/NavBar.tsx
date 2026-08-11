import { NavLink } from 'react-router-dom';
import { BoardIcon, CalendarIcon, ProjectsIcon, SettingsIcon, ShoppingIcon } from '../icons';

const NAV_ITEMS = [
  { to: '/', label: 'Board', end: true, Icon: BoardIcon },
  { to: '/calendar', label: 'Calendar', end: false, Icon: CalendarIcon },
  { to: '/shopping', label: 'Shopping', end: false, Icon: ShoppingIcon },
  { to: '/projects', label: 'Projects', end: false, Icon: ProjectsIcon },
  { to: '/settings', label: 'Settings', end: false, Icon: SettingsIcon },
];

export function NavBar() {
  return (
    <nav className="nav-bar">
      {NAV_ITEMS.map(({ to, label, end, Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          aria-label={label}
          title={label}
        >
          <Icon />
        </NavLink>
      ))}
    </nav>
  );
}
