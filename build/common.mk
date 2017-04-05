SKIP_SQUASH?=0

build = build/build.sh

ifeq ($(TARGET),fedora)
	OS := fedora
else ifeq ($(TARGET),atomic)
	OS := rhel7-atomic
else ifeq ($(TARGET),rhel7)
	OS := rhel7
else
	OS := centos7
endif

script_env = \
	SKIP_SQUASH="$(SKIP_SQUASH)"                      \
	VERSIONS="$(VERSIONS)"                            \
	OS="$(OS)"                                        \
	NAMESPACE="$(NAMESPACE)"                          \
	BASE_IMAGE_NAME="$(BASE_IMAGE_NAME)"              \
	ONBUILD_IMAGE_NAME="$(ONBUILD_IMAGE_NAME)"        \
	VERSION="$(VERSION)"

.PHONY: build
build: prepare
	$(script_env) $(build)

.PHONY: prepare
prepare:
	npm install
	$(script_env) node build/prepare.js

.PHONY: all
all:
	make rebuild && make test && make build && make onbuild && make tags && make publish

.PHONY: onbuild
onbuild: prepare
	$(script_env) ONBUILD=true $(build)

.PHONY: tags
tags:
	$(script_env) node build/tag.js

.PHONY: publish
publish:
	$(script_env) npm run pub

.PHONY: rebuild
rebuild:
	$(script_env) node build/rebuild.js

.PHONY: test
test: prepare
	$(script_env) TAG_ON_SUCCESS=$(TAG_ON_SUCCESS) TEST_MODE=true $(build)

.PHONY: clean
clean:
	docker rmi -f `docker images |tr -s ' ' | grep -e '${OS}-s2i-nodejs\|${OS}-s2i-nodejs-candidate\|${OS}-nodejs\|<none>' | cut -d' ' -s -f3`
