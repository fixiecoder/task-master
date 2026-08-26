import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { List } from '../types';
import { getList } from '../api';
import { ListItemsPanel } from './ListItemsPanel';
import './ListDetailView.css';

const TYPE_LABELS: Record<List['type'], string> = {
  shopping: 'Shopping list',
  todo: 'To-do list',
  checklist: 'Checklist',
  stock: 'Stock',
};

export function ListDetailView() {
  const { id } = useParams<{ id: string }>();
  const [list, setList] = useState<List | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicking off the async load for this route param
    setIsLoading(true);
    getList(id)
      .then(setList)
      .catch(() => setError('Could not load that list.'))
      .finally(() => setIsLoading(false));
  }, [id]);

  return (
    <div className="list-detail-page">
      <Link to="/lists" className="link-button list-detail-back">← All lists</Link>

      {isLoading ? (
        <p className="board-loading">Loading…</p>
      ) : error || !list ? (
        <p className="board-error">{error ?? 'List not found.'}</p>
      ) : (
        <>
          <div className="list-detail-header">
            <h2>{list.name}</h2>
            <span className="list-detail-type">{TYPE_LABELS[list.type]}</span>
          </div>
          <ListItemsPanel list={list} />
        </>
      )}
    </div>
  );
}
