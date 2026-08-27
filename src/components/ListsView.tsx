import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { List, ListType, ListWithItemCount } from '../types';
import { createList } from '../api';
import { useLists } from '../useLists';
import { useProjects } from '../useProjects';
import { useTasks } from '../useTasks';
import { ListModal } from './ListModal';
import { DeleteListModal } from './DeleteListModal';
import { ProjectFilter, UNASSIGNED_PROJECT_FILTER } from './ProjectFilter';
import './ListsView.css';

const TYPE_LABELS: Record<ListType, string> = {
  shopping: 'Shopping',
  todo: 'To-do',
  checklist: 'Checklist',
  stock: 'Stock',
};

export function ListsView() {
  const { lists, setLists, isLoading, error, setError, isOnline, removeList } = useLists();
  const { tasks } = useTasks();
  const { projects } = useProjects();
  const projectsById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const [searchParams, setSearchParams] = useSearchParams();
  const [isAdding, setIsAdding] = useState(false);
  const [deletingList, setDeletingList] = useState<ListWithItemCount | null>(null);

  // Empty set = no filter applied (show every list).
  const projectFilter = useMemo(() => new Set(searchParams.getAll('project')), [searchParams]);
  function toggleProjectFilter(id: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      const current = new Set(next.getAll('project'));
      if (current.has(id)) current.delete(id);
      else current.add(id);
      next.delete('project');
      for (const projectId of current) next.append('project', projectId);
      return next;
    });
  }
  function setProjectFilter(ids: string[]) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('project');
      for (const projectId of ids) next.append('project', projectId);
      return next;
    });
  }
  const visibleLists = useMemo(() => {
    if (projectFilter.size === 0) return lists;
    return lists.filter((l) => projectFilter.has(l.projectId ?? UNASSIGNED_PROJECT_FILTER));
  }, [lists, projectFilter]);

  // `?new=list` (paired with `?project=<id>`, which already doubles as the
  // filter) is a cross-app deep link — e.g. from the dashboard's project
  // "Add" button — that opens the new-list modal pre-scoped to a project.
  useEffect(() => {
    if (searchParams.get('new') !== 'list') return;
    setIsAdding(true);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('new');
      return next;
    }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const linkCounts = new Map<string, number>();
  for (const task of tasks) {
    if (!task.listId) continue;
    linkCounts.set(task.listId, (linkCounts.get(task.listId) ?? 0) + 1);
  }

  const listsById = new Map(lists.map((l) => [l.id, l]));

  async function handleAdd(name: string, type: ListType, projectId: string | null) {
    try {
      const list = await createList(name, type, projectId);
      // The paired stock list (if any) is created server-side alongside the
      // shopping list — the live listener picks it up moments later.
      setLists((prev) => {
        if (prev.some((l) => l.id === list.id)) return prev;
        return [...prev, { ...list, itemCount: 0 }].sort((a, b) => a.name.localeCompare(b.name));
      });
      setIsAdding(false);
    } catch {
      setError('Could not create that list — try again.');
    }
  }

  function handleDeleteClick(list: ListWithItemCount) {
    setDeletingList(list);
  }

  async function handleConfirmDelete() {
    if (!deletingList) return;
    try {
      await removeList(deletingList.id);
      if (deletingList.pairedListId) {
        setLists((prev) => prev.filter((l) => l.id !== deletingList.pairedListId));
      }
      setDeletingList(null);
    } catch {
      setError('Could not delete that list — try again.');
    }
  }

  function pairedName(list: List): string | null {
    if (!list.pairedListId) return null;
    return listsById.get(list.pairedListId)?.name ?? null;
  }

  return (
    <div className="lists-page">
      {!isOnline && (
        <p className="board-offline">You're offline — showing saved lists.</p>
      )}
      {error && <p className="board-error">{error}</p>}

      <div className="lists-page-header">
        <h2>Lists</h2>
        <ProjectFilter
          projects={projects}
          selected={projectFilter}
          onToggle={toggleProjectFilter}
          onSetAll={setProjectFilter}
        />
        <button type="button" className="lists-add-button" onClick={() => setIsAdding(true)} disabled={!isOnline}>
          + New list
        </button>
      </div>

      {isLoading ? (
        <p className="board-loading">Loading lists…</p>
      ) : visibleLists.length === 0 ? (
        <p className="lists-page-empty">
          {lists.length === 0 ? 'No lists yet — create one to get started.' : 'No lists match this filter.'}
        </p>
      ) : (
        <ul className="lists-list">
          {visibleLists.map((list) => (
            <li key={list.id} className="lists-list-item">
              {list.projectId && (
                <span
                  className="lists-list-project-dot"
                  style={{ backgroundColor: projectsById.get(list.projectId)?.color ?? 'var(--chalk-dim)' }}
                  title={projectsById.get(list.projectId)?.name}
                />
              )}
              <Link to={`/lists/${list.id}`} className="lists-list-name">{list.name}</Link>
              <span className="lists-list-type">{TYPE_LABELS[list.type]}</span>
              {pairedName(list) && (
                <span className="lists-list-paired">↔ {pairedName(list)}</span>
              )}
              <span className="lists-list-count">{list.itemCount} items</span>
              <div className="lists-list-actions">
                <button
                  type="button"
                  className="link-button"
                  onClick={() => handleDeleteClick(list)}
                  disabled={!isOnline}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {isAdding && (
        <ListModal
          onClose={() => setIsAdding(false)}
          onSave={handleAdd}
          defaultProjectId={projectFilter.size > 0 ? [...projectFilter][0] : null}
        />
      )}

      {deletingList && (
        <DeleteListModal
          list={deletingList}
          taskCount={linkCounts.get(deletingList.id) ?? 0}
          onClose={() => setDeletingList(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  );
}
