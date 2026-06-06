import { Separator } from "@heroui/react";
import { useEffect, useMemo, useState } from "react";

import type {
  PublicSiteConfig,
  PublicSiteFiling,
  PublicSiteFilingRecord,
  PublicSiteInfo,
} from "../../shared/site/site-info";

export function getSiteUptimeSeconds(establishedAt: string | undefined, now = Date.now()) {
  if (!establishedAt) return 0;

  const establishedTime = new Date(establishedAt).getTime();
  if (!Number.isFinite(establishedTime)) return 0;

  return Math.max(0, Math.floor((now - establishedTime) / 1000));
}

function getCleanIcpRecords(records: readonly PublicSiteFilingRecord[] | undefined) {
  return (records ?? [])
    .map((record) => ({
      number: record.number.trim(),
      url: record.url?.trim() || null,
    }))
    .filter((record) => record.number.length > 0);
}

type FilingLinkProps = {
  className: string;
  number: string;
  url: string | null;
};

function FilingLink({ className, number, url }: FilingLinkProps) {
  if (!url) {
    return <span className={className}>{number}</span>;
  }

  return (
    <a className={className} href={url} rel="noreferrer" target="_blank">
      {number}
    </a>
  );
}

type BlogFooterProps = {
  now?: number;
  siteConfig: PublicSiteConfig | null | undefined;
  siteFiling: PublicSiteFiling | null | undefined;
  siteInfo: PublicSiteInfo | undefined;
};

export function BlogFooter({ now, siteConfig, siteFiling, siteInfo }: BlogFooterProps) {
  const [currentTime, setCurrentTime] = useState(() => now ?? Date.now());
  const copyright = siteConfig?.copyright.trim();
  const icpRecords = useMemo(
    () => getCleanIcpRecords(siteFiling?.icpRecords),
    [siteFiling?.icpRecords],
  );
  const policeNumber = siteFiling?.policeNumber?.trim() || null;
  const policeUrl = siteFiling?.policeUrl?.trim() || null;
  const uptimeSeconds = getSiteUptimeSeconds(siteInfo?.establishedAt, currentTime);
  const hasMetaLine = Boolean(copyright) || Boolean(siteInfo?.establishedAt);
  const hasFilingLine = icpRecords.length > 0 || Boolean(policeNumber);

  useEffect(() => {
    if (now !== undefined) {
      setCurrentTime(now);
      return;
    }

    const timer = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [now]);

  if (!hasMetaLine && !hasFilingLine) {
    return null;
  }

  return (
    <footer aria-label="站点页脚" className="blog-footer">
      <Separator className="blog-footer__separator" />
      <div className="blog-footer__content">
        {hasMetaLine ? (
          <p className="blog-footer__line blog-footer__line--meta">
            {copyright ? <span>{copyright}</span> : null}
            {siteInfo?.establishedAt ? <span>本站已运行{uptimeSeconds}秒</span> : null}
          </p>
        ) : null}
        {icpRecords.length > 0 ? (
          <p className="blog-footer__line blog-footer__line--icp">
            {icpRecords.map((record) => (
              <FilingLink
                className="blog-footer__link"
                key={record.number}
                number={record.number}
                url={record.url}
              />
            ))}
          </p>
        ) : null}
        {policeNumber ? (
          <p className="blog-footer__line blog-footer__line--police">
            <FilingLink className="blog-footer__link" number={policeNumber} url={policeUrl} />
          </p>
        ) : null}
      </div>
    </footer>
  );
}
