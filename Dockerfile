FROM node:20-alpine
ARG CONNECTOR_VERSION

RUN apk add jq curl

COPY /docker /scripts
RUN : "${CONNECTOR_VERSION:?Connector version must be set}"
RUN echo ${CONNECTOR_VERSION} > /scripts/CONNECTOR_VERSION

COPY /functions /functions
RUN /scripts/package-restore.sh

EXPOSE 8080

HEALTHCHECK --interval=5s --timeout=10s --start-period=1s --retries=3 CMD [ "sh", "-c", "exec curl -f http://localhost:${HASURA_CONNECTOR_PORT:-8080}/health" ]

CMD [ "sh", "/scripts/start.sh" ]
