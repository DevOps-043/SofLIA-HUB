import { useState, useCallback } from 'react';
import { getTeams, getProjects, getIssues } from '../services/iris-data';
import { isIrisConfigured, type IrisTeam, type IrisProject, type IrisIssue } from '../lib/iris-client';

export function useIrisData() {
  const [irisTeams, setIrisTeams] = useState<IrisTeam[]>([]);
  const [irisProjects, setIrisProjects] = useState<IrisProject[]>([]);
  const [irisIssues, setIrisIssues] = useState<Record<string, IrisIssue[]>>({});
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  const loadInitialData = useCallback(async () => {
    if (!isIrisConfigured()) return;
    try {
      const [teams, projects] = await Promise.all([getTeams(), getProjects()]);
      setIrisTeams(teams);
      setIrisProjects(projects);
    } catch (err) {
      console.error('IRIS: Error loading data', err);
    }
  }, []);

  const refreshData = useCallback(async () => {
    if (!isIrisConfigured()) return;
    try {
      setIrisTeams([]);
      setIrisProjects([]);
      setIrisIssues({});
      setExpandedTeams(new Set());
      setExpandedProjects(new Set());
      const [teams, projects] = await Promise.all([getTeams(), getProjects()]);
      setIrisTeams(teams);
      setIrisProjects(projects);
    } catch (err) {
      console.error('IRIS: Error refreshing data', err);
    }
  }, []);

  const toggleTeam = useCallback((teamId: string) => {
    setExpandedTeams((prev) => {
      const next = new Set(prev);
      next.has(teamId) ? next.delete(teamId) : next.add(teamId);
      return next;
    });
  }, []);

  const toggleProject = useCallback(
    async (projectId: string) => {
      setExpandedProjects((prev) => {
        const next = new Set(prev);
        next.has(projectId) ? next.delete(projectId) : next.add(projectId);
        return next;
      });
      if (!irisIssues[projectId]) {
        const issues = await getIssues({ projectId, limit: 20 });
        setIrisIssues((prev) => ({ ...prev, [projectId]: issues }));
      }
    },
    [irisIssues],
  );

  return {
    irisTeams,
    irisProjects,
    irisIssues,
    expandedTeams,
    expandedProjects,
    loadInitialData,
    refreshData,
    toggleTeam,
    toggleProject,
  };
}
