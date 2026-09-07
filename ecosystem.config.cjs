// pm2 ecosystem — VPS deploy via `pm2 start ecosystem.config.cjs`
// Requires Node 24+ (native TS via --experimental-transform-types, .ts extensions)
// Deploy: git pull && pnpm install --prod --frozen-lockfile && pm2 restart zakkir --update-env
module.exports = {
  apps: [
    {
      name: "zakkir",
      script: "./src/index.ts",
      interpreter: "node",
      interpreter_args: "--experimental-transform-types --env-file=.env",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "350M",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
