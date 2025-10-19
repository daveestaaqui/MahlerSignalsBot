FROM node:22-slim
WORKDIR /app
COPY dist dist
COPY .env.example ./
ENV HOST=0.0.0.0 PORT=8787 NODE_ENV=production
EXPOSE 8787
CMD ["node","dist/index.js"]
