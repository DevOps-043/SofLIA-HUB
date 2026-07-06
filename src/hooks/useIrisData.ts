import { useState, useCallback } from 'react';
import { getTeams, getProjects, getIssues } from '../services/iris-data';
import { isIrisConfigured, type IrisTeam, type IrisProject, type IrisIssue } from '../lib/iris-client';

export function useIrisData(orgTeamIds: string[] = []) {
  const [irisTeams, setIrisTeams] = useState<IrisTeam[]>([]);
  const [irisProjects, setIrisProjects] = useState<IrisProject[]>([]);
  const [irisIssues, setIrisIssues] = useState<Record<string, IrisIssue[]>>({});
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  // Equipos de la organizacion activa (equipos SOFIA = equipos IRIS). Clave estable para deps.
  const teamKey = orgTeamIds.join(',');
  const teamIds = teamKey ? teamKey.split(',') : [];

  const loadInitialData = useCallback(async () => {
    if (!isIrisConfigured()) return;
    try {
      setIrisIssues({});
      setExpandedTeams(new Set());
      setExpandedProjects(new Set());
      const [teams, projects] = await Promise.all([getTeams(teamIds), getProjects(undefined, teamIds)]);
      setIrisTeams(teams);
      setIrisProjects(projects);
    } catch (err) {
      console.error('IRIS: Error loading data', err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamKey]);

  const refreshData = useCallback(async () => {
    if (!isIrisConfigured()) return;
    try {
      setIrisTeams([]);
      setIrisProjects([]);
      setIrisIssues({});
      setExpandedTeams(new Set());
      setExpandedProjects(new Set());
      const [teams, projects] = await Promise.all([getTeams(teamIds), getProjects(undefined, teamIds)]);
      setIrisTeams(teams);
      setIrisProjects(projects);
    } catch (err) {
      console.error('IRIS: Error refreshing data', err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamKey]);

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
        const issues = await getIssues({ projectId, limit: 20, teamIds: teamKey ? teamKey.split(',') : undefined });
        setIrisIssues((prev) => ({ ...prev, [projectId]: issues }));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [irisIssues, teamKey],
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
