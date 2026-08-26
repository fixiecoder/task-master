import type { ListItem, ShoppingCategory } from '../types';
import { CATEGORY_LABELS, CATEGORY_ORDER } from '../api';

interface EditListItemCategoryModalProps {
  item: ListItem;
  onClose: () => void;
  onSelect: (category: ShoppingCategory) => void;
}

export function EditListItemCategoryModal({ item, onClose, onSelect }: EditListItemCategoryModalProps) {
  return (
    <div className="shopping-item-modal-backdrop" onClick={onClose}>
      <div className="shopping-item-modal" onClick={(e) => e.stopPropagation()}>
        <header className="shopping-item-modal-header">
          <h3>Set category</h3>
          <button type="button" className="shopping-item-modal-close" onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="shopping-category-modal-options">
          {CATEGORY_ORDER.map((category) => (
            <button
              key={category}
              type="button"
              className={`shopping-category-modal-option ${item.category === category ? 'active' : ''}`}
              onClick={() => onSelect(category)}
            >
              {CATEGORY_LABELS[category]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
