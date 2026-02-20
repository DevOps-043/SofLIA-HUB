import React, { useState, useEffect } from 'react';
import { orgService, type OrgMember } from '../services/org-service';
import { SofiaOrganization } from '../lib/sofia-client';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  organization: SofiaOrganization | null;
  currentUserRole: 'owner' | 'admin' | 'member';
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({ 
  isOpen, 
  onClose, 
  organization,
  currentUserRole 
}) => {
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);

  const isAdmin = currentUserRole === 'owner' || currentUserRole === 'admin';

  useEffect(() => {
    if (isOpen && organization) {
      fetchMembers();
    }
  }, [isOpen, organization]);

  const fetchMembers = async () => {
    if (!organization?.id) {
      console.warn('[UserManagementModal] No organization ID provided');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('[UserManagementModal] Fetching members for:', organization.id);
      const data = await orgService.getOrganizationMembers(organization.id);
      setMembers(data);
    } catch (err: any) {
      console.error('[UserManagementModal] Error fetching members:', err);
      setError('Error al cargar miembros. ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization || !inviteEmail.trim()) return;

    setInviting(true);
    setError(null);
    setSuccess(null);

    try {
      await orgService.inviteUser(organization.id, inviteEmail.trim(), inviteRole);
      setSuccess(`Usuario ${inviteEmail} invitado exitosamente.`);
      setInviteEmail('');
      fetchMembers();
    } catch (err: any) {
      setError(err.message || 'Error al invitar usuario');
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (membershipId: string, newRole: 'owner' | 'admin' | 'member') => {
    try {
      await orgService.updateMemberRole(membershipId, newRole);
      setMembers(prev => prev.map(m => m.id === membershipId ? { ...m, role: newRole } : m));
    } catch (err) {
      alert('Error al cambiar el rol');
    }
  };

  const handleStatusChange = async (membershipId: string, newStatus: 'active' | 'suspended' | 'removed') => {
    if (newStatus === 'removed' && !confirm('¿Estás seguro de que deseas eliminar a este miembro?')) return;
    
    try {
      await orgService.updateMemberStatus(membershipId, newStatus);
      if (newStatus === 'removed') {
        setMembers(prev => prev.filter(m => m.id !== membershipId));
      } else {
        setMembers(prev => prev.map(m => m.id === membershipId ? { ...m, status: newStatus } : m));
      }
    } catch (err) {
      alert('Error al cambiar el estado');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[700px] max-h-[90vh] bg-sidebar rounded-2xl border border-white/10 flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div>
              <h2 className="text-white text-lg font-semibold leading-tight">Miembros de la Organización</h2>
              <p className="text-xs text-gray-400 mt-1">{organization?.name} • Gestiona roles y accesos</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/5">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-6">
          {/* Invite Section */}
          {isAdmin && (
            <div className="mb-8 p-4 rounded-xl bg-white/[0.03] border border-white/10">
              <h4 className="text-white text-sm font-semibold mb-3">Invitar nuevo miembro</h4>
              <form onSubmit={handleInvite} className="flex gap-3">
                <input
                  type="text"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="Email o Username"
                  className="flex-1 px-3 py-2 bg-background-dark/80 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-accent/50 transition-colors"
                  required
                />
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value as any)}
                  className="px-3 py-2 bg-background-dark/80 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-accent/50 transition-colors"
                >
                  <option value="member">Miembro</option>
                  <option value="admin">Admin</option>
                </select>
                <button
                  type="submit"
                  disabled={inviting || !inviteEmail.trim()}
                  className="px-4 py-2 bg-accent text-primary text-sm font-bold rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50"
                >
                  {inviting ? 'Invitando...' : 'Invitar'}
                </button>
              </form>
              {error && <p className="text-red-400 text-xs mt-2 ml-1">{error}</p>}
              {success && <p className="text-accent text-xs mt-2 ml-1">{success}</p>}
            </div>
          )}

          {/* Members List */}
          <div className="space-y-1">
            <h4 className="text-gray-400 text-[11px] font-bold uppercase tracking-wider mb-3 ml-1">Usuarios Actuales ({members.length})</h4>
            
            {loading ? (
              <div className="flex flex-col items-center justify-center py-10 opacity-50">
                <div className="w-6 h-6 border-2 border-accent/20 border-t-accent rounded-full animate-spin mb-3" />
                <span className="text-xs text-gray-400">Cargando miembros...</span>
              </div>
            ) : members.length > 0 ? (
              <div className="space-y-2">
                {members.map(member => (
                  <div 
                    key={member.id} 
                    className="group bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 rounded-xl p-3 flex items-center justify-between transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-accent/20 border border-white/10 overflow-hidden flex items-center justify-center">
                        {member.user_profile?.profile_picture_url ? (
                          <img src={member.user_profile.profile_picture_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-accent text-sm font-bold">
                            {(member.user_profile?.display_name || member.user_profile?.username || '?')[0].toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-white text-sm font-medium">
                            {member.user_profile?.display_name || member.user_profile?.username || 'Usuario Invitado'}
                          </span>
                          {member.status === 'suspended' && (
                            <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 text-[10px] font-bold uppercase">Suspendido</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400">{member.user_profile?.email || 'Sin correo'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Role Select */}
                      <div className="flex flex-col items-end">
                        <select
                          disabled={!isAdmin || member.role === 'owner'}
                          value={member.role}
                          onChange={e => handleRoleChange(member.id, e.target.value as any)}
                          className="bg-transparent text-white text-[13px] font-medium focus:outline-none cursor-pointer disabled:cursor-default"
                        >
                          <option value="owner" disabled className="bg-sidebar">Owner</option>
                          <option value="admin" className="bg-sidebar">Admin</option>
                          <option value="member" className="bg-sidebar">Miembro</option>
                        </select>
                        <span className="text-[10px] text-gray-500 uppercase font-bold">Rol</span>
                      </div>

                      {/* Actions */}
                      {isAdmin && member.role !== 'owner' && (
                        <div className="flex items-center gap-1 border-l border-white/10 pl-4">
                          <button
                            onClick={() => handleStatusChange(member.id, member.status === 'active' ? 'suspended' : 'active')}
                            title={member.status === 'active' ? 'Suspender' : 'Activar'}
                            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                          >
                            {member.status === 'active' ? (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <circle cx="12" cy="12" r="10" />
                                <line x1="15" y1="9" x2="9" y2="15" />
                                <line x1="9" y1="9" x2="15" y2="15" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                <polyline points="22 4 12 14.01 9 11.01" />
                              </svg>
                            )}
                          </button>
                          <button
                            onClick={() => handleStatusChange(member.id, 'removed')}
                            title="Eliminar"
                            className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 bg-white/[0.01] border border-dashed border-white/5 rounded-2xl">
                <svg className="w-10 h-10 text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197" />
                </svg>
                {error ? (
                  <>
                    <p className="text-red-400 text-sm mb-1">No se pudieron cargar los miembros</p>
                    <p className="text-gray-500 text-xs mb-4">{error}</p>
                  </>
                ) : (
                  <p className="text-gray-500 text-sm mb-4">No se encontraron miembros en esta organización.</p>
                )}
                <button 
                  onClick={fetchMembers}
                  className="px-4 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white text-xs font-medium border border-white/10 transition-colors"
                >
                  Reintentar
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-white/[0.02] flex justify-between items-center">
          <p className="text-[10px] text-gray-500 w-2/3">
            * Los administradores pueden gestionar miembros, cambiar roles e invitar nuevos colaboradores.
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-white/10 text-white text-sm font-semibold hover:bg-white/20 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
