#!/bin/bash

# For the different db providers
# npm pkg get version | tr -d '"'`
# npm pkg get version | sed 's/"//g'

VERSION=$1
DB_PROVIDER=${2:-sqlite}

if [ "$VERSION" = "" ]; then
  echo "You need to provide new version"
  exit 1
fi

V=$VERSION
LATEST=latest

if [ "$DB_PROVIDER" = "postgres" ]; then
  V="$VERSION-$DB_PROVIDER"
  LATEST="$LATEST-$DB_PROVIDER"
fi

echo "Building image version $V ($LATEST), DB: $DB_PROVIDER"

docker image build --build-arg dbprovider=$DB_PROVIDER --platform linux/amd64 --tag niklucky/slang:$V .
docker tag niklucky/slang:$V niklucky/slang:$LATEST

# echo "Publishing image to docker:"
docker push niklucky/slang:$V
docker push niklucky/slang:$LATEST

