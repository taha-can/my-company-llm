// @ts-nocheck
import { browser } from 'fumadocs-mdx/runtime/browser';
import type * as Config from '../source.config';

const create = browser<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>();
const browserCollections = {
  docs: create.doc("docs", {"agents.mdx": () => import("../content/docs/agents.mdx?collection=docs"), "api-reference.mdx": () => import("../content/docs/api-reference.mdx?collection=docs"), "architecture.mdx": () => import("../content/docs/architecture.mdx?collection=docs"), "chat-interface.mdx": () => import("../content/docs/chat-interface.mdx?collection=docs"), "departments.mdx": () => import("../content/docs/departments.mdx?collection=docs"), "getting-started.mdx": () => import("../content/docs/getting-started.mdx?collection=docs"), "index.mdx": () => import("../content/docs/index.mdx?collection=docs"), "integrations.mdx": () => import("../content/docs/integrations.mdx?collection=docs"), "tasks.mdx": () => import("../content/docs/tasks.mdx?collection=docs"), }),
};
export default browserCollections;