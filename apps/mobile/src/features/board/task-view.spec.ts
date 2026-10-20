import {
  activeFilters,
  canDragInView,
  defaultTaskView,
  keepTask,
  taskQuery,
} from './task-view';

describe('taskQuery', () => {
  it('sends only the sort for the default view', () => {
    expect(taskQuery(defaultTaskView('order'))).toEqual({ sort: 'order' });
  });

  it('sends a chosen status, priority and assignee', () => {
    expect(
      taskQuery({ sort: 'dueDate', status: 's1', priority: 'HIGH', assignee: 'u1' }),
    ).toEqual({ sort: 'dueDate', statusId: 's1', priority: 'HIGH', assigneeId: 'u1' });
  });

  // "Open" is every status not done; the API has no param for it.
  it('leaves "open" off the query', () => {
    expect(taskQuery({ ...defaultTaskView('order'), status: 'open' })).toEqual({ sort: 'order' });
  });

  it('keeps an assignee the screen fixes', () => {
    expect(
      taskQuery({ ...defaultTaskView('dueDate'), assignee: 'u2' }, { assigneeId: 'me' }),
    ).toEqual({ sort: 'dueDate', assigneeId: 'me' });
  });
});

describe('keepTask', () => {
  const done = { status: { isDone: true } };
  const open = { status: { isDone: false } };

  it('drops done tasks only under "open"', () => {
    expect(keepTask({ ...defaultTaskView('order'), status: 'open' }, done)).toBe(false);
    expect(keepTask({ ...defaultTaskView('order'), status: 'open' }, open)).toBe(true);
    expect(keepTask(defaultTaskView('order'), done)).toBe(true);
  });
});

describe('activeFilters / canDragInView', () => {
  it('counts filters, not the sort', () => {
    expect(activeFilters(defaultTaskView('priority'))).toBe(0);
    expect(activeFilters({ sort: 'order', status: 'open', priority: 'LOW', assignee: 'all' })).toBe(
      2,
    );
  });

  it('offers dragging only for the whole list in board order', () => {
    expect(canDragInView(defaultTaskView('order'))).toBe(true);
    expect(canDragInView(defaultTaskView('dueDate'))).toBe(false);
    expect(canDragInView({ ...defaultTaskView('order'), priority: 'HIGH' })).toBe(false);
  });
});
