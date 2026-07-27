import { useEffect, useLayoutEffect, useRef, useState } from 'react';

interface ContextMenuItem {
  label: string;
  onSelect: () => void;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

const MENU_MARGIN = 8;

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const { offsetWidth, offsetHeight } = menu;
    const maxLeft = window.innerWidth - offsetWidth - MENU_MARGIN;
    const maxTop = window.innerHeight - offsetHeight - MENU_MARGIN;
    setPosition({
      left: Math.max(MENU_MARGIN, Math.min(x, maxLeft)),
      top: Math.max(MENU_MARGIN, Math.min(y, maxTop)),
    });
  }, [x, y]);

  useEffect(() => {
    function handlePointerDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{ left: position.left, top: position.top }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          className="context-menu-item"
          onClick={() => {
            item.onSelect();
            onClose();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
