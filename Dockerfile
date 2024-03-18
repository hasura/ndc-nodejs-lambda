FROM node:20-alpine

RUN apk add jq curl

COPY /docker /scripts

COPY /functions /functions
RUN /scripts/package-restore.sh

EXPOSE 8080

HEALTHCHECK --interval=5s --timeout=10s --start-period=1s --retries=3 CMD [ "sh", "-c", "curl -f http://localhost:${HASURA_CONNECTOR_PORT:-8080}/health" ]

CMD [ "sh", "/scripts/start.sh" ]
