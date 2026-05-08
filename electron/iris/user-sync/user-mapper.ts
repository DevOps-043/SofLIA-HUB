export function mapSofiaUserToIrisAccountUser(sofiaUser: any) {
  const lastNameParts = (sofiaUser.last_name || '').trim().split(/\s+/);
  const lastNamePaternal = lastNameParts[0] || sofiaUser.username;
  const lastNameMaternal = lastNameParts.length > 1 ? lastNameParts.slice(1).join(' ') : null;

  return {
    user_id: sofiaUser.id,
    first_name: sofiaUser.first_name || sofiaUser.username,
    last_name_paternal: lastNamePaternal,
    last_name_maternal: lastNameMaternal,
    display_name:
      sofiaUser.display_name ||
      `${sofiaUser.first_name || ''} ${sofiaUser.last_name || ''}`.trim() ||
      sofiaUser.username,
    username: sofiaUser.username,
    email: sofiaUser.email,
    password_hash: 'SOFIA_MANAGED_AUTH',
    permission_level: 'user',
    account_status: 'active',
    is_email_verified: true,
    phone_number: sofiaUser.phone || null,
    avatar_url: sofiaUser.profile_picture_url || null,
  };
}
