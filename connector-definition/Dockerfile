FROM ghcr.io/hasura/ndc-nodejs-lambda:v{{VERSION}}

COPY --chown=hasura:hasura package-lock.json package.json /functions/

WORKDIR /functions
RUN --mount=type=cache,target=/home/hasura/.npm,uid=1001,gid=1001 \
    npm ci

COPY --chown=hasura:hasura ./ /functions
