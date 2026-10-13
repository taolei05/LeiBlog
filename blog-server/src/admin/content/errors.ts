export const CONTENT_FAILURE = {
  CategoryNotFound: "category-not-found",
  ContributorNotFound: "contributor-not-found",
  InvalidSlug: "invalid-slug",
  InvalidStatus: "invalid-status",
  InvalidTitle: "invalid-title",
  NotFound: "not-found",
  SlugExists: "slug-exists",
  TagNotFound: "tag-not-found",
  TaxonomyInUse: "taxonomy-in-use",
} as const;

export type ContentFailure = (typeof CONTENT_FAILURE)[keyof typeof CONTENT_FAILURE];

export class ContentError extends Error {
  readonly reason: ContentFailure;

  constructor(reason: ContentFailure, message: string) {
    super(message);
    this.reason = reason;
  }
}

export class ContentInputError extends Error {
  readonly reason: "invalid-date" | "invalid-url";

  constructor(reason: "invalid-date" | "invalid-url", message: string) {
    super(message);
    this.reason = reason;
  }
}
