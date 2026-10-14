import type { ReactNode } from "react";
import { Button } from "@astryxdesign/core/Button";
import { Divider } from "@astryxdesign/core/Divider";

import type { AuthProvider, PublicAuthProvider } from "../../../shared/admin-api";

type OAuthSignInOptionsProps = {
  dividerLabel: string;
  isPending: boolean;
  pendingProvider?: AuthProvider;
  onSelect: (provider: AuthProvider) => void;
  options: readonly { provider: AuthProvider; label: string; icon: ReactNode }[];
  providers: readonly PublicAuthProvider[];
};

export const OAuthSignInOptions = ({
  dividerLabel,
  isPending,
  pendingProvider,
  onSelect,
  options,
  providers,
}: OAuthSignInOptionsProps) => {
  const visible = options.filter((option) =>
    providers.some((item) => item.provider === option.provider),
  );
  if (visible.length === 0) {
    return null;
  }
  return (
    <>
      <Divider label={dividerLabel} />
      <div className="auth-social-buttons">
        {visible.map(({ icon, label, provider }) => (
          <Button
            icon={icon}
            isDisabled={isPending || pendingProvider !== undefined}
            isLoading={pendingProvider === provider}
            key={provider}
            label={label}
            onClick={() => onSelect(provider)}
            size="lg"
            variant="secondary"
            width="100%"
          />
        ))}
      </div>
    </>
  );
};
