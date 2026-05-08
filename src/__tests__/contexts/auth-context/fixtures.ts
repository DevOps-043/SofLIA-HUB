export function sofiaUser() {
  return {
    id: 'sofia-user-1',
    email: 'test@soflia.com',
    user_metadata: { first_name: 'Test' },
  };
}

export function sofiaProfile() {
  return {
    id: 'sofia-user-1',
    email: 'test@soflia.com',
    memberships: [{ status: 'active', organization_id: 'org-1', team_id: 'team-1' }],
    organizations: [{ id: 'org-1', name: 'TestOrg' }],
    teams: [{ id: 'team-1', name: 'TestTeam', organization_id: 'org-1' }],
  };
}
