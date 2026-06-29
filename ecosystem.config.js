const path = require("path");

const rootDir = __dirname;

module.exports = {
  apps: [
    {
      name: "gis-asxh-be",
      cwd: path.join(rootDir, "BE"),
      script: "dist/server.mjs",
      interpreter: "none",
      env: {
        NODE_ENV: "production",
        PORT: 4000
      },
      autorestart: true,
      max_memory_restart: "1G"
    },
    {
      name: "gis-asxh-fe",
      cwd: path.join(rootDir, "FE"),
      script: "npm",
      args: "run start",
      env: {
        NODE_ENV: "production",
        PORT: 3000
      },
      autorestart: true,
      max_memory_restart: "1G"
    }
  ]
};
