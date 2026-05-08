export function summarizeFunctionResponses(
  functionResponses: Array<{ functionResponse: { name: string; response: any } }>,
): Array<Record<string, any>> {
  return functionResponses.map(({ functionResponse }) => {
    const response = functionResponse.response || {};
    const summary: Record<string, any> = { name: functionResponse.name };

    if (typeof response.success === 'boolean') summary.success = response.success;
    if (typeof response.error === 'string') summary.error = response.error;
    if (typeof response.message === 'string') summary.message = response.message;
    if (typeof response.status === 'string') summary.status = response.status;
    if (typeof response.session_status === 'string') summary.session_status = response.session_status;
    if (typeof response.count === 'number') summary.count = response.count;
    if (typeof response.pid === 'number') summary.pid = response.pid;
    if (typeof response.session_id === 'string') summary.session_id = response.session_id;

    return summary;
  });
}
