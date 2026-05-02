# Vid View

Vid View is a local video browser for folder-based workflows.

Point it at a base folder, browse subfolders on the left, and play videos from the selected folder in a player carousel.

## What It Does

- Scans a configurable base folder recursively
- Builds a folder tree with per-folder video counts
- Streams video files directly from disk
- Lets you choose a custom starting video in a folder
- Supports Previous and Next navigation (non-looping)
- Auto-plays when moving to another video
- Collapses the left panel when playback starts, with a button to reopen it
- Works on desktop and mobile (including swipe navigation)

## Supported Video Extensions

- .mp4
- .mov
- .mkv
- .avi
- .webm
- .m4v
- .wmv
- .flv

## Configuration

Set environment values in [.env](.env):

BASE_VIDEO_FOLDER=\\Pennicloud\Public\aqara_video
PORT=3000

Notes:

- BASE_VIDEO_FOLDER is required
- PORT defaults to 3000 when not set

## Local Development

Install dependencies:

npm install

Start the app:

npm start

Open:

http://localhost:3000

## Debugging In VS Code

Use the launch profile already created in [.vscode/launch.json](.vscode/launch.json):

- Debug Vid View Server

## API Endpoints

- GET /api/config
  - Returns configured base folder info
- GET /api/folders
  - Returns recursive folder tree with metadata
- GET /api/videos?folder=<relative-folder>
  - Returns videos for a specific folder
- GET /api/video?folder=<relative-folder>&file=<filename>
  - Streams the requested video file

## Security Notes

- Folder and file inputs are constrained to stay inside the configured base directory
- Invalid paths and invalid file names are rejected

## Docker

Build image:

docker build -t vid-view .

Run container:

docker run --rm -p 3000:3000 -e BASE_VIDEO_FOLDER="\\Pennicloud\Public\aqara_video" -e PORT=3000 vid-view

Important on Windows with UNC paths:

- Containers may not be able to read a network UNC path directly
- If that happens, mount a host path into the container and set BASE_VIDEO_FOLDER to the mounted container path

Example with a local/mapped host folder:

docker run --rm -p 3000:3000 -v "C:\video-share:/videos:ro" -e BASE_VIDEO_FOLDER=/videos -e PORT=3000 vid-view

## Docker Compose

Compose file: [docker-compose.yml](docker-compose.yml)

Run:

docker compose up --build

Stop:

docker compose down

## Project Structure

- [server.js](server.js): Express API, folder scanning, secure file serving
- [public/index.html](public/index.html): App markup
- [public/styles.css](public/styles.css): Dark theme and responsive layout
- [public/app.js](public/app.js): Client-side folder tree and player logic
- [Dockerfile](Dockerfile): Container image build
- [docker-compose.yml](docker-compose.yml): Compose service definition

## Troubleshooting

- App says base folder cannot be accessed:
  - Verify BASE_VIDEO_FOLDER path exists and is reachable by the running process
- Docker starts but no videos appear:
  - Check whether the container can access the folder path
  - Prefer bind-mounting a host folder and using that mounted path inside the container
- Port already in use:
  - Change PORT in [.env](.env) and restart
