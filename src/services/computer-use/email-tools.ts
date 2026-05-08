type ComputerUseApi = NonNullable<Window['computerUse']>;

export async function executeEmailTool(
  toolName: string,
  args: Record<string, any>,
  api: ComputerUseApi,
): Promise<any | null> {
  if (toolName === 'get_email_config') return api.getEmailConfig();
  if (toolName === 'configure_email') return api.configureEmail(args.email, args.password);
  if (toolName === 'send_email') {
    return api.sendEmail(args.to, args.subject, args.body, args.attachment_paths, args.is_html);
  }
  return null;
}
