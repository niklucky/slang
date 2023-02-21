$VERSION=$1


docker image build --tag niklucky/slang:$1 .
docker tag niklucky/slang:$1 niklucky/slang:latest