#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import axios from "axios";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ path: new URL("./.env", import.meta.url).pathname });

const N8N_URL = process.env.N8N_URL || "http://localhost:5678";
const N8N_USER = process.env.N8N_USER || "admin";
const N8N_PASSWORD = process.env.N8N_PASSWORD || "changeme";

const client = axios.create({
  baseURL: `${N8N_URL}/rest`,
  auth: { username: N8N_USER, password: N8N_PASSWORD },
  timeout: 15000,
});

const server = new McpServer({
  name: "n8n-mcp",
  version: "0.1.0",
});

server.registerTool(
  "n8n_list_workflows",
  {
    title: "List n8n Workflows",
    description: "Return id, name, and active state for each workflow",
    inputSchema: z.object({}),
    outputSchema: z.object({
      workflows: z.array(
        z.object({
          id: z.union([z.string(), z.number()]),
          name: z.string(),
          active: z.boolean(),
        })
      ),
    }),
  },
  async () => {
    const response = await client.get("/workflows");
    const workflows = response.data.data.map(({ id, name, active }) => ({
      id,
      name,
      active,
    }));

    const output = { workflows };
    return {
      content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
      structuredContent: output,
    };
  }
);

server.registerTool(
  "n8n_execute_workflow",
  {
    title: "Execute n8n Workflow",
    description: "Trigger a workflow via REST run endpoint",
    inputSchema: z.object({
      workflowId: z.union([z.string(), z.number()]),
      payload: z.record(z.any()).optional(),
    }),
    outputSchema: z.object({
      executionId: z.string(),
    }),
  },
  async ({ workflowId, payload = {} }) => {
    const response = await client.post(`/workflows/${workflowId}/run`, {
      workflowData: payload,
    });
    const executionId = response.data.data.executionId;
    const output = { executionId };
    return {
      content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
      structuredContent: output,
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);

console.error("n8n MCP server ready");
await new Promise(() => {});
