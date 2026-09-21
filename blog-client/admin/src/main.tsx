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

import { neutralTheme } from "../../shared/themes/neutral/neutral";
import "../../shared/themes/neutral/neutral.css";

const ADMIN_METRICS = [
  { label: "Drafts", value: "12", description: "3 ready for editorial review" },
  { label: "Comments", value: "28", description: "6 waiting for moderation" },
  { label: "Assets", value: "146", description: "Images and documents in storage" },
] as const;

const PUBLISHING_TASKS = [
  {
    title: "Review homepage feature article",
    description: "Check summary length, cover image, and pinned topic before publishing.",
    state: "Editorial",
  },
  {
    title: "Refresh navigation labels",
    description: "Confirm the public blog categories match the current writing plan.",
    state: "Content",
  },
  {
    title: "Audit media library",
    description: "Find unused uploads before the next backup snapshot is created.",
    state: "Storage",
  },
] as const;

function App() {
  return (
    <Theme theme={neutralTheme}>
      <AppShell height="auto" variant="surface" contentPadding={0}>
        <Layout
          height="auto"
          contentWidth={1040}
          content={
            <LayoutContent isScrollable={false} label="Admin dashboard" padding={4}>
              <VStack gap={8} paddingBlock={6}>
                <Section variant="transparent" padding={0}>
                  <VStack gap={4}>
                    <HStack gap={2} wrap="wrap">
                      <Badge variant="neutral" label="Admin" />
                      <Badge variant="neutral" label="Content" />
                      <Badge variant="neutral" label="Operations" />
                    </HStack>
                    <VStack gap={2}>
                      <Heading level={1} type="display-2" textWrap="balance">
                        LeiBlog Admin
                      </Heading>
                      <Text as="p" type="large" color="secondary">
                        A focused workspace for publishing, moderation, and keeping the blog running
                        cleanly.
                      </Text>
                    </VStack>
                    <HStack gap={4} wrap="wrap">
                      <Link href="/blog/" isStandalone weight="semibold">
                        View blog
                      </Link>
                      <Link href="#queue" isStandalone color="secondary">
                        Publishing queue
                      </Link>
                    </HStack>
                  </VStack>
                </Section>

                <Section padding={0} dividers={["top"]}>
                  <List hasDividers density="spacious" header={<Heading level={2}>Today</Heading>}>
                    {ADMIN_METRICS.map((metric) => (
                      <ListItem
                        key={metric.label}
                        label={metric.label}
                        description={metric.description}
                        endContent={
                          <Text type="large" weight="bold">
                            {metric.value}
                          </Text>
                        }
                      />
                    ))}
                  </List>
                </Section>

                <Section id="queue" variant="muted" padding={4}>
                  <List
                    hasDividers
                    density="spacious"
                    header={<Heading level={2}>Publishing queue</Heading>}
                  >
                    {PUBLISHING_TASKS.map((task) => (
                      <ListItem
                        key={task.title}
                        label={task.title}
                        description={task.description}
                        endContent={<Badge variant="neutral" label={task.state} />}
                      />
                    ))}
                  </List>
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
