export const createAuthSessionGuard = () => {
  let revision = 0;

  return {
    invalidate: () => {
      revision += 1;
    },
    capture: () => {
      const capturedRevision = revision;
      return () => capturedRevision === revision;
    },
  };
};
