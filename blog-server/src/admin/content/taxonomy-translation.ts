import { prepareUserProfileLocalizations } from "../../shared/profile-tags";
import type { CategoryInput } from "./service";

type TaxonomyEnglish = { nameEn: string | null; descriptionEn: string | null };

const untranslatedCopy = (source: string, target: string) =>
  source.trim() === target.trim() && /\p{Script=Han}/u.test(source) ? "" : target;

export const prepareTaxonomyInput = async <Input extends CategoryInput>({
  apiKey,
  input,
  existing,
}: {
  apiKey?: string;
  input: Input;
  existing?: TaxonomyEnglish;
}) => {
  const name = input.name.trim();
  const description = input.description?.trim() ?? "";
  const englishName =
    (input.localizations?.en?.name === undefined
      ? existing?.nameEn
      : input.localizations.en.name) ?? "";
  const englishDescription =
    (input.localizations?.en?.description === undefined
      ? existing?.descriptionEn
      : input.localizations.en.description) ?? "";
  const result = await prepareUserProfileLocalizations({
    deeplApiKey: apiKey,
    profile: {
      zhCN: { name, bio: description, tags: [] },
      en: {
        name: untranslatedCopy(name, englishName),
        bio: untranslatedCopy(description, englishDescription),
        tags: [],
      },
    },
  });
  return {
    ...input,
    name: result.localizations.zhCN.name,
    description: result.localizations.zhCN.bio,
    localizations: {
      en: { name: result.localizations.en.name, description: result.localizations.en.bio },
    },
  };
};
