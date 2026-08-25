import { useEffect, useRef, useState } from 'react';
import type { ProjectWithCount } from '../types';
import { FilterIcon } from '../icons';

// Sentinel for "tasks with no project" — never collides with a real Firestore ID.
export const UNASSIGNED_PROJECT_FILTER = '__unassigned__';

interface ProjectFilterProps {
  projects: ProjectWithCount[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onSetAll: (ids: string[]) => void;
}

export function ProjectFilter({ projects, selected, onToggle, onSetAll }: ProjectFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const allIds = [...projects.map((p) => p.id), UNASSIGNED_PROJECT_FILTER];
  const allSelected = allIds.every((id) => selected.has(id));

  useEffect(() => {
    if (!isOpen) return;
    function handlePointerDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setIsOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false);
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  function labelFor(id: string) {
    if (id === UNASSIGNED_PROJECT_FILTER) return 'No project';
    return projects.find((p) => p.id === id)?.name ?? 'Unknown project';
  }

  function colorFor(id: string) {
    return projects.find((p) => p.id === id)?.color ?? null;
  }

  return (
    <div className="filter-bar">
      <div className="filter-button-wrap" ref={wrapRef}>
        <button
          type="button"
          className={`filter-button ${selected.size > 0 ? 'active' : ''}`}
          onClick={() => setIsOpen((o) => !o)}
          aria-expanded={isOpen}
        >
          <FilterIcon width={14} height={14} />
          Filter
          {selected.size > 0 && <span className="filter-button-count">{selected.size}</span>}
        </button>

        {isOpen && (
          <div className="filter-popout">
            <div className="filter-popout-header">
              <span>Filter by project</span>
              <button
                type="button"
                className="filter-popout-close"
                onClick={() => setIsOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="filter-popout-actions">
              <button
                type="button"
                className="filter-popout-action"
                onClick={() => onSetAll(allIds)}
                disabled={allSelected}
              >
                Select all
              </button>
              <button
                type="button"
                className="filter-popout-action"
                onClick={() => onSetAll([])}
                disabled={selected.size === 0}
              >
                Deselect all
              </button>
            </div>
            <div className="filter-popout-list">
              {projects.map((project) => (
                <label key={project.id} className="filter-popout-option">
                  <input type="checkbox" checked={selected.has(project.id)} onChange={() => onToggle(project.id)} />
                  <span
                    className="filter-popout-dot"
                    style={{ backgroundColor: project.color ?? 'var(--chalk-dim)' }}
                  />
                  {project.name}
                </label>
              ))}
              <label className="filter-popout-option">
                <input
                  type="checkbox"
                  checked={selected.has(UNASSIGNED_PROJECT_FILTER)}
                  onChange={() => onToggle(UNASSIGNED_PROJECT_FILTER)}
                />
                No project
              </label>
            </div>
          </div>
        )}
      </div>

      {selected.size > 0 && (
        <div className="filter-pills">
          {[...selected].map((id) => (
            <button key={id} type="button" className="filter-pill" onClick={() => onToggle(id)}>
              {id !== UNASSIGNED_PROJECT_FILTER && (
                <span className="filter-pill-dot" style={{ backgroundColor: colorFor(id) ?? 'var(--chalk-dim)' }} />
              )}
              {labelFor(id)}
              <span className="filter-pill-remove">×</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
