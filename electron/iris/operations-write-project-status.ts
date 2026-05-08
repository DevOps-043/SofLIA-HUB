import { getIrisClient } from './clients';

export async function updateProjectStatus(params: {
  projectId: string;
  newStatus: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled' | 'archived';
}): Promise<{ success: boolean; project?: unknown; error?: string }> {
  const iris = getIrisClient();
  if (!iris) return { success: false, error: 'IRIS no esta disponible.' };

  try {
    const updateData: Record<string, unknown> = {
      project_status: params.newStatus,
      updated_at: new Date().toISOString(),
    };
    if (params.newStatus === 'completed') {
      updateData.actual_end_date = new Date().toISOString().split('T')[0];
      updateData.completion_percentage = 100;
    } else if (params.newStatus === 'archived') {
      updateData.archived_at = new Date().toISOString();
    }

    const { data, error } = await iris
      .from('pm_projects')
      .update(updateData)
      .eq('project_id', params.projectId)
      .select('*')
      .single();

    if (error) {
      console.error('[IRIS-Main] updateProjectStatus error:', error);
      return { success: false, error: error.message };
    }

    console.log(`[IRIS-Main] Project "${data.project_name}" status updated to "${params.newStatus}"`);
    return { success: true, project: data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[IRIS-Main] updateProjectStatus exception:', err);
    return { success: false, error: message };
  }
}
