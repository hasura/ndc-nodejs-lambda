FROM ghcr.io/hasura/ndc-nodejs-lambda:v{{VERSION}}

COPY package-lock.json package.json /functions/

WORKDIR /functions
RUN --mount=type=cache,target=/root/.npm \
    npm ci

COPY ./ /functions
