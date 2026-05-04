const fs = require("node:fs/promises");
const path = require("node:path");
const express = require("express");
const packageJson = require("./package.json");
require("dotenv").config();

const app = express();

const VIDEO_EXTENSIONS = new Set([
    ".mp4",
    ".mov",
    ".mkv",
    ".avi",
    ".webm",
    ".m4v",
    ".wmv",
    ".flv"
]);

const VIDEO_MIME_TYPES = {
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".mkv": "video/x-matroska",
    ".avi": "video/x-msvideo",
    ".webm": "video/webm",
    ".m4v": "video/x-m4v",
    ".wmv": "video/x-ms-wmv",
    ".flv": "video/x-flv"
};

const configuredBase = process.env.BASE_VIDEO_FOLDER;
if (!configuredBase) {
    throw new Error("Missing BASE_VIDEO_FOLDER in environment configuration.");
}

const baseFolder = path.resolve(configuredBase);
const port = Number.parseInt(process.env.PORT || "3000", 10);
const appVersion = process.env.APP_BUILD_VERSION || packageJson.version || "unknown";

function writeLog(level, message, details = {}) {
    const timestamp = new Date().toISOString();
    const payload = {
        timestamp,
        level,
        app: "vid-view",
        version: appVersion,
        message,
        ...details
    };

    const serialized = JSON.stringify(payload);

    if (level === "error") {
        console.error(serialized);
        return;
    }

    if (level === "warn") {
        console.warn(serialized);
        return;
    }

    console.log(serialized);
}

function isVideoFile(fileName) {
    return VIDEO_EXTENSIONS.has(path.extname(fileName).toLowerCase());
}

function getVideoMimeType(fileName) {
    return VIDEO_MIME_TYPES[path.extname(fileName).toLowerCase()] || "video/mp4";
}

function toRelative(absolutePath) {
    return path.relative(baseFolder, absolutePath).replace(/\\\\/g, "/");
}

function resolveInsideBase(relativeInput) {
    const safeRelative = relativeInput ? relativeInput.replace(/\//g, path.sep) : "";
    const fullPath = path.resolve(baseFolder, safeRelative);

    if (fullPath !== baseFolder && !fullPath.startsWith(baseFolder + path.sep)) {
        throw new Error("Invalid path outside base folder.");
    }

    return fullPath;
}

async function buildFolderTree(absoluteFolder) {
    const entries = await fs.readdir(absoluteFolder, { withFileTypes: true });
    const subfolders = [];
    const videos = [];

    for (const entry of entries) {
        if (entry.isDirectory()) {
            subfolders.push(entry);
            continue;
        }

        if (entry.isFile() && isVideoFile(entry.name)) {
            videos.push(entry.name);
        }
    }

    const childNodes = [];
    let descendantsWithVideos = 0;

    for (const folderEntry of subfolders.sort((a, b) => a.name.localeCompare(b.name))) {
        const childAbsolute = path.join(absoluteFolder, folderEntry.name);
        const childNode = await buildFolderTree(childAbsolute);

        descendantsWithVideos += childNode.totalFoldersWithVideos;
        childNodes.push(childNode.node);
    }

    const relativeFolder = toRelative(absoluteFolder);
    const folderHasVideos = videos.length > 0;
    const totalFoldersWithVideos = descendantsWithVideos + (folderHasVideos ? 1 : 0);

    return {
        totalFoldersWithVideos,
        node: {
            name: relativeFolder === "" ? path.basename(baseFolder) || baseFolder : path.basename(absoluteFolder),
            path: relativeFolder,
            hasVideos: folderHasVideos,
            videoCount: videos.length,
            children: childNodes
        }
    };
}

async function getVideosForFolder(relativeFolder) {
    const absoluteFolder = resolveInsideBase(relativeFolder || "");
    const stat = await fs.stat(absoluteFolder);

    if (!stat.isDirectory()) {
        throw new Error("Target is not a folder.");
    }

    const entries = await fs.readdir(absoluteFolder, { withFileTypes: true });
    return entries
        .filter((entry) => entry.isFile() && isVideoFile(entry.name))
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b));
}

app.use("/vendor/plyr", express.static(path.join(__dirname, "node_modules/plyr/dist")));
app.use((req, res, next) => {
    const startedAt = process.hrtime.bigint();

    res.on("finish", () => {
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
        const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";

        writeLog(level, "HTTP request completed", {
            method: req.method,
            path: req.originalUrl,
            statusCode: res.statusCode,
            durationMs: Number(durationMs.toFixed(2)),
            ip: req.ip
        });
    });

    next();
});
app.use(express.static(path.join(__dirname, "public")));

app.get("/healthcheck", async (_req, res) => {
    try {
        const stat = await fs.stat(baseFolder);
        const healthy = stat.isDirectory();
        const statusCode = healthy ? 200 : 503;

        if (!healthy) {
            writeLog("warn", "Healthcheck failed because base folder is not a directory", {
                baseFolder
            });
        }

        return res.status(statusCode).json({
            status: healthy ? "ok" : "error",
            version: appVersion,
            baseFolder,
            checks: {
                baseFolderAccessible: healthy
            }
        });
    } catch (error) {
        writeLog("warn", "Healthcheck failed", {
            baseFolder,
            error: error.message
        });

        return res.status(503).json({
            status: "error",
            version: appVersion,
            baseFolder,
            checks: {
                baseFolderAccessible: false
            },
            error: error.message
        });
    }
});

app.get("/api/config", async (_req, res) => {
    try {
        const stat = await fs.stat(baseFolder);
        if (!stat.isDirectory()) {
            writeLog("error", "Configured base path is not a directory", { baseFolder });
            return res.status(500).json({ error: "Configured base path is not a directory." });
        }

        return res.json({
            baseFolder,
            rootName: path.basename(baseFolder) || baseFolder
        });
    } catch (error) {
        writeLog("error", "Failed to access configured base folder", {
            baseFolder,
            error: error.message
        });
        return res.status(500).json({ error: `Cannot access base folder: ${error.message}` });
    }
});

app.get("/api/folders", async (_req, res) => {
    try {
        const tree = await buildFolderTree(baseFolder);
        return res.json(tree.node);
    } catch (error) {
        writeLog("error", "Failed to scan folder tree", {
            baseFolder,
            error: error.message
        });
        return res.status(500).json({ error: `Failed to scan folders: ${error.message}` });
    }
});

app.get("/api/videos", async (req, res) => {
    try {
        const folder = typeof req.query.folder === "string" ? req.query.folder : "";
        const videos = await getVideosForFolder(folder);

        return res.json({
            folder,
            videos: videos.map((fileName) => ({
                fileName,
                mimeType: getVideoMimeType(fileName),
                url: `/api/video?folder=${encodeURIComponent(folder)}&file=${encodeURIComponent(fileName)}`
            }))
        });
    } catch (error) {
        writeLog("warn", "Failed to load videos for folder", {
            folder: typeof req.query.folder === "string" ? req.query.folder : "",
            error: error.message
        });
        return res.status(400).json({ error: `Failed to load videos: ${error.message}` });
    }
});

app.get("/api/video", async (req, res) => {
    try {
        const folder = typeof req.query.folder === "string" ? req.query.folder : "";
        const fileName = typeof req.query.file === "string" ? req.query.file : "";

        if (!fileName || path.basename(fileName) !== fileName || !isVideoFile(fileName)) {
            writeLog("warn", "Rejected invalid video filename", {
                folder,
                fileName
            });
            return res.status(400).json({ error: "Invalid video filename." });
        }

        const folderPath = resolveInsideBase(folder);
        const fullPath = resolveInsideBase(path.join(folder, fileName));

        const folderStat = await fs.stat(folderPath);
        if (!folderStat.isDirectory()) {
            return res.status(400).json({ error: "Invalid folder." });
        }

        await fs.access(fullPath);
        return res.sendFile(fullPath);
    } catch (error) {
        writeLog("warn", "Cannot stream requested video", {
            folder: typeof req.query.folder === "string" ? req.query.folder : "",
            fileName: typeof req.query.file === "string" ? req.query.file : "",
            error: error.message
        });
        return res.status(404).json({ error: `Cannot stream video: ${error.message}` });
    }
});

process.on("unhandledRejection", (reason) => {
    writeLog("error", "Unhandled promise rejection", {
        error: reason instanceof Error ? reason.message : String(reason)
    });
});

process.on("uncaughtException", (error) => {
    writeLog("error", "Uncaught exception", {
        error: error.message
    });
});

app.listen(port, () => {
    writeLog("info", "Server started", {
        url: `http://localhost:${port}`,
        baseFolder,
        nodeEnv: process.env.NODE_ENV || "development"
    });
});
