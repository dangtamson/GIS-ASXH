import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

process.env.SUPABASE_PUBLISHABLE_KEY ||= "postman-export-placeholder-key";

type PostmanUrl = {
  path?: string[];
};

type PostmanRequest = {
  url?: PostmanUrl;
  method?: string;
  header?: Array<{
    key?: string;
    value?: string;
    [key: string]: unknown;
  }>;
};

type PostmanEvent = {
  listen?: string;
  script?: {
    type?: string;
    exec?: string[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

type PostmanCollectionInfo = {
  name: string;
  [key: string]: unknown;
};

type PostmanCollection = {
  info: PostmanCollectionInfo;
  item: PostmanItem[];
  variable?: unknown[];
  event?: unknown[];
  auth?: unknown;
  [key: string]: unknown;
};

type PostmanItem = {
  name?: string;
  item?: PostmanItem[];
  request?: PostmanRequest;
  event?: PostmanEvent[];
  [key: string]: unknown;
};

type ConvertResult = {
  result: boolean;
  output?: Array<{
    type?: string;
    data: unknown;
    name?: string;
  }>;
  reason?: string;
};

type ConvertError = {
  message: string;
  name?: string;
};

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

type JsonObject = { [key: string]: JsonValue };

const isJsonObject = (value: JsonValue | undefined): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const cloneJson = <T extends JsonValue>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const mergeRequired = (left: JsonValue | undefined, right: JsonValue | undefined): string[] | undefined => {
  const values = [
    ...(Array.isArray(left) ? left : []),
    ...(Array.isArray(right) ? right : [])
  ].filter((item): item is string => typeof item === "string");

  return values.length > 0 ? [...new Set(values)] : undefined;
};

const flattenSuccessResponseAllOf = (document: JsonObject): JsonObject => {
  const cloned = cloneJson(document);
  const components = isJsonObject(cloned.components) ? cloned.components : undefined;
  const schemas = components && isJsonObject(components.schemas) ? components.schemas : undefined;
  const successResponseSchema = schemas?.SuccessResponse;

  if (!isJsonObject(successResponseSchema)) {
    return cloned;
  }

  const visit = (node: JsonValue): JsonValue => {
    if (Array.isArray(node)) {
      return node.map(visit);
    }

    if (!isJsonObject(node)) {
      return node;
    }

    const normalizedEntries = Object.entries(node).map(([key, value]) => [key, visit(value)] as const);
    const normalizedNode = Object.fromEntries(normalizedEntries) as JsonObject;
    const allOf = normalizedNode.allOf;

    if (Array.isArray(allOf) && allOf.length === 2) {
      const [first, second] = allOf;

      if (
        isJsonObject(first) &&
        first.$ref === "#/components/schemas/SuccessResponse" &&
        isJsonObject(second) &&
        second.type === "object"
      ) {
        const merged: JsonObject = {
          ...successResponseSchema,
          ...second,
          properties: {
            ...(isJsonObject(successResponseSchema.properties) ? successResponseSchema.properties : {}),
            ...(isJsonObject(second.properties) ? second.properties : {})
          }
        };

        const required = mergeRequired(successResponseSchema.required, second.required);
        if (required) {
          merged.required = required;
        }

        delete merged.allOf;
        return merged;
      }
    }

    return normalizedNode;
  };

  return visit(cloned) as JsonObject;
};

const asPathKey = (routePath: string[]): string => routePath.join("/");

const getPathFromItem = (item: PostmanItem): string[] | undefined => {
  if (!item.request?.url?.path || item.request.url.path.length === 0) {
    return undefined;
  }
  return item.request.url.path;
};

const flattenRequests = (items: PostmanItem[]): PostmanItem[] => {
  const result: PostmanItem[] = [];

  for (const item of items) {
    if (item.request) {
      result.push(item);
      continue;
    }

    if (item.item && item.item.length > 0) {
      result.push(...flattenRequests(item.item));
    }
  }

  return result;
};

const ensureCollectionVariable = (collection: PostmanCollection, key: string, value = ""): void => {
  const variables = Array.isArray(collection.variable) ? collection.variable : [];
  const existingVariable = variables.find(
    (variable) => typeof variable === "object" && variable !== null && (variable as { key?: unknown }).key === key
  ) as { key?: string; value?: string; type?: string } | undefined;

  if (existingVariable) {
    existingVariable.value = value;
    existingVariable.type = existingVariable.type || "string";
  } else {
    variables.push({ key, value, type: "string" });
  }

  collection.variable = variables;
};

const normalizeWorkspaceHeaderValue = (item: PostmanItem): void => {
  const headers = item.request?.header;
  if (Array.isArray(headers)) {
    for (const header of headers) {
      if (!header.key) {
        continue;
      }

      if (header.key.toLowerCase() === "x-workspace-id") {
        header.value = "{{x_workspace_id}}";
      }
    }
  }

  if (item.item && item.item.length > 0) {
    for (const nestedItem of item.item) {
      normalizeWorkspaceHeaderValue(nestedItem);
    }
  }
};

const addLoginTestScript = (item: PostmanItem): void => {
  const routePath = getPathFromItem(item);
  if (!routePath || routePath.join("/") !== "login" || item.request?.method !== "POST") {
    return;
  }

  const exec = [
    'pm.test("Login response has data", function () {',
    '  pm.response.to.have.status(200);',
    '  const json = pm.response.json();',
    '  pm.expect(json).to.have.property("data");',
    '});',
    "",
    "const json = pm.response.json();",
    "const accessToken = json?.data?.session?.access_token;",
    "if (accessToken) {",
    '  pm.collectionVariables.set("bearerToken", accessToken);',
    '  pm.environment.set("bearerToken", accessToken);',
    '  console.log("Saved bearerToken from login response");',
    "}",
    "",
    "const workspaceId = json?.data?.workspaces?.[0]?.workspace?.uuid || json?.data?.workspaces?.[0]?.workspaceId;",
    "if (workspaceId) {",
    '  pm.collectionVariables.set("x_workspace_id", workspaceId);',
    '  pm.environment.set("x_workspace_id", workspaceId);',
    '  console.log("Saved x_workspace_id from first workspace");',
    "}"
  ];

  const events = Array.isArray(item.event) ? [...item.event] : [];
  const nonTestEvents = events.filter((event) => event.listen !== "test");
  nonTestEvents.push({
    listen: "test",
    script: {
      type: "text/javascript",
      exec
    }
  });
  item.event = nonTestEvents;
};

const getAdminGroupName = (routePath: string[]): string | undefined => {
  if (routePath.length < 2 || routePath[0] !== "admin") {
    return undefined;
  }

  return routePath[1];
};

const slugify = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const buildCollection = (base: PostmanCollection, name: string, items: PostmanItem[]): PostmanCollection => ({
  info: {
    ...base.info,
    name
  },
  item: items,
  variable: base.variable,
  event: base.event,
  auth: base.auth
});

const run = async (): Promise<void> => {
  const workspaceRoot = process.cwd();
  const outputDir = path.join(workspaceRoot, "docs", "generated");
  const openApiPath = path.join(outputDir, "openapi.json");
  const postmanPath = path.join(outputDir, "postman-collection.json");
  const splitRootDir = path.join(outputDir, "postman-split");
  const splitAdminDir = path.join(splitRootDir, "admin");

  const { generateOpenAPIDocument } = await import("../src/docs/openapi.ts");
  const { convert } = await import("openapi-to-postmanv2");

  const openApiDocument = generateOpenAPIDocument();
  const normalizedOpenApiDocument = flattenSuccessResponseAllOf(openApiDocument as unknown as JsonObject);

  await mkdir(outputDir, { recursive: true });
  await writeFile(openApiPath, JSON.stringify(openApiDocument, null, 2), "utf8");

  const conversion = await new Promise<ConvertResult>((resolve, reject) => {
    convert(
      { type: "json", data: JSON.stringify(normalizedOpenApiDocument) },
      {
        folderStrategy: "Tags",
        includeAuthInfoInExample: true
      },
      (error: ConvertError | null, result?: ConvertResult) => {
        if (error) {
          reject(new Error(error.message));
          return;
        }

        if (!result) {
          reject(new Error("Postman conversion returned no result"));
          return;
        }

        resolve(result);
      }
    );
  });

  if (!conversion.result || !conversion.output || conversion.output.length === 0) {
    throw new Error(conversion.reason || "Failed to convert OpenAPI to Postman collection");
  }

  const firstOutput = conversion.output[0];
  if (!firstOutput) {
    throw new Error("Postman conversion returned empty output");
  }

  const baseCollection = firstOutput.data as PostmanCollection;

  ensureCollectionVariable(baseCollection, "bearerToken", "");
  ensureCollectionVariable(baseCollection, "x_workspace_id", "");

  for (const item of baseCollection.item || []) {
    normalizeWorkspaceHeaderValue(item);
  }

  const loginCandidates = flattenRequests(baseCollection.item || []);
  for (const requestItem of loginCandidates) {
    addLoginTestScript(requestItem);
  }

  await writeFile(postmanPath, JSON.stringify(baseCollection, null, 2), "utf8");

  const flatRequests = flattenRequests(baseCollection.item || []);
  const adminGroups = new Map<string, PostmanItem[]>();

  for (const requestItem of flatRequests) {
    const routePath = getPathFromItem(requestItem);
    if (!routePath) {
      continue;
    }

    const groupName = getAdminGroupName(routePath);
    if (!groupName) {
      continue;
    }

    const existing = adminGroups.get(groupName);
    if (existing) {
      existing.push(requestItem);
    } else {
      adminGroups.set(groupName, [requestItem]);
    }
  }

  await mkdir(splitAdminDir, { recursive: true });

  const sortedGroupNames = [...adminGroups.keys()].sort((a, b) => a.localeCompare(b));
  const splitIndex: Array<{ group: string; requestCount: number; file: string }> = [];
  const adminFolderItems: PostmanItem[] = [];

  for (const groupName of sortedGroupNames) {
    const groupItems = adminGroups.get(groupName) || [];
    groupItems.sort((a, b) => {
      const pathA = getPathFromItem(a);
      const pathB = getPathFromItem(b);
      if (!pathA || !pathB) {
        return 0;
      }
      return asPathKey(pathA).localeCompare(asPathKey(pathB));
    });

    const fileName = `admin-${slugify(groupName)}.postman-collection.json`;
    const filePath = path.join(splitAdminDir, fileName);
    const titleGroupName = groupName
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");

    const groupCollection = buildCollection(
      baseCollection,
      `${baseCollection.info.name} - Admin ${titleGroupName}`,
      groupItems
    );
    await writeFile(filePath, JSON.stringify(groupCollection, null, 2), "utf8");

    splitIndex.push({ group: groupName, requestCount: groupItems.length, file: `admin/${fileName}` });
    adminFolderItems.push({ name: titleGroupName, item: groupItems });
  }

  const adminGroupedCollection = buildCollection(
    baseCollection,
    `${baseCollection.info.name} - Admin (Grouped)`,
    adminFolderItems
  );

  await writeFile(
    path.join(splitAdminDir, "admin-grouped.postman-collection.json"),
    JSON.stringify(adminGroupedCollection, null, 2),
    "utf8"
  );

  await writeFile(path.join(splitRootDir, "index.json"), JSON.stringify(splitIndex, null, 2), "utf8");

  console.log(`OpenAPI written to ${openApiPath}`);
  console.log(`Postman collection written to ${postmanPath}`);
  console.log(`Split admin collections written to ${splitAdminDir}`);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
