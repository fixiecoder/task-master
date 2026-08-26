import type { ListItem } from '../types';
import { CATEGORY_LABELS } from '../api';

interface ListItemRowProps {
  item: ListItem;
  checked: boolean;
  showCheckbox: boolean;
  showCategory: boolean;
  onToggle: (item: ListItem) => void;
  onEditName: (item: ListItem) => void;
  onEditCategory: (item: ListItem) => void;
  onDelete: (item: ListItem) => void;
}

export function ListItemRow({
  item, checked, showCheckbox, showCategory, onToggle, onEditName, onEditCategory, onDelete,
}: ListItemRowProps) {
  return (
    <li className={`list-item ${checked && showCheckbox ? 'checked' : ''}`}>
      {showCheckbox && (
        <input
          type="checkbox"
          className="list-item-checkbox"
          checked={checked}
          onChange={() => onToggle(item)}
          aria-label={`Mark ${item.name} as done`}
        />
      )}
      <button
        type="button"
        className="list-item-name list-item-name-button"
        onClick={() => onEditName(item)}
      >
        {item.name}
      </button>
      {showCategory && (
        <button
          type="button"
          className={`shopping-category-pill shopping-category-pill-button ${item.category ? `shopping-category-${item.category}` : 'shopping-category-unset'}`}
          onClick={() => onEditCategory(item)}
        >
          {item.category ? CATEGORY_LABELS[item.category] : 'Category'}
        </button>
      )}
      <button
        type="button"
        className="list-item-remove"
        onClick={() => onDelete(item)}
        aria-label={`Remove ${item.name}`}
      >
        ×
      </button>
    </li>
  );
}
