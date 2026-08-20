{
  "apps": [{
    "name": "aamd-support",
    "script": "./dist/index.js",
    "cwd": "/opt/aamd-support",
    "instances": 1,
    "autorestart": true,
    "max_restarts": 10,
    "max_memory_restart": "500M",
    "env": { "NODE_ENV": "production" },
    "error_file": "./logs/pm-error.log",
    "out_file": "./logs/pm-out.log",
    "time": true
  }]
}
