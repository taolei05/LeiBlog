FROM oven/bun:1.4.3

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production --ignore-scripts

COPY --chown=bun:bun src ./src
RUN mkdir -p /data/uploads && chown bun:bun /data/uploads

ENV NODE_ENV=production
ENV UPLOADS_DIR=/data/uploads

USER bun

EXPOSE 3000

CMD ["bun", "run", "start"]
