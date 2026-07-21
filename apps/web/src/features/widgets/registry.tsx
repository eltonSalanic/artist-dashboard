import type { ComponentType } from "react";
import { CheckSquare2, UserCheck } from "lucide-react";
import type { WidgetType } from "@artist/shared";
import { MyTasksWidget, MyTasksWidgetExpanded } from "./my-tasks-widget";
import { TodosWidget, TodosWidgetExpanded } from "./todos-widget";

export interface WidgetProps {
  boardId: string;
}

export interface WidgetDefinition {
  title: string;
  icon: ComponentType<{ className?: string }>;
  Collapsed: ComponentType<WidgetProps>;
  Expanded: ComponentType<WidgetProps>;
  defaultSize: { w: number; h: number };
  minSize: { w: number; h: number };
}

/**
 * Widgets not yet built (GOALS, FOCUS, etc. — later phases) are simply
 * absent here; DashboardGrid skips any layout entry with no registry match.
 */
export const widgetRegistry: Partial<Record<WidgetType, WidgetDefinition>> = {
  TODOS: {
    title: "To-Do's",
    icon: CheckSquare2,
    Collapsed: TodosWidget,
    Expanded: TodosWidgetExpanded,
    defaultSize: { w: 8, h: 6 },
    minSize: { w: 4, h: 3 },
  },
  MY_TASKS: {
    title: "My Tasks",
    icon: UserCheck,
    Collapsed: MyTasksWidget,
    Expanded: MyTasksWidgetExpanded,
    defaultSize: { w: 4, h: 6 },
    minSize: { w: 3, h: 3 },
  },
};
