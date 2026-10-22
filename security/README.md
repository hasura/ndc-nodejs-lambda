# TLS trust source

The runtime uses Node's `--use-openssl-ca` and the OS certificate bundle, with a build-time minimum fixed `ca-certificates` version. This avoids treating an OS update as a fix for Node's separate bundled roots.

The incident advisory lists Node 24.22.1 as fixed. The image now requires Node 24.22.1 or newer on the 24.x line. Native Node TypeScript stripping is disabled so function loading continues through the existing ts-node compiler, including TypeScript syntax that Node cannot strip. The OS-store selection is retained as defense in depth, not as a substitute for patched Node. Removing affected roots can also reject otherwise legitimate certificates chaining to those roots.

The TypeScript SDK, the separately published `@hasura/ndc-lambda-sdk`, and generated/function project locks must also be refreshed before release. A source update in the lambda SDK does not change already-published lambda SDK versions or existing connector projects.

Deployment overrides of `NODE_OPTIONS`, `SSL_CERT_FILE`, `SSL_CERT_DIR`, `NODE_EXTRA_CA_CERTS`, or application-specific `ca`/custom TLS verification can change this behavior. Preserve `--use-openssl-ca` when adding Node options and audit custom CA settings. The default environment does not prevent a user from overriding trust policy.

Before release: build without stale package layers, confirm the installed CA package version, smoke-test normal connector requests and all 12 incident TLS chains, and update derived connector images to a new immutable base image tag. Source changes do not update old images or connector definitions automatically.
