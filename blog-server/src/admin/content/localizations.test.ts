import { Database } from "bun:sqlite";
import { afterEach, beforeEach, expect, test } from "bun:test";

import type { Sql } from "postgres";

import { upsertArticleEn, upsertCategoryEn, upsertTagEn } from "./localizations";

let database: Database;
let sql: Sql;

beforeEach(() => {
  database = new Database(":memory:");
  database.run(
    "CREATE TABLE articles_en (article_id TEXT PRIMARY KEY, title TEXT, summary TEXT, content_mdx TEXT)",
  );
  database.run(
    "CREATE TABLE article_categories_en (category_id TEXT PRIMARY KEY, name TEXT, description TEXT)",
  );
  database.run(
    "CREATE TABLE article_tags_en (tag_id TEXT PRIMARY KEY, name TEXT, description TEXT)",
  );
  // Execute the production SQL with SQLite parameters; no network database is involved.
  const tag = async (strings: TemplateStringsArray, ...values: (string | boolean | null)[]) => {
    const query = strings.join("?");
    return database
      .query(query)
      .run(...values.map((value) => (typeof value === "boolean" ? Number(value) : value)));
  };
  sql = tag as unknown as Sql;
});
afterEach(() => database.close());

test("article localization patches retain omitted fields and clear explicit nulls", async () => {
  await upsertArticleEn({
    articleId: "fixture",
    sql,
    input: { localizations: { en: { title: "Title", summary: "Summary", contentMdx: "Body" } } },
  });
  await upsertArticleEn({
    articleId: "fixture",
    sql,
    input: { localizations: { en: { title: "Changed" } } },
  });
  expect(database.query("SELECT title, summary, content_mdx FROM articles_en").get()).toEqual({
    title: "Changed",
    summary: "Summary",
    content_mdx: "Body",
  });
  await upsertArticleEn({
    articleId: "fixture",
    sql,
    input: { localizations: { en: { summary: null } } },
  });
  expect(database.query("SELECT title, summary, content_mdx FROM articles_en").get()).toEqual({
    title: "Changed",
    summary: null,
    content_mdx: "Body",
  });
});

test("category and tag localization patches preserve descriptions and support clearing", async () => {
  await upsertCategoryEn({
    categoryId: "fixture",
    sql,
    input: {
      name: "Base",
      localizations: { en: { name: "Name", description: "Description" } },
    },
  });
  await upsertCategoryEn({
    categoryId: "fixture",
    sql,
    input: {
      name: "Base",
      localizations: { en: { name: "Changed" } },
    },
  });
  expect(database.query("SELECT name, description FROM article_categories_en").get()).toEqual({
    name: "Changed",
    description: "Description",
  });
  await upsertTagEn({
    tagId: "fixture",
    sql,
    input: {
      name: "Base",
      localizations: { en: { name: "Name", description: "Description" } },
    },
  });
  await upsertTagEn({
    tagId: "fixture",
    sql,
    input: {
      name: "Base",
      localizations: { en: { description: null } },
    },
  });
  expect(database.query("SELECT name, description FROM article_tags_en").get()).toEqual({
    name: "Name",
    description: null,
  });
});

test("empty or omitted localization objects preserve existing translations", async () => {
  database.run("INSERT INTO articles_en VALUES ('fixture', 'Title', 'Summary', 'Body')");
  await upsertArticleEn({ articleId: "fixture", sql, input: {} });
  await upsertArticleEn({ articleId: "fixture", sql, input: { localizations: { en: {} } } });
  expect(database.query("SELECT title, summary, content_mdx FROM articles_en").get()).toEqual({
    title: "Title",
    summary: "Summary",
    content_mdx: "Body",
  });
});
