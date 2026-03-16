// @ts-nocheck
import * as __fd_glob_9 from "../content/docs/tasks.mdx?collection=docs"
import * as __fd_glob_8 from "../content/docs/integrations.mdx?collection=docs"
import * as __fd_glob_7 from "../content/docs/index.mdx?collection=docs"
import * as __fd_glob_6 from "../content/docs/getting-started.mdx?collection=docs"
import * as __fd_glob_5 from "../content/docs/departments.mdx?collection=docs"
import * as __fd_glob_4 from "../content/docs/chat-interface.mdx?collection=docs"
import * as __fd_glob_3 from "../content/docs/architecture.mdx?collection=docs"
import * as __fd_glob_2 from "../content/docs/api-reference.mdx?collection=docs"
import * as __fd_glob_1 from "../content/docs/agents.mdx?collection=docs"
import { default as __fd_glob_0 } from "../content/docs/meta.json?collection=docs"
import { server } from 'fumadocs-mdx/runtime/server';
import type * as Config from '../source.config';

const create = server<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>({"doc":{"passthroughs":["extractedReferences"]}});

export const docs = await create.docs("docs", "content/docs", {"meta.json": __fd_glob_0, }, {"agents.mdx": __fd_glob_1, "api-reference.mdx": __fd_glob_2, "architecture.mdx": __fd_glob_3, "chat-interface.mdx": __fd_glob_4, "departments.mdx": __fd_glob_5, "getting-started.mdx": __fd_glob_6, "index.mdx": __fd_glob_7, "integrations.mdx": __fd_glob_8, "tasks.mdx": __fd_glob_9, });