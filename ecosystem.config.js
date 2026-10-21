module.exports = {
  apps: [
    {
      name: "aurazone-api",
      cwd: "/var/www/aurazone-v2/apps/api",
      script: "dist/index.js",
      env: {
        NODE_ENV: "production",
        PORT: 3102,
      },
      max_restarts: 10,
      restart_delay: 5000,
    },
    {
      name: "aurazone-admin",
      cwd: "/var/www/aurazone-v2/apps/admin/.next/standalone",
      script: "apps/admin/server.js",
      env: {
        NODE_ENV: "production",
        PORT: 3101,
        HOSTNAME: "0.0.0.0",
      },
      max_restarts: 10,
      restart_delay: 5000,
    },
    {
      name: "aurazone-customer",
      cwd: "/var/www/aurazone-v2/apps/customer/.next/standalone",
      script: "apps/customer/server.js",
      env: {
        NODE_ENV: "production",
        PORT: 3100,
        HOSTNAME: "0.0.0.0",
      },
      max_restarts: 10,
      restart_delay: 5000,
    },
  ],
};
