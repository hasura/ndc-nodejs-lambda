.DEFAULT_GOAL := build
SHELL = /usr/bin/env bash

RELEASE_VERSION_DEP := ../ndc-lambda-sdk/package.json
RELEASE_VERSION := $(shell jq -r '.version' $(RELEASE_VERSION_DEP))

.PHONY: build
build: dist/connector-definition.tgz

.PHONY: clean
clean:
	rm -rf dist
	rm -f connector-definition.tgz

dist dist/.hasura-connector:
	mkdir dist
	mkdir dist/.hasura-connector

dist/.hasura-connector/connector-metadata.yaml: connector-metadata.yaml dist
	cp -f connector-metadata.yaml dist/.hasura-connector

dist/.hasura-connector/Dockerfile: Dockerfile dist/.hasura-connector $(RELEASE_VERSION_DEP)
	cp -f Dockerfile dist/.hasura-connector/
	sed -i -E 's/\{\{VERSION\}\}/$(RELEASE_VERSION)/g' dist/.hasura-connector/Dockerfile

dist/.hasura-connector/.dockerignore: .dockerignore dist/.hasura-connector
	cp -f .dockerignore dist/.hasura-connector/

template_files := $(filter-out %/package.json,$(wildcard template/*))
dist_template_files := $(patsubst template/%,dist/%,$(template_files))

$(dist_template_files): $(template_files)
	cp -f $(template_files) dist/

dist/package.json: template/package.json $(RELEASE_VERSION_DEP)
	cp -f template/package.json dist/
	jq '.dependencies["@hasura/ndc-lambda-sdk"] = "$(RELEASE_VERSION)"' dist/package.json > dist/package.json.tmp
	mv -f dist/package.json.tmp dist/package.json

dist/package-lock.json: dist/package.json
	cd dist && npm install
	rm -rf dist/node_modules

dist/connector-definition.tgz: dist/.hasura-connector/connector-metadata.yaml dist/.hasura-connector/Dockerfile dist/.hasura-connector/.dockerignore $(dist_template_files) dist/package-lock.json
	shopt -s dotglob && cd dist && tar -czvf connector-definition.tgz *
