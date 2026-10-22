FROM ubuntu:noble-20260113
ARG CONNECTOR_VERSION

RUN apt-get update && apt-get upgrade -y && apt-get install -y \
    curl \
    bash \
    jq \
    ca-certificates \
    gnupg \
    && dpkg --compare-versions "$(dpkg-query -W -f='${Version}' ca-certificates)" ge 20260816ubuntu0.24.04.1 \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_24.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list \
    && apt-get update \
    && apt-get install -y nodejs \
    && node -e 'if (Number(process.versions.node.split(".")[0]) !== 24) process.exit(1)' \
    && dpkg --compare-versions "$(node --version | sed 's/^v//')" ge 24.22.1 \
    && npm update -g npm \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Patched Node and the OS store are independent trust inputs; retain OS trust selection.
ENV NODE_OPTIONS="--no-experimental-strip-types --use-openssl-ca" \
    SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt \
    SSL_CERT_DIR=/etc/ssl/certs

COPY /docker /scripts
COPY /connector-definition/scripts/upgrade-connector.sh /scripts/upgrade-connector.sh
RUN : "${CONNECTOR_VERSION:?Connector version must be set}"
RUN echo ${CONNECTOR_VERSION} > /scripts/CONNECTOR_VERSION

COPY /functions /functions
RUN /scripts/package-restore.sh

# Explicitly set UID/GID to match the cache mount used in ./connector-definition/Dockerfile
RUN groupadd -g 1001 hasura \
    && useradd -m -s /bin/bash -u 1001 -g hasura hasura \
    && chown -R hasura:hasura /scripts /functions

USER hasura

EXPOSE 8080

HEALTHCHECK --interval=5s --timeout=10s --start-period=1s --retries=3 CMD [ "sh", "-c", "exec curl -f http://localhost:${HASURA_CONNECTOR_PORT:-8080}/health" ]

CMD [ "bash", "/scripts/start.sh" ]
