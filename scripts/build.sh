#!/bin/sh

# For the different db providers
#docker image build --build-arg dbprovider=$2 --platform linux/amd64 --tag niklucky/slang:$1 .

docker image build --platform linux/amd64 --tag niklucky/slang:$1 .
docker tag niklucky/slang:$1 niklucky/slang:latest

echo "Publishing image to docker:"
docker push niklucky/slang:$1
docker push niklucky/slang:latest 