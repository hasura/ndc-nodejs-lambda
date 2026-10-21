# TLS trust source

The runtime uses Node's `--use-openssl-ca` and the OS certificate bundle, with a build-time minimum fixed `ca-certificates` version. This avoids treating an OS update as a fix for Node's separate bundled roots.

Node upstream's eMudhra fix was pending in the incident advisory on 21 October 2026. This is an OS-trust workaround, not a claimed fixed Node version. Removing affected roots can also reject otherwise legitimate certificates chaining to those roots.

Deployment overrides of `NODE_OPTIONS`, `SSL_CERT_FILE`, `SSL_CERT_DIR`, `NODE_EXTRA_CA_CERTS`, or application-specific `ca`/custom TLS verification can change this behavior. Preserve `--use-openssl-ca` when adding Node options and audit custom CA settings. The default environment does not prevent a user from overriding trust policy.

Before release: build without stale package layers, confirm the installed CA package version, smoke-test normal connector requests and all 12 incident TLS chains, and update derived connector images to a new immutable base image tag. Source changes do not update old images or connector definitions automatically.
