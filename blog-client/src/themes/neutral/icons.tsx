/**
 * @file icons.tsx
 * @input Uses lucide-react icon components, IconRegistry type
 * @output Exports neutralIconRegistry for the neutral theme
 * @position Icon configuration for the neutral theme; consumed by index.ts
 *
 * Maps semantic icon names to Lucide icon components.
 * These icons are bundled with the theme, not with @astryxdesign/core.
 */

import type { IconRegistry } from "@astryxdesign/core/Icon";
import type { LucideIcon } from "lucide-react";

import { createElement } from "react";
import {
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Check,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  Calendar,
  Clock,
  ExternalLink,
  Menu,
  MoreHorizontal,
  Search,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Filter,
  EyeOff,
  Columns,
  Copy,
  CheckCheck,
  Wrench,
  Square,
  Mic,
} from "lucide-react";

const iconProps = {
  size: "1em",
  "aria-hidden": true as const,
};

const icon = (Icon: LucideIcon) => createElement(Icon, iconProps);

export const neutralIconRegistry: IconRegistry = {
  close: icon(X),
  chevronDown: icon(ChevronDown),
  chevronLeft: icon(ChevronLeft),
  chevronRight: icon(ChevronRight),
  chevronsLeft: icon(ChevronsLeft),
  chevronsRight: icon(ChevronsRight),
  check: icon(Check),
  success: icon(CheckCircle),
  error: icon(XCircle),
  warning: icon(AlertTriangle),
  info: icon(Info),
  calendar: icon(Calendar),
  clock: icon(Clock),
  externalLink: icon(ExternalLink),
  menu: icon(Menu),
  moreHorizontal: icon(MoreHorizontal),
  search: icon(Search),
  arrowUp: icon(ArrowUp),
  arrowDown: icon(ArrowDown),
  arrowsUpDown: icon(ArrowUpDown),
  funnel: icon(Filter),
  eyeSlash: icon(EyeOff),
  viewColumns: icon(Columns),
  copy: icon(Copy),
  checkDouble: icon(CheckCheck),
  wrench: icon(Wrench),
  stop: icon(Square),
  microphone: icon(Mic),
};
