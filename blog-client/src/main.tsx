import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "@astryxdesign/core/reset.css";
import "@astryxdesign/core/astryx.css";

import { AppShell } from "@astryxdesign/core/AppShell";
import { Badge } from "@astryxdesign/core/Badge";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Layout, LayoutContent } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { List, ListItem } from "@astryxdesign/core/List";
import { Section } from "@astryxdesign/core/Section";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { Theme } from "@astryxdesign/core/theme";

import { neutralTheme } from "./themes/neutral/neutral";
import "./themes/neutral/neutral.css";

const featuredTopics = ["AI", "Engineering", "Product", "Notes"] as const;

const articles = [
  {
    title: "Designing with calm defaults",
    summary:
      "How neutral surfaces, restrained hierarchy, and fewer ornamental decisions keep writing at the center of a product blog.",
    date: "Sep 20, 2026",
    topic: "Design",
  },
  {
    title: "Elysia backend experiments",
    summary:
      "A practical log of turning small API ideas into tested Bun services without letting the prototype shape leak into production.",
    date: "Sep 18, 2026",
    topic: "Backend",
  },
  {
    title: "A useful checklist for product notes",
    summary:
      "Questions that make a changelog sharper: who changed, why it matters, and what a reader can do next.",
    date: "Sep 14, 2026",
    topic: "Writing",
  },
] as const;

function App() {
  return (
    <Theme theme={neutralTheme}>
      <AppShell height="auto" variant="surface" contentPadding={0}>
        <Layout
          height="auto"
          contentWidth={960}
          content={
            <LayoutContent isScrollable={false} label="Blog home" padding={4}>
              <VStack gap={8} paddingBlock={6}>
                <Section variant="transparent" padding={0}>
                  <VStack gap={4}>
                    <HStack gap={2} wrap="wrap">
                      {featuredTopics.map((topic) => (
                        <Badge key={topic} variant="neutral" label={topic} />
                      ))}
                    </HStack>
                    <VStack gap={2}>
                      <Heading level={1} type="display-2" textWrap="balance">
                        LeiBlog
                      </Heading>
                      <Text as="p" type="large" color="secondary">
                        Notes on software, product craft, and the small decisions that make tools
                        feel easier to live with.
                      </Text>
                    </VStack>
                    <HStack gap={4} wrap="wrap">
                      <Link href="#latest" isStandalone weight="semibold">
                        Latest writing
                      </Link>
                      <Link href="#about" isStandalone color="secondary">
                        About the notebook
                      </Link>
                    </HStack>
                  </VStack>
                </Section>

                <Section id="latest" padding={0} dividers={["top"]}>
                  <List
                    hasDividers
                    density="spacious"
                    header={<Heading level={2}>Latest essays</Heading>}
                  >
                    {articles.map((article) => (
                      <ListItem
                        key={article.title}
                        href={`#${article.title.toLowerCase().replaceAll(" ", "-")}`}
                        label={article.title}
                        description={
                          <VStack gap={1}>
                            <Text as="p" color="secondary">
                              {article.summary}
                            </Text>
                            <Text type="supporting">
                              {article.date} · {article.topic}
                            </Text>
                          </VStack>
                        }
                        endContent={<Badge variant="neutral" label={article.topic} />}
                      />
                    ))}
                  </List>
                </Section>

                <Section id="about" variant="muted" padding={4}>
                  <VStack gap={2}>
                    <Heading level={2}>A quiet place for useful notes</Heading>
                    <Text as="p" color="secondary">
                      This first pass keeps the interface deliberately quiet: one readable column,
                      clear article rows, and neutral tokens from the editable Astryx theme source.
                    </Text>
                  </VStack>
                </Section>
              </VStack>
            </LayoutContent>
          }
        />
      </AppShell>
    </Theme>
  );
}

const rootElement = document.getElementById("app");

if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
