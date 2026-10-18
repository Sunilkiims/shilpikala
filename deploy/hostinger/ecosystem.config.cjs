// pm2 process definition. Started by deploy.sh; pm2 restarts it if it crashes and after a reboot.
module.exports = {
  apps: [
    {
      name: "shilpikala",
      cwd: "/var/www/shilpikala",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000 -H 127.0.0.1",
      env: { NODE_ENV: "production" },
      max_memory_restart: "1500M",
      autorestart: true,
      time: true,
    },
  ],
};
