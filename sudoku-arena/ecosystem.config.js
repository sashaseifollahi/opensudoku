module.exports = {
  apps: [
    {
      name: 'sudoku-arena',
      script: 'node_modules/.bin/next',
      args: 'start',
      cwd: '/var/www/sudoku-arena',
      instances: 'max',
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: '/var/log/sudoku-arena/error.log',
      out_file: '/var/log/sudoku-arena/out.log',
      log_file: '/var/log/sudoku-arena/combined.log',
      time: true,
    },
  ],
};
