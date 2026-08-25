import { useState } from 'react';
import type { Project, ProjectWithCount } from '../types';
import { createProject } from '../api';
import { useProjects } from '../useProjects';
import { useTasks } from '../useTasks';
import { ProjectModal } from './ProjectModal';
import { DeleteProjectModal } from './DeleteProjectModal';
import './ProjectsView.css';

export function ProjectsView() {
  const { projects, setProjects, isLoading, error, setError, isOnline, removeProject, saveProject } = useProjects();
  const { tasks } = useTasks();
  const [isAdding, setIsAdding] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<ProjectWithCount | null>(null);

  // Live task counts, computed from the already-subscribed tasks list rather
  // than the REST response's snapshot taskCount, so assigning/unassigning a
  // task updates the count here immediately without a manual refresh.
  const liveCounts = new Map<string, number>();
  for (const task of tasks) {
    if (!task.projectId) continue;
    liveCounts.set(task.projectId, (liveCounts.get(task.projectId) ?? 0) + 1);
  }

  async function handleAdd(name: string, color: string | null) {
    try {
      const project = await createProject(name, color);
      setProjects((prev) => {
        // The live Firestore listener may have already delivered this
        // project by the time createProject resolves — avoid double-adding.
        if (prev.some((p) => p.id === project.id)) return prev;
        return [...prev, { ...project, taskCount: 0 }].sort((a, b) => a.name.localeCompare(b.name));
      });
      setIsAdding(false);
    } catch {
      setError('Could not create that project — try again.');
    }
  }

  async function handleRename(name: string, color: string | null) {
    if (!editingProject) return;
    try {
      await saveProject(editingProject.id, { name, color });
      setEditingProject(null);
    } catch {
      setError('Could not save that project — try again.');
    }
  }

  function handleDeleteClick(project: ProjectWithCount) {
    const taskCount = liveCounts.get(project.id) ?? 0;
    if (taskCount === 0) {
      removeProject(project.id, 'unassign').catch(() => setError('Could not delete that project — try again.'));
      return;
    }
    setDeletingProject({ ...project, taskCount });
  }

  async function handleConfirmDelete(mode: 'unassign' | 'cascade') {
    if (!deletingProject) return;
    try {
      await removeProject(deletingProject.id, mode);
      setDeletingProject(null);
    } catch {
      setError('Could not delete that project — try again.');
    }
  }

  return (
    <div className="projects-page">
      {!isOnline && (
        <p className="board-offline">You're offline — showing saved projects.</p>
      )}
      {error && <p className="board-error">{error}</p>}

      <div className="projects-page-header">
        <h2>Projects</h2>
        <button type="button" className="projects-add-button" onClick={() => setIsAdding(true)} disabled={!isOnline}>
          + New project
        </button>
      </div>

      {isLoading ? (
        <p className="board-loading">Loading projects…</p>
      ) : projects.length === 0 ? (
        <p className="projects-page-empty">No projects yet — create one to start grouping tasks.</p>
      ) : (
        <ul className="projects-list">
          {projects.map((project) => (
            <li key={project.id} className="projects-list-item">
              <span
                className="project-color-dot"
                style={project.color ? { backgroundColor: project.color } : undefined}
              />
              <span className="projects-list-name">{project.name}</span>
              <span className="projects-list-count">{liveCounts.get(project.id) ?? 0} tasks</span>
              <div className="projects-list-actions">
                <button type="button" className="link-button" onClick={() => setEditingProject(project)} disabled={!isOnline}>
                  Rename
                </button>
                <button
                  type="button"
                  className="link-button"
                  onClick={() => handleDeleteClick(project)}
                  disabled={!isOnline}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {isAdding && <ProjectModal onClose={() => setIsAdding(false)} onSave={handleAdd} />}

      {editingProject && (
        <ProjectModal project={editingProject} onClose={() => setEditingProject(null)} onSave={handleRename} />
      )}

      {deletingProject && (
        <DeleteProjectModal
          projectName={deletingProject.name}
          taskCount={deletingProject.taskCount}
          onClose={() => setDeletingProject(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  );
}
