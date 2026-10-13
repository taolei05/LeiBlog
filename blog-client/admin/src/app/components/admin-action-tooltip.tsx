import type { PropsWithChildren, ReactNode } from "react";

import { Tooltip } from "@astryxdesign/core/Tooltip";

type AdminActionTooltipProps = PropsWithChildren<{
  label: ReactNode;
}>;

export const AdminActionTooltip = ({ children, label }: AdminActionTooltipProps) => (
  <Tooltip content={label} hasHoverIndication={false} placement="above">
    {children}
  </Tooltip>
);
