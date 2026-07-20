export interface DefaultStatus {
  name: string;
  color: string;
  sortOrder: number;
  isDone: boolean;
}

/** Statuses every new board starts with; admins can edit them later. */
export const DEFAULT_TASK_STATUSES: DefaultStatus[] = [
  { name: 'Not Started', color: '#8b8fa3', sortOrder: 0, isDone: false },
  { name: 'In Progress', color: '#4f7cff', sortOrder: 1, isDone: false },
  { name: 'Waiting', color: '#f5a623', sortOrder: 2, isDone: false },
  { name: 'Done', color: '#2fbf71', sortOrder: 3, isDone: true },
];
