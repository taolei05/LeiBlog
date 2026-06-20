import { Link } from "@heroui/react";

export const ADMIN_API_KEY_URLS = {
  deepl: "https://www.deepl.com/your-account/keys",
  ipgeolocation: "https://app.ipgeolocation.io/signup",
  r2: "https://dash.cloudflare.com/?to=/:account/r2/api-tokens",
  resend: "https://resend.com/api-keys",
} as const;

export function ApiKeyGetLink({ href }: { href: string }) {
  return (
    <Link className="api-key-get-link" href={href} rel="noreferrer" target="_blank">
      前往获取
      <Link.Icon />
    </Link>
  );
}
