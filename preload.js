const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getVideos: () => ipcRenderer.invoke('get-videos'),
    addVideo: (videoDetails) => ipcRenderer.invoke('add-video', videoDetails),
    showFileDialog: () => ipcRenderer.invoke('show-file-dialog'),
});