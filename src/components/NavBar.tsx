import { NavLink } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/', label: 'Board', end: true },
  { to: '/calendar', label: 'Calendar', end: false },
  { to: '/shopping', label: 'Shopping', end: false },
  { to: '/settings', label: 'Settings', end: false },
];

export function NavBar() {
  return (
    <nav className="nav-bar">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
