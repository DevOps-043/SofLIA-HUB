import { emptyParams, objectParams, stringProp } from './schema';
import type { GeminiToolGroup } from './types';

export const PROJECT_HUB_TOOLS: GeminiToolGroup = {
  functionDeclarations: [
    { name: 'delete_iris_project', description: 'Elimina un proyecto de Project Hub (IRIS) de manera permanente.', parameters: objectParams({ project_id: stringProp('ID del proyecto.') }, ['project_id']) },
    { name: 'get_iris_teams', description: 'Lista los equipos disponibles en IRIS.', parameters: emptyParams() },
    { name: 'get_iris_projects', description: 'Lista los proyectos disponibles en IRIS. Puede filtrar por equipo.', parameters: objectParams({ team_id: stringProp('ID del equipo. Opcional.'), team_name: stringProp('Nombre o slug del equipo. Opcional.') }) },
    { name: 'get_iris_team_members', description: 'Lista los miembros de un equipo de IRIS para asignar tareas sin adivinar el responsable.', parameters: objectParams({ team_id: stringProp('ID del equipo.'), team_name: stringProp('Nombre o slug del equipo.') }) },
    { name: 'create_iris_project', description: 'Crea un nuevo proyecto en Project Hub (IRIS). Si no conoces el ID del equipo, usa team_name.', parameters: objectParams({ project_name: stringProp('Nombre del proyecto.'), team_id: stringProp('ID del equipo. Opcional.'), team_name: stringProp('Nombre o slug del equipo. Opcional.'), project_description: stringProp('Descripcion del proyecto.'), project_key: stringProp('Clave corta del proyecto. Opcional; se genera automaticamente si falta.') }, ['project_name']) },
    { name: 'create_iris_issue', description: 'Crea una nueva tarea en Project Hub (IRIS). No inventes IDs: resuelve antes equipo, proyecto y responsable.', parameters: objectParams({ title: stringProp('Titulo de la tarea.'), description: stringProp('Descripcion detallada de la tarea.'), team_id: stringProp('ID del equipo. Opcional si envias team_name o si el proyecto ya define el equipo.'), team_name: stringProp('Nombre o slug del equipo. Opcional.'), project_id: stringProp('ID del proyecto. Opcional.'), project_name: stringProp('Nombre o key del proyecto. Opcional.'), status_id: stringProp('ID de estado. Opcional.'), status_name: stringProp('Nombre del estado. Opcional.'), priority_id: stringProp('ID de prioridad. Opcional.'), priority_name: stringProp('Nombre de prioridad. Opcional.'), assignee_id: stringProp('ID del usuario asignado. Opcional.'), assignee_name: stringProp('Nombre, username o email del responsable. Opcional.') }, ['title']) },
    { name: 'get_iris_statuses', description: 'Obtiene los estados disponibles para un equipo de IRIS.', parameters: objectParams({ team_id: stringProp('ID del equipo.'), team_name: stringProp('Nombre o slug del equipo.') }) },
    { name: 'get_iris_priorities', description: 'Obtiene las prioridades disponibles en IRIS.', parameters: emptyParams() },
    { name: 'get_current_user_id', description: 'Obtiene el ID del usuario actual de la sesion.', parameters: emptyParams() },
  ],
};
