.DEFAULT_GOAL := build

RELEASE_VERSION_DEP := ../ndc-lambda-sdk/package.json
RELEASE_VERSION := $(shell jq -r '.version' $(RELEASE_VERSION_DEP))

.PHONY: build
build: dist/connector-definition.tgz

.PHONY: clean
clean:
	rm -rf dist
	rm -f connector-definition.tgz

dist dist/docker dist/build-files:
	mkdir dist
	mkdir dist/docker
	mkdir dist/build-files

dist/docker-compose.yaml: docker-compose.yaml dist
	cp -f docker-compose.yaml dist/

dist/connector-metadata.json: connector-metadata.json dist
	cp -f connector-metadata.json dist/

dist/docker/Dockerfile: docker/Dockerfile dist/docker $(RELEASE_VERSION_DEP)
	cp -f docker/Dockerfile dist/docker/
	sed -i -E 's/\{\{VERSION\}\}/$(RELEASE_VERSION)/g' dist/docker/Dockerfile

dist/docker/.dockerignore: docker/.dockerignore dist/docker
	cp -f docker/.dockerignore dist/docker/

build_files := $(filter-out %/package.json,$(wildcard build-files/*))
dist_build_files := $(patsubst build-files/%,dist/build-files/%,$(build_files))

$(dist_build_files): $(build_files)
	cp -f $(build_files) dist/build-files/

dist/build-files/package.json: build-files/package.json $(RELEASE_VERSION_DEP)
	cp -f build-files/package.json dist/build-files/
	jq '.dependencies["@hasura/ndc-lambda-sdk"] = "$(RELEASE_VERSION)"' dist/build-files/package.json > dist/build-files/package.json.tmp
	mv -f dist/build-files/package.json.tmp dist/build-files/package.json

dist/build-files/package-lock.json: dist/build-files/package.json
	cd dist/build-files && npm install
	rm -rf dist/build-files/node_modules

dist/connector-definition.tgz: dist/connector-metadata.json dist/docker-compose.yaml dist/docker/Dockerfile dist/docker/.dockerignore $(dist_build_files) dist/build-files/package-lock.json
	cd dist && tar -czvf connector-definition.tgz *
