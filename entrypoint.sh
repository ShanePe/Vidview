#!/bin/sh
set -eu

if [ -z "${BASE_VIDEO_FOLDER:-}" ]; then
  echo "ERROR: BASE_VIDEO_FOLDER is not set." >&2
  echo "Set BASE_VIDEO_FOLDER in your environment or docker-compose .env file." >&2
  exit 1
fi

if [ ! -d "${BASE_VIDEO_FOLDER}" ]; then
  echo "WARNING: BASE_VIDEO_FOLDER does not exist or is not accessible: ${BASE_VIDEO_FOLDER}" >&2
fi

: "${PORT:=3000}"
export PORT

echo "Starting vid-view"
echo "BASE_VIDEO_FOLDER=${BASE_VIDEO_FOLDER}"
echo "PORT=${PORT}"

if [ "$#" -eq 0 ]; then
  set -- node server.js
fi

exec "$@"
