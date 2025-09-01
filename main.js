const { app, BrowserWindow, ipcMain, dialog, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

ffmpeg.setFfmpegPath(ffmpegPath);

const VIDEO_ROOT = 'videos';
const THUMBNAIL_ROOT = 'thumbnails';
let videoDataCache = [];
let nextVideoId = 1;

// Create main window
function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
    });

    win.loadFile(path.join(__dirname, 'src', 'dashboard.html'));
}

// Get base path for videos and thumbnails
function getAppPath() {
    let baseDir;

    if (app.isPackaged) {
        // For packaged apps, videos are in extraResources
        baseDir = path.join(process.resourcesPath, '..'); // points to Contents/Resources
    } else {
        // Dev environment
        baseDir = path.join(__dirname, '..');
    }

    const videosDir = path.join(baseDir, VIDEO_ROOT);
    console.log(`[DEBUG] Using videos folder at: ${videosDir}`);
    return baseDir;
}

// Generate thumbnail at 0.1s
function generateThumbnail(videoPath, outputDir) {
    return new Promise((resolve) => {
        const fileName = path.basename(videoPath, path.extname(videoPath)) + '.png';
        const outputPath = path.join(outputDir, fileName);

        if (fs.existsSync(outputPath)) return resolve(outputPath);

        ffmpeg(videoPath)
            .screenshots({
                count: 1,
                timemarks: ['0.1'],
                filename: fileName,
                folder: outputDir,
                size: '320x180',
            })
            .on('end', () => resolve(outputPath))
            .on('error', (err) => {
                console.error('[ERROR] Thumbnail generation failed:', err.message);
                resolve(null);
            });
    });
}

// Scan videos folder and return data
async function getVideosFromDirectory() {
    const basePath = getAppPath();
    const videosPath = path.join(basePath, VIDEO_ROOT);
    const thumbsPath = path.join(basePath, THUMBNAIL_ROOT);

    const videoData = [];
    nextVideoId = 1;

    if (!fs.existsSync(videosPath)) fs.mkdirSync(videosPath, { recursive: true });

    const categories = fs.readdirSync(videosPath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

    for (const category of categories) {
        const categoryPath = path.join(videosPath, category);
        const files = fs.readdirSync(categoryPath);

        for (const file of files) {
            if (!file.endsWith('.mp4')) continue;

            const title = file.split('.')[0].replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            const videoFilePath = path.join(categoryPath, file);

            let thumbnailPath = null;
            try {
                const categoryThumbsDir = path.join(thumbsPath, category);
                fs.mkdirSync(categoryThumbsDir, { recursive: true });
                thumbnailPath = await generateThumbnail(videoFilePath, categoryThumbsDir);
            } catch {}

            videoData.push({
                id: nextVideoId++,
                title,
                description: `A tutorial on ${title.toLowerCase()}`,
                category,
                duration: 0,
                views: 0,
                url: `app://${VIDEO_ROOT}/${category}/${file}`, // use app protocol
                thumbnail: thumbnailPath
                    ? `app://${path.relative(basePath, thumbnailPath).replace(/\\/g, '/')}`
                    : `https://placehold.co/320x180?text=${title.substring(0, 15)}`,
                dateAdded: new Date().toISOString().split('T')[0]
            });
        }
    }

    videoDataCache = videoData;
    return videoData;
}

// Import new video
function importVideoFile(videoDetails) {
    const appBaseDir = getAppPath();
    const targetCategoryFolder = path.join(appBaseDir, VIDEO_ROOT, videoDetails.category);
    if (!fs.existsSync(targetCategoryFolder)) fs.mkdirSync(targetCategoryFolder, { recursive: true });

    const fileName = path.basename(videoDetails.url);
    const destinationPath = path.join(targetCategoryFolder, fileName);

    if (fs.existsSync(destinationPath)) {
        return { success: false, message: `A video with the name "${fileName}" already exists.` };
    }

    try {
        fs.copyFileSync(videoDetails.url, destinationPath);
        return { success: true, message: 'Video added successfully.' };
    } catch (error) {
        return { success: false, message: `Failed to add video: ${error.message}` };
    }
}

// IPC handlers
ipcMain.handle('get-videos', async () => await getVideosFromDirectory());
ipcMain.handle('add-video', (event, videoDetails) => importVideoFile(videoDetails));
ipcMain.handle('show-file-dialog', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'Videos', extensions: ['mp4', 'mov', 'mkv', 'webm'] }]
    });
    return result.filePaths.length > 0 ? result.filePaths[0] : null;
});

// Serve app:// protocol with range support for videos
app.whenReady().then(() => {
    protocol.registerFileProtocol('app', (request, callback) => {
        const urlPath = request.url.replace('app://', '');
        const filePath = path.join(getAppPath(), urlPath);

        if (!fs.existsSync(filePath)) {
            console.error('[ERROR] File not found:', filePath);
            return callback({ error: -6 }); // FILE_NOT_FOUND
        }
        callback({ path: filePath });
    });

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
