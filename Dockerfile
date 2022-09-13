FROM node:lts-alpine
RUN apk add dumb-init
ENV NODE_ENV=production
WORKDIR /usr/src/app

COPY package.json ./
COPY yarn.lock ./
RUN yarn install --ignore-scripts --cache-folder /tmp/.ycache; rm -rf /tmp/.ycache

COPY --chown=node src .
USER node

EXPOSE 3001
CMD ["dumb-init", "node", "--loader", "@esbuild-kit/esm-loader", "index.ts"]
