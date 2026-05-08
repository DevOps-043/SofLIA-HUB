import { IRIS_AUTH_TOOLS } from './iris/auth-tools';
import { IRIS_PROJECT_TOOLS } from './iris/project-tools';
import { IRIS_TASK_TOOLS } from './iris/task-tools';
import { IRIS_TEAM_TOOLS } from './iris/team-tools';

export const IRIS_TOOLS = [
  ...IRIS_AUTH_TOOLS,
  ...IRIS_TASK_TOOLS,
  ...IRIS_PROJECT_TOOLS,
  ...IRIS_TEAM_TOOLS,
];
