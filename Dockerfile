FROM oven/bun:1

WORKDIR /app

COPY package.json .
COPY bun.lockb* ./

RUN bun install

COPY . .

EXPOSE 3001

CMD ["bun", "run", "src/index.ts"]