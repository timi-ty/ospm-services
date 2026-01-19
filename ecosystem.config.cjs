module.exports = {
  apps: [
    {
      name: "data-service",
      cwd: "./data-service",
      script: "./venv/bin/uvicorn",
      args: "main:app --host 0.0.0.0 --port 8000",
      interpreter: "none",
      env: {
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        LOG_LEVEL: "INFO",
      },
    },
    {
      name: "oracle",
      cwd: "./oracle",
      script: "npm",
      args: "start",
      env: {
        NODE_ENV: "production",
        PORT: 3001,
        DATABASE_URL: process.env.DATABASE_URL,
        DATA_SERVICE_URL: "http://localhost:8000",
      },
    },
  ],
};
