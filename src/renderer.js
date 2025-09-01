let videos = [];
let currentFilter = 'all';
let searchQuery = '';

// DOM Elements & Bootstrap Modal Instances
const sidebar = document.getElementById('sidebar');
const menuToggle = document.getElementById('menuToggle');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const videoGrid = document.getElementById('videoGrid');
const allVideosGrid = document.getElementById('allVideosGrid');
const manageVideosTable = document.getElementById('manageVideosTable');
const pageTitle = document.getElementById('pageTitle');

const videoPlayerEl = document.getElementById('videoPlayer');
const videoPlayerModalEl = document.getElementById('videoPlayerModal');
const videoPlayerTitleEl = document.getElementById('videoPlayerTitle');
const videoDetailTitleEl = document.getElementById('videoDetailTitle');
const videoDetailMetaEl = document.getElementById('videoDetailMeta');
const videoDetailDescriptionEl = document.getElementById('videoDetailDescription');

const addVideoModalEl = document.getElementById('addVideoModal');
const addVideoForm = document.getElementById('addVideoForm');
const videoUrlInput = document.getElementById('videoUrlInput');
const browseFileBtn = document.getElementById('browseFileBtn');
const saveVideoBtn = document.getElementById('saveVideoBtn');

const sidebarCategoryFilters = document.querySelector('.category-filters');
const featuredFilterButtonGroup = document.getElementById('filterButtonGroup');
const totalCategoriesEl = document.getElementById('totalCategories');

// Instantiate Bootstrap Modal Objects
const videoPlayerModalInstance = new bootstrap.Modal(videoPlayerModalEl);
const addVideoModalInstance = new bootstrap.Modal(addVideoModalEl);

// Utility Functions
function formatDuration(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

function formatViews(views) {
    if (views >= 1000000) {
        return (views / 1000000).toFixed(1) + 'M';
    } else if (views >= 1000) {
        return (views / 1000).toFixed(1) + 'K';
    }
    return views.toString();
}

function getCategoryDisplayName(category) {
    const categoryMap = {
        'coconut-farm': 'Coconut Farm',
        'bee-farm': 'Bee Farm',
        'vegetable-garden': 'Vegetable Garden',
        'livestock': 'Livestock',
        'aquaculture': 'Aquaculture'
    };
    return categoryMap[category] || category.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function getCategoryColor(category) {
    const colorMap = {
        'coconut-farm': 'success',
        'bee-farm': 'warning',
        'vegetable-garden': 'info',
        'livestock': 'danger',
        'aquaculture': 'primary'
    };
    return colorMap[category] || 'secondary';
}

function getFilteredVideos() {
    return videos.filter(video => {
        const matchesFilter = currentFilter === 'all' || video.category === currentFilter;
        const matchesSearch = searchQuery === '' ||
            video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            video.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            getCategoryDisplayName(video.category).toLowerCase().includes(searchQuery.toLowerCase());
        
        return matchesFilter && matchesSearch;
    });
}

function createVideoCard(video) {
    const categoryColor = getCategoryColor(video.category);
    return `
        <div class="col-lg-4 col-md-6 mb-4">
            <div class="video-card" onclick="openVideoPlayer('${video.url}')">
                <div class="video-thumbnail">
                    <img src="${video.thumbnail}" alt="${video.title}">
                    <div class="play-overlay">
                        <i class="bi bi-play-fill"></i>
                    </div>
                </div>
                <div class="video-info">
                    <div class="video-title">${video.title}</div>
                    <div class="video-meta">
                        <span class="badge bg-${categoryColor} category-badge">
                            ${getCategoryDisplayName(video.category)}
                        </span>
                        <div>
                            <small><i class="bi bi-clock"></i> ${formatDuration(video.duration)}</small>
                            <small class="ms-2"><i class="bi bi-eye"></i> ${formatViews(video.views)}</small>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderVideoGrid() {
    const filteredVideos = getFilteredVideos();
    const container = document.querySelector('.page-section.active #videoGrid, .page-section.active #allVideosGrid');
    
    if (container) {
        if (filteredVideos.length === 0) {
            container.innerHTML = `
                <div class="col-12">
                    <div class="text-center py-5">
                        <i class="bi bi-search display-1 text-muted"></i>
                        <h4 class="mt-3">No videos found</h4>
                        <p class="text-muted">Try adjusting your search or filter criteria</p>
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = filteredVideos.map(createVideoCard).join('');
        }
    }
}

function renderManageTable() {
    const tableBody = document.getElementById('manageVideosTable');
    if (!tableBody) return;

    if (videos.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-4">
                    <i class="bi bi-inbox display-4 text-muted"></i>
                    <div class="mt-2">No videos available</div>
                </td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = videos.map(video => `
        <tr>
            <td>
                <img src="${video.thumbnail}" alt="${video.title}" class="table-thumbnail">
            </td>
            <td>
                <div class="fw-bold">${video.title}</div>
                <small class="text-muted">${video.description.substring(0, 50)}...</small>
            </td>
            <td>
                <span class="badge bg-${getCategoryColor(video.category)}">
                    ${getCategoryDisplayName(video.category)}
                </span>
            </td>
            <td>${formatDuration(video.duration)}</td>
            <td>${formatViews(video.views)}</td>
            <td>${new Date(video.dateAdded).toLocaleDateString()}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary action-btn" onclick="editVideo(${video.id})">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-success action-btn" onclick="openVideoPlayer('${video.url}')">
                    <i class="bi bi-play"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger action-btn" onclick="deleteVideo(${video.id})">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function updateStats() {
    const uniqueCategories = new Set(videos.map(v => v.category)).size;
    document.getElementById('totalVideos').textContent = videos.length;
    document.getElementById('totalViews').textContent = formatViews(videos.reduce((sum, video) => sum + video.views, 0));
    totalCategoriesEl.textContent = uniqueCategories;
    document.getElementById('totalDuration').textContent = Math.round(videos.reduce((sum, video) => sum + video.duration, 0) / 60);
}

function showSection(sectionName) {
    document.querySelectorAll('.page-section').forEach(section => {
        section.classList.remove('active');
    });
    const targetSection = document.getElementById(sectionName + 'Section');
    if (targetSection) {
        targetSection.classList.add('active');
    }
    document.querySelectorAll('.sidebar .nav-link').forEach(link => {
        link.classList.remove('active');
    });
    const activeLink = document.querySelector(`[data-section="${sectionName}"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }
    const titles = {
        'dashboard': 'Dashboard',
        'videos': 'All Videos',
        'manage': 'Manage Videos',
        'analytics': 'Analytics'
    };
    pageTitle.textContent = titles[sectionName] || 'Dashboard';
    if (sectionName === 'dashboard' || sectionName === 'videos') {
        renderVideoGrid();
    } else if (sectionName === 'manage') {
        renderManageTable();
    }
    updateStats();
}

function openVideoPlayer(videoUrl) {
    const video = videos.find(v => v.url === videoUrl);
    if (!video) return;

    videoPlayerTitleEl.textContent = video.title;
    videoDetailTitleEl.textContent = video.title;
    videoDetailMetaEl.textContent = `${getCategoryDisplayName(video.category)} • ${formatDuration(video.duration)} • ${formatViews(video.views)} views`;
    videoDetailDescriptionEl.textContent = video.description;
    
    // Fix: use file:// path for external videos
    let srcPath = video.url;
    if (!srcPath.startsWith('file://')) {
        // convert Windows path to file:// URL
        srcPath = `file:///${srcPath.replace(/\\/g, '/')}`;
    }

    console.log(`[DEBUG - Renderer] Setting video source to: ${srcPath}`);
    videoPlayerEl.src = srcPath;
    videoPlayerEl.load();
    videoPlayerEl.play().catch(err => console.error(err));

    video.views++;
    updateStats();
    renderVideoGrid();
    renderManageTable();
    
    videoPlayerModalInstance.show();
}


async function handleAddVideo() {
    const title = document.getElementById('videoTitle').value;
    const description = document.getElementById('videoDescription').value;
    const category = document.getElementById('videoCategory').value;
    const duration = document.getElementById('videoDuration').value;
    const videoUrl = document.getElementById('videoUrlInput').value;
    const thumbnail = document.getElementById('videoThumbnail').value;

    if (!title || !description || !category || !duration || !videoUrl || !thumbnail) {
        showNotification('Please fill in all fields.', 'warning');
        return;
    }

    const videoDetails = { title, description, category, duration, url: videoUrl, thumbnail };
    const response = await window.electronAPI.addVideo(videoDetails);

    if (response.success) {
        addVideoModalInstance.hide();
        showNotification(response.message, 'success');
        await fetchVideoData();
    } else {
        showNotification(response.message, 'danger');
    }
}

async function fetchVideoData() {
    try {
        const videoData = await window.electronAPI.getVideos();
        videos = videoData;
        
        const categories = [...new Set(videos.map(v => v.category))];
        
        sidebarCategoryFilters.innerHTML = '';
        featuredFilterButtonGroup.innerHTML = '';

        sidebarCategoryFilters.innerHTML += `
            <div class="form-check mb-2">
                <input class="form-check-input" type="checkbox" value="all" id="catAll" checked>
                <label class="form-check-label text-white-50" for="catAll">All Categories</label>
            </div>
        `;
        featuredFilterButtonGroup.innerHTML += `<button type="button" class="btn btn-outline-primary filter-btn active" data-filter="all">All</button>`;
        
        categories.forEach(category => {
            const displayName = getCategoryDisplayName(category);
            const htmlSafeCategory = category.replace(/ /g, '-');

            sidebarCategoryFilters.innerHTML += `
                <div class="form-check mb-2">
                    <input class="form-check-input" type="checkbox" value="${htmlSafeCategory}" id="cat${htmlSafeCategory}">
                    <label class="form-check-label text-white-50" for="cat${htmlSafeCategory}">${displayName}</label>
                </div>
            `;

            featuredFilterButtonGroup.innerHTML += `<button type="button" class="btn btn-outline-primary filter-btn" data-filter="${htmlSafeCategory}">${displayName}</button>`;
        });

        const videoCategorySelect = document.getElementById('videoCategory');
        videoCategorySelect.innerHTML = '<option value="">Select Category</option>';
        categories.forEach(category => {
            const displayName = getCategoryDisplayName(category);
            const option = document.createElement('option');
            option.value = category;
            option.textContent = displayName;
            videoCategorySelect.appendChild(option);
        });

        document.querySelectorAll('.category-filters input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                if (checkbox.value === 'all') {
                    if (checkbox.checked) {
                        document.querySelectorAll('.category-filters input[type="checkbox"]:not([value="all"])').forEach(cb => {
                            cb.checked = false;
                        });
                        currentFilter = 'all';
                    } else {
                        const checkedCount = document.querySelectorAll('.category-filters input[type="checkbox"]:checked').length;
                        if (checkedCount === 0) {
                            checkbox.checked = true;
                        }
                    }
                } else {
                    document.getElementById('catAll').checked = false;
                }
                
                const checkedCategories = Array.from(document.querySelectorAll('.category-filters input[type="checkbox"]:checked:not([value="all"])'));
                if (checkedCategories.length === 1) {
                    currentFilter = checkedCategories[0].value;
                } else {
                    currentFilter = 'all';
                }
                renderVideoGrid();
            });
        });

        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                currentFilter = this.getAttribute('data-filter');
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                renderVideoGrid();
            });
        });

        updateStats();
        showSection('dashboard');
    } catch (error) {
        console.error("Failed to load video data:", error);
    }
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    notification.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

document.addEventListener('DOMContentLoaded', function() {
    fetchVideoData();

    document.querySelectorAll('[data-section]').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const section = this.getAttribute('data-section');
            showSection(section);
            
            if (window.innerWidth < 992) {
                sidebar.classList.remove('show');
            }
        });
    });

    menuToggle.addEventListener('click', function() {
        sidebar.classList.toggle('show');
    });

    document.addEventListener('click', function(e) {
        if (window.innerWidth < 992 && 
            !sidebar.contains(e.target) && 
            !menuToggle.contains(e.target)) {
            sidebar.classList.remove('show');
        }
    });

    searchInput.addEventListener('input', () => {
        searchQuery = searchInput.value.trim();
        renderVideoGrid();
    });
    searchBtn.addEventListener('click', () => {
        searchQuery = searchInput.value.trim();
        renderVideoGrid();
    });

    browseFileBtn.addEventListener('click', async () => {
        const filePath = await window.electronAPI.showFileDialog();
        if (filePath) {
            videoUrlInput.value = filePath;
        }
    });
    
    saveVideoBtn.addEventListener('click', handleAddVideo);

    addVideoModalEl.addEventListener('hidden.bs.modal', function() {
        addVideoForm.reset();
        document.querySelector('#addVideoModal .modal-title').textContent = 'Add New Video';
        saveVideoBtn.innerHTML = '<i class="bi bi-save"></i> Save Video';
        saveVideoBtn.onclick = handleAddVideo;
    });

    window.addEventListener('resize', function() {
        if (window.innerWidth >= 992) {
            sidebar.classList.remove('show');
        }
    });
});