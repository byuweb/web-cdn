#!/bin/sh

echo "=========== Building assembler ==========="

tag=$ENV
if [ $ENV = "beta" ]; then
  tag=stg
fi

set -e

echo Logging into ECR
$(aws ecr get-login --no-include-email --region $AWS_REGION)

image="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/web-community-cdn-assembler:$tag"

echo Pulling current image. Maybe the cache will work?
docker pull $image || true

echo Building Docker Image

docker build . -t $image --cache-from $image

echo "Run Tests"

docker run --rm -i $image /bin/sh -c 'cd $ASSEMBLER_HOME; yarn install; yarn test'

echo Pushing image as $image

docker push $image

