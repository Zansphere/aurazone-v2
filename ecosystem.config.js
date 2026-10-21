module.exports = {
  apps: [
    {
      name: "aurazone-api",
      cwd: "/var/www/aurazone-v2",
      script: "pnpm",
      args: "--filter @aurazone/api start",
      env: {
        NODE_ENV: "production",
      },
      max_restarts: 10,
      restart_delay: 5000,
    },
    {
      name: "aurazone-admin",
      cwd: "/var/www/aurazone-v2",
      script: "pnpm",
      args: "--filter @aurazone/admin start",
      env: {
        NODE_ENV: "production",
      },
      max_restarts: 10,
      restart_delay: 5000,
    },
    {
      name: "aurazone-customer",
      cwd: "/var/www/aurazone-v2",
      script: "pnpm",
      args: "--filter @aurazone/customer start",
      env: {
        NODE_ENV: "production",
      },
      max_restarts: 10,
      restart_delay: 5000,
    },
  ],
};
