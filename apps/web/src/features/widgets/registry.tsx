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
  Wallet,
  Zap,
} from "lucide-react";
import { WIDGET_META, type WidgetColor, type WidgetType } from "@artist/shared";
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
  FinancesWidget,
  FinancesWidgetExpanded,
} from "./finances-widget";
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
    ...WIDGET_META.FOCUS,
    icon: Zap,
    Collapsed: FocusWidget,
    Expanded: FocusWidgetExpanded,
    defaultSize: { w: 12, h: 3 },
    minSize: { w: 4, h: 2 },
  },
  TODOS: {
    ...WIDGET_META.TODOS,
    icon: CheckSquare2,
    Collapsed: TodosWidget,
    Expanded: TodosWidgetExpanded,
    defaultSize: { w: 8, h: 6 },
    minSize: { w: 4, h: 3 },
  },
  MY_TASKS: {
    ...WIDGET_META.MY_TASKS,
    icon: UserCheck,
    Collapsed: MyTasksWidget,
    Expanded: MyTasksWidgetExpanded,
    defaultSize: { w: 4, h: 6 },
    minSize: { w: 3, h: 3 },
  },
  GOALS: {
    ...WIDGET_META.GOALS,
    icon: Target,
    Collapsed: GoalsWidget,
    Expanded: GoalsWidgetExpanded,
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 3 },
  },
  SHOWS: {
    ...WIDGET_META.SHOWS,
    icon: Mic2,
    Collapsed: shows.Collapsed,
    Expanded: shows.Expanded,
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 3 },
  },
  NEXT_REHEARSALS: {
    ...WIDGET_META.NEXT_REHEARSALS,
    icon: CalendarDays,
    Collapsed: rehearsals.Collapsed,
    Expanded: rehearsals.Expanded,
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 3 },
  },
  NEXT_MEETINGS: {
    ...WIDGET_META.NEXT_MEETINGS,
    icon: Users,
    Collapsed: meetings.Collapsed,
    Expanded: meetings.Expanded,
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 3 },
  },
  REMINDERS: {
    ...WIDGET_META.REMINDERS,
    icon: BellRing,
    Collapsed: RemindersWidget,
    Expanded: RemindersWidgetExpanded,
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 3 },
  },
  ACTIVITY_FEED: {
    ...WIDGET_META.ACTIVITY_FEED,
    icon: Activity,
    Collapsed: ActivityWidget,
    Expanded: ActivityWidgetExpanded,
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 3 },
  },
  CUSTOM: {
    ...WIDGET_META.CUSTOM,
    icon: NotebookPen,
    Collapsed: CustomWidget,
    Expanded: CustomWidgetExpanded,
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 3 },
  },
  FINANCES: {
    ...WIDGET_META.FINANCES,
    icon: Wallet,
    Collapsed: FinancesWidget,
    Expanded: FinancesWidgetExpanded,
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 3 },
  },
};
