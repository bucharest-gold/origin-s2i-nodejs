BASE_IMAGE_NAME=s2i-nodejs
ONBUILD_IMAGE_NAME=nodejs
NAMESPACE=bucharestgold
VERSIONS=4.8.3 5.12.0 6.10.3 7.10.0
VALID_OS=centos7 fedora
include build/common.mk
