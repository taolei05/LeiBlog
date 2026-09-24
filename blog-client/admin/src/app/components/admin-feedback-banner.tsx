import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";

import { Banner } from "@astryxdesign/core/Banner";

export type AdminFeedbackBannerStatus = "success" | "warning" | "error";

export type AdminFeedbackBannerState = {
  id: number;
  status: AdminFeedbackBannerStatus;
  description?: string;
  title: string;
};

export type CreateAdminFeedbackBannerParams = {
  status: AdminFeedbackBannerStatus;
  description?: string;
  title: string;
};

const ADMIN_FEEDBACK_BANNER_STYLE: CSSProperties = {
  left: "50%",
  maxWidth: "calc(100vw - 32px)",
  position: "fixed",
  top: 16,
  transform: "translateX(-50%)",
  width: "max-content",
  zIndex: 1000,
};

const ADMIN_FEEDBACK_BANNER_AUTO_DISMISS_MS = 4000;

export const createAdminFeedbackBanner = ({
  description,
  status,
  title,
}: CreateAdminFeedbackBannerParams): AdminFeedbackBannerState => ({
  description,
  id: Date.now(),
  status,
  title,
});

type AdminFeedbackBannerProps = {
  banner?: AdminFeedbackBannerState;
  onDismiss: () => void;
};

export const AdminFeedbackBanner = ({ banner, onDismiss }: AdminFeedbackBannerProps) => {
  const onDismissRef = useRef(onDismiss);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (banner === undefined) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      onDismissRef.current();
    }, ADMIN_FEEDBACK_BANNER_AUTO_DISMISS_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [banner?.id]);

  if (banner === undefined) {
    return null;
  }

  return (
    <div style={ADMIN_FEEDBACK_BANNER_STYLE}>
      <Banner
        key={banner.id}
        status={banner.status}
        description={banner.description}
        title={banner.title}
        container="card"
        elevation="med"
        isDismissable
        onDismiss={onDismiss}
      />
    </div>
  );
};
