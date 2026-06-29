import { logger } from "./helpers/index.ts";

export const whitelist: RegExp[] = [
  /^https?:\/\/localhost(?::\d+)?$/, // Allow local frontend apps during development.
  /^https?:\/\/127\.0\.0\.1(?::\d+)?$/, // Allow loopback frontend apps during development.
  /^https?:\/\/10\.97\.29\.221(?::\d+)?$/, // Allow specific IP frontend apps during development.
  /^https?:\/\/10\.92\.22\.85(?::\d+)?$/, // Allow specific IP frontend apps during development.
  /^https?:\/\/nhiemvu\.vnptcantho\.com\.vn(?::\d+)?$/,
  /^https?:\/\/([a-z0-9-]+\.)?vnptcantho\.com\.vn(?::\d+)?$/,
  /^https?:\/\/example\.com$/,
  /^https?:\/\/subdomain\.example\.com$/
  // Add more patterns as needed
];

export const corsOptions = {
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-workspace-id", "x-request-id"],
  optionsSuccessStatus: 204,
  origin: function (origin: string | undefined, callback: (a: null | Error, b?: boolean) => void): void {
    // Allows an undefined origin. eg GET requests from the browser or curl requests.
    const isOriginAllowed = origin ? whitelist.some((pattern) => pattern.test(origin)) : true;
    logger.debug(`cors Origin: ${origin}`);

    if (isOriginAllowed) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  }
};
