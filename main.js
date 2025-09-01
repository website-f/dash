const { app, BrowserWindow, protocol, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

ffmpeg.setFfmpegPath(ffmpegPath);

const VIDEO_ROOT = 'videos';
const THUMBNAIL_ROOT = 'thumbnails';
let videoDataCache = [];
let nextVideoId = 1;

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: true,
        },
    });

    win.loadFile(path.join(__dirname, 'src', 'dashboard.html'));
}

function getAppPath() {
    let baseDir = app.isPackaged
        ? path.dirname(process.execPath)
        : path.join(__dirname, '..');

    // Traverse upwards until "videos" folder is found
    let currentDir = baseDir;
    while (currentDir !== path.parse(currentDir).root) {
        if (fs.existsSync(path.join(currentDir, VIDEO_ROOT))) {
            console.log(`[DEBUG] Found videos folder at: ${currentDir}`);
            return currentDir;
        }
        currentDir = path.dirname(currentDir);
    }

    console.error("[ERROR] Could not find videos folder.");
    return baseDir;
}

function generateThumbnail(videoPath, outputDir) {
    return new Promise((resolve, reject) => {
        const fileName = path.basename(videoPath, path.extname(videoPath)) + '.png';
        const outputPath = path.join(outputDir, fileName);

        // Skip if already exists
        if (fs.existsSync(outputPath)) {
            return resolve(outputPath);
        }

        ffmpeg(videoPath)
            .screenshots({
                count: 1,
                timemarks: ['0.1'], // capture at 0.1s
                filename: fileName,
                folder: outputDir,
                size: '320x180'
            })
            .on('end', () => resolve(outputPath))
            .on('error', (err) => {
                console.error('[ERROR] Thumbnail generation failed:', err.message);
                reject(err);
            });
    });
}

async function getVideosFromDirectory() {
    const basePath = getAppPath();
    const videosPath = path.join(basePath, VIDEO_ROOT);
    const thumbsPath = path.join(basePath, THUMBNAIL_ROOT);

    const videoData = [];
    nextVideoId = 1;

    console.log(`[DEBUG] Scanning video directory at: ${videosPath}`);

    if (!fs.existsSync(videosPath)) {
        fs.mkdirSync(videosPath, { recursive: true });
        console.log("[INFO] Created videos folder.");
        return [];
    }

    const categories = fs.readdirSync(videosPath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

    for (const category of categories) {
        const categoryPath = path.join(videosPath, category);
        const files = fs.readdirSync(categoryPath);

        for (const file of files) {
            if (file.endsWith('.mp4')) {
                const title = file.split('.')[0].replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                const videoFilePath = path.join(categoryPath, file);

                let thumbnailPath;
                try {
                    const categoryThumbsDir = path.join(thumbsPath, category);
                    fs.mkdirSync(categoryThumbsDir, { recursive: true });

                    thumbnailPath = await generateThumbnail(videoFilePath, categoryThumbsDir);
                } catch (err) {
                    thumbnailPath = null;
                }

                videoData.push({
                    id: nextVideoId++,
                    title,
                    description: `A tutorial on ${title.toLowerCase()}`,
                    category,
                    duration: 0,
                    views: 0,
                    url: `${VIDEO_ROOT}/${category}/${file}`,
                    thumbnail: thumbnailPath
                        ? `app://${path.relative(basePath, thumbnailPath).replace(/\\/g, '/')}`
                        : `https://placehold.co/320x180?text=${title.substring(0, 15)}`,
                    dateAdded: new Date().toISOString().split('T')[0]
                });

                console.log(`[DEBUG] Found and added video: ${file}`);
            }
        }
    }

    videoDataCache = videoData;
    return videoData;
}

function importVideoFile(videoDetails) {
    const appBaseDir = getAppPath();
    const targetCategoryFolder = path.join(appBaseDir, VIDEO_ROOT, videoDetails.category);

    console.log(`[DEBUG] Importing file from: ${videoDetails.url}`);
    console.log(`[DEBUG] Target category folder: ${targetCategoryFolder}`);

    if (!fs.existsSync(targetCategoryFolder)) {
        fs.mkdirSync(targetCategoryFolder, { recursive: true });
    }

    const originalFilePath = videoDetails.url;
    const fileName = path.basename(originalFilePath);
    const destinationPath = path.join(targetCategoryFolder, fileName);

    if (fs.existsSync(destinationPath)) {
        return { success: false, message: `A video with the name "${fileName}" already exists in this category.` };
    }

    try {
        fs.copyFileSync(originalFilePath, destinationPath);
        console.log(`[INFO] Successfully copied video: ${destinationPath}`);
        return { success: true, message: 'Video added successfully.' };
    } catch (error) {
        console.error(`[ERROR] File copy error: ${error}`);
        return { success: false, message: `Failed to add video: ${error.message}` };
    }
}

// IPC Handlers
ipcMain.handle('get-videos', async () => {
    return await getVideosFromDirectory();
});

ipcMain.handle('add-video', (event, videoDetails) => {
    return importVideoFile(videoDetails);
});

ipcMain.handle('show-file-dialog', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'Videos', extensions: ['mp4', 'mov', 'mkv', 'webm'] }]
    });
    return result.filePaths.length > 0 ? result.filePaths[0] : null;
});

app.whenReady().then(() => {
    protocol.handle('app', async (request) => {
    const urlPath = request.url.replace('app://', '');
    const filePath = path.join(getAppPath(), urlPath);

    try {
        const stat = fs.statSync(filePath);
        const range = request.headers.get('range');

        if (range) {
            // Parse range header: e.g. "bytes=0-1023"
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;

            const chunkSize = (end - start) + 1;
            const stream = fs.createReadStream(filePath, { start, end });

            let contentType = 'application/octet-stream';
            if (filePath.endsWith('.mp4')) contentType = 'video/mp4';
            else if (filePath.endsWith('.png')) contentType = 'image/png';
            else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) contentType = 'image/jpeg';

            return new Response(stream, {
                status: 206, // Partial Content
                headers: {
                    'Content-Range': `bytes ${start}-${end}/${stat.size}`,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': chunkSize,
                    'Content-Type': contentType,
                },
            });
        } else {
            // No range → send full file
            const stream = fs.createReadStream(filePath);
            let contentType = 'application/octet-stream';
            if (filePath.endsWith('.mp4')) contentType = 'video/mp4';
            else if (filePath.endsWith('.png')) contentType = 'image/png';
            else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) contentType = 'image/jpeg';

            return new Response(stream, {
                headers: {
                    'Content-Length': stat.size,
                    'Content-Type': contentType,
                },
            });
        }
    } catch (error) {
        console.error(`[ERROR] Failed to serve file: ${filePath}`, error);
        return new Response('File not found', { status: 404 });
    }
});


    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
