import type { ComponentType } from "react";
import {
  Activity,
  BellRing,
  CalendarDays,
  CheckSquare2,
  Mic2,
  NotebookPen,
  Target,
  UserCheck,
  Users,
  Zap,
} from "lucide-react";
import type { WidgetColor, WidgetType } from "@artist/shared";
import { MyTasksWidget, MyTasksWidgetExpanded } from "./my-tasks-widget";
import { TodosWidget, TodosWidgetExpanded } from "./todos-widget";
import { GoalsWidget, GoalsWidgetExpanded } from "./goals-widget";
import { FocusWidget, FocusWidgetExpanded } from "./focus-widget";
import { makeEventsWidget } from "./events-widget";
import {
  RemindersWidget,
  RemindersWidgetExpanded,
} from "./reminders-widget";
import {
  ActivityWidget,
  ActivityWidgetExpanded,
} from "./activity-widget";
import {
  CustomWidget,
  CustomWidgetExpanded,
} from "@/features/custom-widget/custom-widget";

export interface WidgetProps {
  boardId: string;
}

export interface WidgetDefinition {
  title: string;
  icon: ComponentType<{ className?: string }>;
  /** Palette slot this widget ships in; a board can reassign it. Omitted = neutral card. */
  defaultColor?: WidgetColor;
  Collapsed: ComponentType<WidgetProps>;
  Expanded: ComponentType<WidgetProps>;
  defaultSize: { w: number; h: number };
  minSize: { w: number; h: number };
}

const shows = makeEventsWidget("SHOW");
const rehearsals = makeEventsWidget("REHEARSAL");
const meetings = makeEventsWidget("MEETING");

/**
 * Every widget type that ships is registered here; DashboardGrid skips any
 * layout entry with no registry match (CALENDAR is a full page, not a widget).
 */
export const widgetRegistry: Partial<Record<WidgetType, WidgetDefinition>> = {
  FOCUS: {
    title: "Focus",
    icon: Zap,
    defaultColor: "c1",
    Collapsed: FocusWidget,
    Expanded: FocusWidgetExpanded,
    defaultSize: { w: 12, h: 3 },
    minSize: { w: 4, h: 2 },
  },
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
  GOALS: {
    title: "Goals",
    icon: Target,
    defaultColor: "c2",
    Collapsed: GoalsWidget,
    Expanded: GoalsWidgetExpanded,
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 3 },
  },
  SHOWS: {
    title: "Shows",
    icon: Mic2,
    defaultColor: "c4",
    Collapsed: shows.Collapsed,
    Expanded: shows.Expanded,
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 3 },
  },
  NEXT_REHEARSALS: {
    title: "Next Rehearsals",
    icon: CalendarDays,
    Collapsed: rehearsals.Collapsed,
    Expanded: rehearsals.Expanded,
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 3 },
  },
  NEXT_MEETINGS: {
    title: "Next Meetings",
    icon: Users,
    Collapsed: meetings.Collapsed,
    Expanded: meetings.Expanded,
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 3 },
  },
  REMINDERS: {
    title: "Reminders",
    icon: BellRing,
    defaultColor: "c3",
    Collapsed: RemindersWidget,
    Expanded: RemindersWidgetExpanded,
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 3 },
  },
  ACTIVITY_FEED: {
    title: "Activity",
    icon: Activity,
    Collapsed: ActivityWidget,
    Expanded: ActivityWidgetExpanded,
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 3 },
  },
  CUSTOM: {
    title: "Notes",
    icon: NotebookPen,
    Collapsed: CustomWidget,
    Expanded: CustomWidgetExpanded,
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 3 },
  },
};
