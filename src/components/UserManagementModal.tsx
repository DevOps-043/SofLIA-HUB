import React, { useState, useEffect } from 'react';
import { orgService, type OrgMember } from '../services/org-service';
import { SofiaOrganization } from '../lib/sofia-client';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  organization: SofiaOrganization | null;
  currentUserRole: 'owner' | 'admin' | 'member';
  embedded?: boolean;
}

// Custom dropdown component for roles
const RoleDropdown: React.FC<{
  value: string;
  onChange: (val: any) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled }) => {
  const [open, setOpen] = useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const options = [
    { value: 'admin', label: 'Administrador' },
    { value: 'member', label: 'Miembro' }
  ];

  const selectedLabel = value === 'owner' ? 'Propietario' : options.find(o => o.value === value)?.label || value;

  return (
    <div ref={ref} className="relative min-w-32">
      <button
        type="button"
        disabled={disabled || value === 'owner'}
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-1.5 bg-background-dark/60 border border-white/5 rounded-xl text-white text-[12px] font-bold text-left flex items-center justify-between hover:border-accent/30 transition-all disabled:opacity-50 disabled:cursor-default"
      >
        <span className="truncate">{selectedLabel}</span>
        {!(disabled || value === 'owner') && (
          <svg className={`w-3.5 h-3.5 opacity-40 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full mb-1 left-0 right-0 bg-[#25262b] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                value === opt.value
                  ? 'bg-accent/10 text-accent'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const UserManagementModal: React.FC<UserManagementModalProps> = ({ 
  isOpen, 
  onClose, 
  organization,
  currentUserRole,
  embedded = false
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
    if (!organization?.id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await orgService.getOrganizationMembers(organization.id);
      setMembers(data);
    } catch (err: any) {
      setError('Error al cargar miembros.');
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
      setSuccess(`Invitación enviada a ${inviteEmail}`);
      setInviteEmail('');
      fetchMembers();
    } catch (err: any) {
      setError(err.message || 'Error al invitar');
    } finally {
      setInviting(false);
      setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 5000);
    }
  };

  const handleRoleChange = async (membershipId: string, newRole: 'owner' | 'admin' | 'member') => {
    try {
      await orgService.updateMemberRole(membershipId, newRole);
      setMembers(prev => prev.map(m => m.id === membershipId ? { ...m, role: newRole } : m));
    } catch (err) {
      alert('Error al actualizar rol');
    }
  };

  const handleStatusChange = async (membershipId: string, newStatus: 'active' | 'suspended' | 'removed') => {
    if (newStatus === 'removed' && !confirm('¿Eliminar miembropermanentemente?')) return;
    try {
      await orgService.updateMemberStatus(membershipId, newStatus);
      if (newStatus === 'removed') {
        setMembers(prev => prev.filter(m => m.id !== membershipId));
      } else {
        setMembers(prev => prev.map(m => m.id === membershipId ? { ...m, status: newStatus } : m));
      }
    } catch (err) {
      alert('Error al actualizar estado');
    }
  };

  if (!isOpen && !embedded) return null;

  const content = (
    <div
      className={`flex flex-col overflow-hidden relative ${embedded ? 'w-full h-full' : 'w-full max-w-180 max-h-[85vh] bg-sidebar rounded-3xl border border-white/10 shadow-2xl animate-fade-in'}`}
      onClick={e => e.stopPropagation()}
    >
      {/* Glows */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/5 blur-[100px] pointer-events-none" />

      {/* Header */}
      {!embedded && (
        <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between relative z-10 bg-white/2">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center border border-accent/20 shadow-lg shadow-accent/5">
              <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div>
              <h2 className="text-white text-xl font-black uppercase tracking-widest leading-none">Cuerpo Directivo</h2>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter mt-1">{organization?.name} • Gestión de Niveles de Acceso</p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-all group">
            <svg className="w-5 h-5 transition-transform group-hover:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-8 py-8 relative z-10">
        {/* Invitation Card */}
        {isAdmin && (
          <div className="mb-10 bg-white/3 border border-white/10 rounded-3xl p-6 relative overflow-hidden group">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-accent/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-center gap-3 mb-6">
              <div className="w-1.5 h-4 bg-accent rounded-full" />
              <h4 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Desplegar Invitación</h4>
            </div>
            
            <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="Email corporativo o nombre de usuario"
                  className="w-full px-4 py-3 bg-background-dark/80 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-accent/30 transition-all placeholder-gray-700"
                  required
                />
              </div>
              <div className="sm:w-40">
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value as any)}
                  className="w-full px-4 py-3 bg-background-dark/80 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-accent/30 appearance-none cursor-pointer"
                >
                  <option value="member">Miembro</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={inviting || !inviteEmail.trim()}
                className="group relative px-8 py-3 rounded-xl bg-accent text-primary text-[11px] font-black uppercase tracking-[0.2em] shadow-lg shadow-accent/5 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 overflow-hidden"
              >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                <span className="relative z-10">{inviting ? 'Procesando...' : 'Autorizar'}</span>
              </button>
            </form>
            {(error || success) && (
              <div className="mt-4 flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                <div className={`w-1 h-1 rounded-full ${error ? 'bg-red-500' : 'bg-accent'} animate-pulse`} />
                <p className={`text-[10px] font-bold uppercase tracking-tight ${error ? 'text-red-400' : 'text-accent'}`}>
                  {error || success}
                </p>
              </div>
            )}
          </div>
        )}

        {/* List Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
               <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Fuerza de Trabajo</h4>
               <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[9px] font-mono text-gray-400 font-bold">{members.length}</span>
            </div>
            {!loading && members.length > 0 && (
              <button onClick={fetchMembers} className="text-[9px] font-black text-accent uppercase tracking-widest hover:underline decoration-accent/30 underline-offset-2">Actualizar Lista</button>
            )}
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="relative">
                <div className="w-10 h-10 border-2 border-white/5 rounded-full" />
                <div className="absolute inset-0 w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              </div>
              <p className="text-[9px] font-black text-accent uppercase tracking-[0.3em] animate-pulse">Sincronizando Usuarios...</p>
            </div>
          ) : members.length > 0 ? (
            <div className="grid grid-cols-1 gap-3">
              {members.map(member => (
                <div 
                  key={member.id} 
                  className="group bg-white/2 hover:bg-white/5 border border-white/5 hover:border-white/10 rounded-2xl p-4 flex items-center justify-between transition-all duration-300"
                >
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className={`w-12 h-12 rounded-full border-2 p-0.5 transition-colors duration-500 ${member.status === 'suspended' ? 'border-red-500/20 grayscale' : 'border-accent/30 group-hover:border-accent'}`}>
                        <div className="w-full h-full rounded-full bg-background-dark/80 overflow-hidden flex items-center justify-center">
                          {member.user_profile?.profile_picture_url ? (
                            <img src={member.user_profile.profile_picture_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-accent text-[15px] font-black font-mono">
                              {(member.user_profile?.display_name || member.user_profile?.username || '?')[0].toUpperCase()}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-sidebar z-10 ${member.status === 'active' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`} />
                    </div>
                    
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[13px] font-bold text-white truncate max-w-[150px]">
                          {member.user_profile?.display_name || member.user_profile?.username || 'Eslabón Invitado'}
                        </span>
                        {member.role === 'owner' && (
                          <div className="px-1.5 py-0.5 rounded-md bg-accent/10 border border-accent/20 text-accent text-[8px] font-black uppercase tracking-tighter">Owner</div>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-600 font-bold uppercase tracking-tight flex items-center gap-1.5">
                         <svg className="w-3 h-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                         {member.user_profile?.email || 'id_desconocido@soflia.sys'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    {/* Role Controller */}
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[8px] font-bold text-gray-700 uppercase tracking-widest leading-none mr-2">Protocolo de Acceso</span>
                      <RoleDropdown 
                        value={member.role} 
                        onChange={(role) => handleRoleChange(member.id, role)}
                        disabled={!isAdmin || member.status === 'suspended'}
                      />
                    </div>

                    {/* Technical Actions */}
                    {isAdmin && member.role !== 'owner' && (
                      <div className="flex items-center gap-2 pl-6 border-l border-white/5">
                        <button
                          onClick={() => handleStatusChange(member.id, member.status === 'active' ? 'suspended' : 'active')}
                          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all border ${
                            member.status === 'active' 
                              ? 'bg-amber-500/5 border-amber-500/10 text-amber-500/60 hover:text-amber-500 hover:bg-amber-500/10 hover:shadow-lg hover:shadow-amber-500/10' 
                              : 'bg-green-500/5 border-green-500/10 text-green-500/60 hover:text-green-500 hover:bg-green-500/10 hover:shadow-lg hover:shadow-green-500/10'
                          }`}
                          title={member.status === 'active' ? 'Revocar Acceso' : 'Restaurar Acceso'}
                        >
                          {member.status === 'active' ? (
                            <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                          ) : (
                            <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                        </button>
                        <button
                          onClick={() => handleStatusChange(member.id, 'removed')}
                          className="w-9 h-9 rounded-xl bg-red-500/5 border border-red-500/10 text-red-500/60 hover:text-red-400 hover:bg-red-500/10 hover:shadow-lg hover:shadow-red-500/10 transition-all flex items-center justify-center"
                          title="Eliminar del Sistema"
                        >
                          <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 bg-white/3 border border-dashed border-white/10 rounded-3xl animate-in fade-in duration-700">
               <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197" />
                  </svg>
               </div>
               <p className="text-[10px] font-black text-gray-600 uppercase tracking-[0.2em] mb-6">Red de Trabajo Desierta</p>
               <button onClick={fetchMembers} className="px-6 py-2 rounded-xl bg-white/5 border border-white/10 text-[9px] font-black text-white hover:bg-white/10 transition-all uppercase tracking-widest">Forzar Escaneo</button>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      {!embedded && (
        <div className="px-8 py-5 border-t border-white/5 bg-white/2 flex items-center justify-between relative z-20">
          <div className="flex items-center gap-2">
             <div className="w-1.5 h-1.5 rounded-full bg-accent/40" />
             <p className="text-[9px] text-gray-600 font-black uppercase tracking-widest">Protocolo de Gestión Activo</p>
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-white/5 text-[10px] font-black text-gray-500 hover:text-white uppercase tracking-widest transition-colors border border-white/5"
          >
            Finalizar Sesión
          </button>
        </div>
      )}
    </div>
  );

  if (embedded) return content;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4" onClick={onClose}>
      {content}
    </div>
  );
};

