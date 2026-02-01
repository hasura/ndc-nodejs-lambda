FROM node:20-alpine3.23
ARG CONNECTOR_VERSION

RUN npm update -g npm
RUN apk add bash jq curl

COPY /docker /scripts
COPY /connector-definition/scripts/upgrade-connector.sh /scripts/upgrade-connector.sh
RUN : "${CONNECTOR_VERSION:?Connector version must be set}"
RUN echo ${CONNECTOR_VERSION} > /scripts/CONNECTOR_VERSION

COPY /functions /functions
RUN /scripts/package-restore.sh

EXPOSE 8080

HEALTHCHECK --interval=5s --timeout=10s --start-period=1s --retries=3 CMD [ "sh", "-c", "exec curl -f http://localhost:${HASURA_CONNECTOR_PORT:-8080}/health" ]

CMD [ "bash", "/scripts/start.sh" ]
