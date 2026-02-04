FROM ubuntu:noble-20260113
ARG CONNECTOR_VERSION

RUN apt-get update && apt-get install -y \
    curl \
    bash \
    jq \
    ca-certificates \
    gnupg \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list \
    && apt-get update \
    && apt-get install -y nodejs \
    && npm update -g npm \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

COPY /docker /scripts
COPY /connector-definition/scripts/upgrade-connector.sh /scripts/upgrade-connector.sh
RUN : "${CONNECTOR_VERSION:?Connector version must be set}"
RUN echo ${CONNECTOR_VERSION} > /scripts/CONNECTOR_VERSION

COPY /functions /functions
RUN /scripts/package-restore.sh

# Create non-root user
RUN useradd -m -s /bin/bash -u 1000 hasura \
    && chown -R hasura:hasura /scripts /functions

USER hasura

EXPOSE 8080

HEALTHCHECK --interval=5s --timeout=10s --start-period=1s --retries=3 CMD [ "sh", "-c", "exec curl -f http://localhost:${HASURA_CONNECTOR_PORT:-8080}/health" ]

CMD [ "bash", "/scripts/start.sh" ]
