import { API_URL, auth, users, posts, comments, follow, notifications, messages } from './api.js';

window.getImageUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('/')) return `${API_URL}${url}`;
  return `${API_URL}/${url}`;
};

// ── State ──────────────────────────────────────────────────────────
const state = {
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  notifInterval: null,
  msgInterval: null
};

// ── DOM Root ───────────────────────────────────────────────────────
const app = document.getElementById('app');

// ── Router ─────────────────────────────────────────────────────────
const routes = {
  '/':              renderHome,
  '/login':         renderLogin,
  '/register':      renderRegister,
  '/profile':       renderProfile,
  '/edit-profile':  renderEditProfile,
  '/explore':       renderExplore,
  '/notifications': renderNotifications,
  '/messages':      renderMessages,
  '/saved':         renderSaved,
  '/hashtag':       renderHashtagFeed,
  '/requests':      renderFollowRequests
};

function navigate(path) {
  window.history.pushState({}, '', path);
  handleRoute();
}
window.addEventListener('popstate', handleRoute);
window.appNavigate = navigate;

async function handleRoute() {
  const path = window.location.pathname;
  clearSocket();
  const token = localStorage.getItem('token');
  const publicPaths = ['/login', '/register'];

  if (!token && !publicPaths.includes(path)) { navigate('/login'); return; }
  if (token && publicPaths.includes(path))   { navigate('/');      return; }

  const renderFn = routes[path] || render404;
  await renderFn();

  if (token) initSocket();
}

// ── Toast ──────────────────────────────────────────────────────────
export function showToast(msg, type = '') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => { t.style.animation = 'toastIn .3s ease reverse'; setTimeout(() => t.remove(), 300); }, 3000);
}
window.showToast = showToast;

// ── WebSockets ───────────────────────────────────────────────────────
let socket = null;

function initSocket() {
  if (socket) return;
  
  // Create socket connection
  socket = io('http://localhost:5000');
  
  socket.on('connect', () => {
    if (state.user && state.user.id) {
      socket.emit('join', state.user.id);
    }
  });

  socket.on('receiveMessage', (msg) => {
    const chatBox = document.querySelector('.chat-box');
    const params = new URLSearchParams(window.location.search);
    const activeUserId = params.get('userId');
    
    if (chatBox && window.location.pathname === '/messages' && activeUserId === msg.senderId) {
      // We are in the active chat with the sender, append message
      chatBox.innerHTML += `<div class="msg received">${esc(msg.content)}</div>`;
      chatBox.scrollTop = chatBox.scrollHeight;
    } else {
      // We are not in the active chat, show dot and toast
      const dot = document.getElementById('msg-dot');
      if (dot) dot.style.display = 'block';
      showToast('New message received!', 'info');
    }
  });

  socket.on('newNotification', () => {
    const dot = document.getElementById('notif-dot');
    if (dot) dot.style.display = 'block';
    showToast('New notification!', 'info');
  });
}

function clearSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

// ── Navbar ─────────────────────────────────────────────────────────
function navbar() {
  const u = state.user;
  const avatarHtml = u?.profilePicture
    ? `<img src="${getImageUrl(u.profilePicture)}" class="nav-avatar" alt="avatar">`
    : `<div class="avatar avatar-sm" style="width:34px;height:34px;">${(u?.fullName||'U').charAt(0)}</div>`;

  return `
  <nav class="navbar">
    <div class="container">
      <a href="/" class="nav-brand" onclick="event.preventDefault();window.appNavigate('/')">ConnectSphere</a>
      <div class="nav-search">
        <i class="ph ph-magnifying-glass search-icon"></i>
        <input type="text" placeholder="Search users…" id="nav-search-input" autocomplete="off">
        <div id="nav-search-results" style="position:absolute;top:110%;left:0;right:0;z-index:300;"></div>
      </div>
      <div class="nav-icons">
        <button class="nav-icon-btn" title="Home" onclick="window.appNavigate('/')"><i class="ph ph-house"></i></button>
        <button class="nav-icon-btn" title="Explore" onclick="window.appNavigate('/explore')"><i class="ph ph-compass"></i></button>
        <button class="nav-icon-btn" title="Messages" onclick="window.appNavigate('/messages')" style="position:relative;">
          <i class="ph ph-chat-circle-dots"></i>
          <span class="badge-dot" id="msg-dot" style="display:none;"></span>
        </button>
        <button class="nav-icon-btn" title="Notifications" onclick="window.appNavigate('/notifications')" style="position:relative;">
          <i class="ph ph-bell"></i>
          <span class="badge-dot" id="notif-dot" style="display:none;"></span>
        </button>
        <button class="nav-icon-btn" title="Saved" onclick="window.appNavigate('/saved')"><i class="ph ph-bookmark"></i></button>
        <button class="nav-icon-btn" title="Profile" onclick="window.appNavigate('/profile')">${avatarHtml}</button>
        <button class="nav-icon-btn" title="Logout" onclick="doLogout()"><i class="ph ph-sign-out"></i></button>
      </div>
    </div>
  </nav>`;
}

function doLogout() {
  clearSocket();
  const currentToken = localStorage.getItem('token');
  const currentUserStr = localStorage.getItem('user');
  
  if (currentToken && currentUserStr) {
    const currentUser = JSON.parse(currentUserStr);
    let saved = JSON.parse(localStorage.getItem('savedAccounts') || '[]');
    saved = saved.filter(acc => acc.id !== currentUser.id);
    saved.unshift({ ...currentUser, token: currentToken });
    localStorage.setItem('savedAccounts', JSON.stringify(saved));
  }
  
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  state.user = null;
  navigate('/login');
}
window.doLogout = doLogout;

function setupNavSearch() {
  const input = document.getElementById('nav-search-input');
  const resultsBox = document.getElementById('nav-search-results');
  if (!input) return;
  let timer;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 2) { resultsBox.innerHTML = ''; return; }
    timer = setTimeout(async () => {
      try {
        const res = await users.search(q);
        if (!res.length) { resultsBox.innerHTML = ''; return; }
        resultsBox.innerHTML = `<div class="card" style="max-height:240px;overflow-y:auto;">${
          res.slice(0, 6).map(u => `
            <div class="user-result-card" style="cursor:pointer;"
              onclick="window.appNavigate('/profile?id=${u.id}');document.getElementById('nav-search-input').value='';document.getElementById('nav-search-results').innerHTML='';">
              ${avatarEl(u, 'sm')}
              <div><div class="user-result-name">${esc(u.fullName)}</div>
              <div class="user-result-handle">@${esc(u.username)}</div></div>
            </div>`).join('')
        }</div>`;
      } catch(_) {}
    }, 400);
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.nav-search')) resultsBox.innerHTML = '';
  });
}

// ── Helpers ─────────────────────────────────────────────────────────
function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function avatarEl(u, size = 'md') {
  const letter = (u.fullName || u.authorFullName || 'U').charAt(0).toUpperCase();
  const src = u.profilePicture || u.authorProfilePicture;
  if (src) return `<img src="${getImageUrl(src)}" class="avatar avatar-${size}" alt="${esc(letter)}">`;
  return `<div class="avatar avatar-${size}">${esc(letter)}</div>`;
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)  return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7)   return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function linkHashtags(content) {
  return esc(content).replace(/#(\w+)/g, `<span class="hashtag" onclick="window.appNavigate('/hashtag?tag=$1')">#$1</span>`);
}

function spinner() {
  return '<div class="spinner"></div>';
}

// ── Post Card ────────────────────────────────────────────────────────
function postCardHtml(post, currentUserId) {
  const isOwn = post.authorId === currentUserId;
  return `
  <div class="card post-card" id="post-${post.id}">
    <div class="post-header">
      <div class="post-author-info" style="cursor:pointer;" onclick="window.appNavigate('/profile?id=${post.authorId}')">
        ${avatarEl({ fullName: post.authorFullName, profilePicture: post.authorProfilePicture }, 'md')}
        <div>
          <div class="post-author-name">${esc(post.authorFullName)}</div>
          <div class="post-author-handle">@${esc(post.authorUsername)} · <span class="post-time">${timeAgo(post.createdAt)}</span></div>
        </div>
      </div>
      ${isOwn ? `<button class="btn btn-ghost btn-sm" onclick="deletePost('${post.id}')" title="Delete Post" style="color:var(--error);"><i class="ph ph-trash"></i></button>` : ''}
    </div>
    <p class="post-content">${linkHashtags(post.content)}</p>
    ${post.imageUrl ? (post.imageUrl.match(/\.(mp4|webm|mov|avi)$/i) ? `<video src="${getImageUrl(post.imageUrl)}" class="post-image" controls></video>` : `<img src="${getImageUrl(post.imageUrl)}" class="post-image" alt="post image" loading="lazy">`) : ''}
    <div class="post-actions">
      <button class="action-btn ${post.isLiked ? 'liked' : ''}" id="like-btn-${post.id}" onclick="toggleLike('${post.id}')">
        <i class="ph ${post.isLiked ? 'ph-heart-fill' : 'ph-heart'}"></i>
        <span id="like-count-${post.id}">${post.likesCount || 0}</span>
      </button>
      <button class="action-btn" onclick="toggleComments('${post.id}')">
        <i class="ph ph-chat-circle"></i>
        <span id="comment-count-${post.id}">${post.commentsCount || 0}</span>
      </button>
      <button class="action-btn ${post.isSaved ? 'saved' : ''}" id="save-btn-${post.id}" onclick="toggleSave('${post.id}')">
        <i class="ph ${post.isSaved ? 'ph-bookmark-fill' : 'ph-bookmark'}"></i>
      </button>
      <button class="action-btn" onclick="doRepost('${post.id}')">
        <i class="ph ph-repeat"></i>
        <span>${post.sharesCount || 0}</span>
      </button>
    </div>
    <div class="comments-section" id="comments-section-${post.id}">
      <div class="comments-list" id="comments-list-${post.id}"></div>
      <div class="comment-form">
        ${avatarEl(state.user || { fullName: 'U' }, 'sm')}
        <input class="form-control" placeholder="Add a comment…" id="comment-input-${post.id}">
        <button class="btn btn-primary btn-sm" onclick="submitComment('${post.id}')">Post</button>
      </div>
    </div>
  </div>`;
}

// ── Post Actions ─────────────────────────────────────────────────────
window.deletePost = async (id) => {
  if (!confirm('Delete this post?')) return;
  try {
    await posts.delete(id);
    document.getElementById(`post-${id}`)?.remove();
    showToast('Post deleted', 'success');
  } catch(e) { showToast(e.message, 'error'); }
};

window.toggleLike = async (id) => {
  const btn = document.getElementById(`like-btn-${id}`);
  const count = document.getElementById(`like-count-${id}`);
  const isLiked = btn.classList.contains('liked');
  const icon = btn.querySelector('i');
  try {
    const res = isLiked ? await posts.unlike(id) : await posts.like(id);
    btn.classList.toggle('liked');
    icon.classList.toggle('ph-heart', isLiked);
    icon.classList.toggle('ph-heart-fill', !isLiked);
    count.textContent = res.likesCount;
  } catch(e) { showToast(e.message, 'error'); }
};

window.toggleSave = async (id) => {
  const btn = document.getElementById(`save-btn-${id}`);
  const isSaved = btn.classList.contains('saved');
  const icon = btn.querySelector('i');
  try {
    isSaved ? await posts.unsave(id) : await posts.save(id);
    btn.classList.toggle('saved');
    icon.classList.toggle('ph-bookmark', isSaved);
    icon.classList.toggle('ph-bookmark-fill', !isSaved);
    showToast(isSaved ? 'Removed from saved' : 'Saved!', 'success');
  } catch(e) { showToast(e.message, 'error'); }
};

window.doRepost = async (id) => {
  try {
    await posts.repost(id);
    showToast('Reposted!', 'success');
    const btn = document.querySelector(`#post-${id} .ph-repeat`);
    if (btn) { btn.parentElement.classList.add('reposted'); const s = btn.nextElementSibling; if(s) s.textContent = parseInt(s.textContent)+1; }
  } catch(e) { showToast(e.message, 'error'); }
};

window.toggleComments = async (postId) => {
  const section = document.getElementById(`comments-section-${postId}`);
  const isOpen = section.classList.contains('open');
  section.classList.toggle('open');
  if (!isOpen) await loadComments(postId);
};

window.loadComments = async (postId) => {
  const list = document.getElementById(`comments-list-${postId}`);
  list.innerHTML = spinner();
  try {
    const data = await comments.getForPost(postId);
    if (!data.length) { list.innerHTML = '<p class="text-muted" style="font-size:.8rem;padding:.5rem 0">No comments yet.</p>'; return; }
    list.innerHTML = data.map(c => `
      <div class="comment-item">
        ${avatarEl({ fullName: c.authorFullName, profilePicture: c.authorProfilePicture }, 'sm')}
        <div class="comment-body">
          <div class="comment-author">${esc(c.authorUsername)}</div>
          <div class="comment-text">${esc(c.content)}</div>
          <div class="comment-time">${timeAgo(c.createdAt)}
            ${c.authorId === state.user?.id ? `<button class="btn btn-ghost btn-sm" style="padding:0 .4rem;font-size:.72rem;" onclick="deleteComment('${c.id}', '${postId}')">Delete</button>` : ''}
          </div>
        </div>
      </div>`).join('');
  } catch(e) { list.innerHTML = `<p class="text-muted">${e.message}</p>`; }
};

window.submitComment = async (postId) => {
  const input = document.getElementById(`comment-input-${postId}`);
  const text = input.value.trim();
  if (!text) return;
  try {
    await comments.add(postId, { content: text });
    input.value = '';
    const countEl = document.getElementById(`comment-count-${postId}`);
    if (countEl) countEl.textContent = parseInt(countEl.textContent) + 1;
    await loadComments(postId);
  } catch(e) { showToast(e.message, 'error'); }
};

window.deleteComment = async (commentId, postId) => {
  try {
    await comments.delete(commentId);
    await loadComments(postId);
    const countEl = document.getElementById(`comment-count-${postId}`);
    if (countEl && parseInt(countEl.textContent) > 0) countEl.textContent = parseInt(countEl.textContent) - 1;
  } catch(e) { showToast(e.message, 'error'); }
};

// ── Login Page ───────────────────────────────────────────────────────
async function renderLogin() {
  const savedStr = localStorage.getItem('savedAccounts');
  const savedAccounts = savedStr ? JSON.parse(savedStr) : [];
  
  if (savedAccounts.length > 0) {
    const accountsHtml = savedAccounts.map(acc => `
      <div class="card saved-account-card" style="display:flex;align-items:center;padding:.75rem;margin-bottom:.5rem;cursor:pointer;gap:1rem;border:1px solid var(--border);" onclick="loginSaved('${acc.token}', '${acc.id}')">
        ${avatarEl({fullName:acc.fullName, profilePicture:acc.profilePicture}, 'md')}
        <div style="flex:1;">
          <div style="font-weight:600;">${esc(acc.fullName)}</div>
          <div class="text-muted" style="font-size:.8rem;">@${esc(acc.username)}</div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); removeSavedAccount('${acc.id}')" style="padding:0;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;"><i class="ph ph-x"></i></button>
      </div>
    `).join('');

    app.innerHTML = `
    <div class="auth-page">
      <div class="card auth-card">
        <span class="auth-logo">ConnectSphere</span>
        <h2 class="auth-title">Choose an Account</h2>
        <div class="saved-accounts-list">
          ${accountsHtml}
        </div>
        <button class="btn btn-outline btn-full" style="margin-top:1rem;" onclick="showLoginForm()">Log in to another account</button>
        <p class="auth-footer" style="margin-top:1.5rem;">Don't have an account? <a href="/register" onclick="event.preventDefault();window.appNavigate('/register')">Register</a></p>
      </div>
    </div>`;
  } else {
    showLoginForm();
  }
}

window.showLoginForm = () => {
  app.innerHTML = `
  <div class="auth-page">
    <div class="card auth-card">
      <span class="auth-logo">ConnectSphere</span>
      <h2 class="auth-title">Welcome back</h2>
      <form id="login-form">
        <div class="form-group">
          <label>Email or Username</label>
          <input class="form-control" type="text" id="identifier" required placeholder="you@example.com">
        </div>
        <div class="form-group">
          <label>Password</label>
          <input class="form-control" type="password" id="password" required placeholder="••••••••">
        </div>
        <button type="submit" class="btn btn-primary btn-full" id="login-btn">Login</button>
      </form>
      <p class="auth-footer">Don't have an account? <a href="/register" onclick="event.preventDefault();window.appNavigate('/register')">Register</a></p>
    </div>
  </div>`;

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('login-btn');
    btn.disabled = true; btn.textContent = 'Logging in…';
    try {
      const res = await auth.login({ identifier: document.getElementById('identifier').value, password: document.getElementById('password').value });
      localStorage.setItem('token', res.token);
      localStorage.setItem('user', JSON.stringify(res));
      state.user = res;
      navigate('/');
    } catch(e) { showToast(e.message, 'error'); btn.disabled = false; btn.textContent = 'Login'; }
  });
};

window.loginSaved = (token, id) => {
  const savedStr = localStorage.getItem('savedAccounts');
  const saved = savedStr ? JSON.parse(savedStr) : [];
  const userObj = saved.find(acc => acc.id === id);
  if (!userObj) return;

  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(userObj));
  state.user = userObj;
  initSocket();
  navigate('/');
};

window.removeSavedAccount = (id) => {
  let saved = JSON.parse(localStorage.getItem('savedAccounts') || '[]');
  saved = saved.filter(acc => acc.id !== id);
  if (saved.length > 0) {
    localStorage.setItem('savedAccounts', JSON.stringify(saved));
    renderLogin();
  } else {
    localStorage.removeItem('savedAccounts');
    showLoginForm();
  }
};

// ── Register Page ────────────────────────────────────────────────────
async function renderRegister() {
  app.innerHTML = `
  <div class="auth-page">
    <div class="card auth-card">
      <span class="auth-logo">ConnectSphere</span>
      <h2 class="auth-title">Create your account</h2>
      <form id="register-form">
        <div class="form-group">
          <label>Full Name</label>
          <input class="form-control" type="text" id="fullName" required placeholder="Jane Doe">
        </div>
        <div class="form-group">
          <label>Username</label>
          <input class="form-control" type="text" id="username" required placeholder="janedoe">
        </div>
        <div class="form-group">
          <label>Email</label>
          <input class="form-control" type="email" id="email" required placeholder="you@example.com">
        </div>
        <div class="form-group">
          <label>Password</label>
          <input class="form-control" type="password" id="password" required placeholder="Min 6 characters">
        </div>
        <button type="submit" class="btn btn-primary btn-full" id="reg-btn">Create Account</button>
      </form>
      <p class="auth-footer">Already have an account? <a href="/login" onclick="event.preventDefault();window.appNavigate('/login')">Login</a></p>
    </div>
  </div>`;

  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('reg-btn');
    btn.disabled = true; btn.textContent = 'Creating…';
    try {
      const res = await auth.register({
        fullName: document.getElementById('fullName').value,
        username: document.getElementById('username').value,
        email: document.getElementById('email').value,
        password: document.getElementById('password').value
      });
      showToast('Account created successfully! Please log in.', 'success');
      navigate('/login');
    } catch(e) { showToast(e.message, 'error'); btn.disabled = false; btn.textContent = 'Create Account'; }
  });
}

// ── Home Feed ────────────────────────────────────────────────────────
async function renderHome() {
  app.innerHTML = `
  ${navbar()}
  <div class="container">
    <div class="page-layout">
      <aside>
        <div class="card sidebar-widget">
          <div class="widget-title">Your Profile</div>
          <div style="display:flex;align-items:center;gap:.75rem;cursor:pointer;" onclick="window.appNavigate('/profile')">
            ${avatarEl(state.user || {fullName:'U'}, 'md')}
            <div>
              <div style="font-weight:600;">${esc(state.user?.fullName)}</div>
              <div class="text-muted" style="font-size:.8rem;">@${esc(state.user?.username)}</div>
            </div>
          </div>
<div style="margin-top:1rem;display:flex;flex-direction:column;gap:.5rem;">
             <a href="/notifications" onclick="event.preventDefault();window.appNavigate('/notifications')" style="color:var(--muted);font-size:.875rem;display:flex;align-items:center;gap:.5rem;"><i class="ph ph-bell"></i> Notifications</a>
             <a href="/requests" onclick="event.preventDefault();window.appNavigate('/requests')" style="color:var(--muted);font-size:.875rem;display:flex;align-items:center;gap:.5rem;"><i class="ph ph-user-plus"></i> Follow Requests</a>
             <a href="/messages" onclick="event.preventDefault();window.appNavigate('/messages')" style="color:var(--muted);font-size:.875rem;display:flex;align-items:center;gap:.5rem;"><i class="ph ph-chat-circle-dots"></i> Messages</a>
             <a href="/saved" onclick="event.preventDefault();window.appNavigate('/saved')" style="color:var(--muted);font-size:.875rem;display:flex;align-items:center;gap:.5rem;"><i class="ph ph-bookmark"></i> Saved</a>
             <a href="/explore" onclick="event.preventDefault();window.appNavigate('/explore')" style="color:var(--muted);font-size:.875rem;display:flex;align-items:center;gap:.5rem;"><i class="ph ph-compass"></i> Explore</a>
           </div>
        </div>
      </aside>
      <main>
        <div id="stories-row"></div>
        <div class="card create-post">
          <div class="create-post-header">
            ${avatarEl(state.user || {fullName:'U'}, 'md')}
            <textarea class="create-post-textarea" id="post-content" placeholder="What's on your mind?" rows="2"></textarea>
          </div>
          <div id="post-image-preview" class="image-preview-wrap" style="display:none;"></div>
          <div class="create-post-actions">
            <div class="create-post-tools">
              <label class="post-tool-btn" for="post-image-input" title="Add image"><i class="ph ph-image"></i></label>
              <input type="file" id="post-image-input" accept="image/*,video/*" style="display:none;">
              <label class="post-tool-btn" for="story-toggle" title="Post as story" style="display:flex;align-items:center;gap:.25rem;font-size:.78rem;">
                <input type="checkbox" id="story-toggle" style="accent-color:var(--primary);"> Story
              </label>
            </div>
            <button class="btn btn-primary btn-sm" id="post-submit-btn" onclick="submitPost()">Post</button>
          </div>
        </div>
        <div id="feed">${spinner()}</div>
      </main>
    </div>
  </div>`;

  setupNavSearch();
  await Promise.all([loadStories(), loadFeed()]);
  setupImagePreview();
}

async function loadStories() {
  const row = document.getElementById('stories-row');
  if (!row) return;
  try {
    const data = await posts.getStories();
    if (!data.length) { row.innerHTML = ''; return; }
    row.innerHTML = `
    <div class="card" style="margin-bottom:1rem;">
      <div class="stories-bar">
        <div class="story-bubble" onclick="window.appNavigate('/')">
          <div class="add-story-btn"><i class="ph ph-plus"></i></div>
          <span class="story-name">Add story</span>
        </div>
        ${data.map(s => `
          <div class="story-bubble" onclick="openStory(${JSON.stringify(s).replace(/"/g,'&quot;')})">
            <div class="story-ring">
              ${avatarEl({fullName:s.authorFullName, profilePicture:s.authorProfilePicture},'md')}
            </div>
            <span class="story-name">${esc(s.authorUsername)}</span>
          </div>`).join('')}
      </div>
    </div>`;
  } catch(_) { row.innerHTML = ''; }
}

window.openStory = async (story) => {
  const isOwn = story.authorId === state.user?.id;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  
  // Record view in background for non-authors
  if (!isOwn) {
    posts.viewStory(story.id).catch(() => {});
  }

  const actionsHtml = `
    <div id="story-stats-container" style="position:absolute;bottom:0;left:0;right:0;background:var(--card-bg);border-top-left-radius:1rem;border-top-right-radius:1rem;padding:1rem;max-height:50%;overflow-y:auto;transform:translateY(100%);transition:transform 0.3s ease;z-index:20;">
      <div style="display:flex;justify-content:space-around;border-bottom:1px solid var(--border);padding-bottom:.5rem;margin-bottom:.5rem;">
        <button class="btn btn-ghost btn-sm" onclick="showStoryTab('viewers')" id="tab-btn-viewers" style="font-weight:bold;">👁 Viewers</button>
        <button class="btn btn-ghost btn-sm text-muted" onclick="showStoryTab('likers')" id="tab-btn-likers">❤️ Likers</button>
      </div>
      <div id="story-tab-viewers"></div>
      <div id="story-tab-likers" style="display:none;"></div>
    </div>
    <div style="position:absolute;bottom:20px;left:0;right:0;display:flex;justify-content:center;align-items:center;gap:1rem;z-index:10;">
      ${isOwn ? `<button class="btn btn-primary btn-sm" onclick="document.getElementById('story-stats-container').style.transform='translateY(0)'">View Stats</button>
                 <button class="btn btn-primary btn-sm" style="background:var(--error);border:none;padding-left:1.5rem;padding-right:1.5rem;" onclick="deleteStory('${story.id}')" title="Delete Story"><i class="ph ph-trash"></i> Delete</button>` 
              : `<button class="btn btn-ghost" onclick="toggleStoryLike('${story.id}', this)" style="background:rgba(0,0,0,0.5);color:${story.isLiked ? 'var(--danger, #e0245e)' : 'white'};border-radius:50%;width:34px;height:34px;display:inline-flex;align-items:center;justify-content:center;padding:0;">
                   <i class="ph ${story.isLiked ? 'ph-heart-fill' : 'ph-heart'}" style="font-size:1.2rem;"></i>
                 </button>`}
    </div>
  `;

  overlay.innerHTML = `
    <div class="story-modal" style="position:relative;overflow:hidden;">
      <div class="story-progress"><div class="story-progress-bar"><div class="story-progress-fill" id="story-prog-fill"></div></div></div>
      <button class="story-close" onclick="this.closest('.modal-overlay').remove()"><i class="ph ph-x"></i></button>
      <div style="padding:.75rem;display:flex;align-items:center;gap:.5rem;">
        ${avatarEl({fullName:story.authorFullName,profilePicture:story.authorProfilePicture},'sm')}
        <div>
          <div style="font-weight:600;font-size:.85rem;">${esc(story.authorFullName)}</div>
          <div style="font-size:.72rem;color:var(--muted);">${timeAgo(story.createdAt)}</div>
        </div>
      </div>
      ${story.imageUrl ? (story.imageUrl.match(/\.(mp4|webm|mov|avi)$/i) ? `<video src="${getImageUrl(story.imageUrl)}" class="story-img" controls autoplay muted></video>` : `<img src="${getImageUrl(story.imageUrl)}" class="story-img" alt="story">`) : ''}
      <div class="story-text">${esc(story.content)}</div>
      ${actionsHtml}
    </div>`;
  document.body.appendChild(overlay);
  
  overlay.addEventListener('click', (e) => { 
    if(e.target === overlay) overlay.remove(); 
    else if (!e.target.closest('#story-stats-container') && e.target.tagName !== 'BUTTON' && !e.target.closest('button')) {
      const statsContainer = document.getElementById('story-stats-container');
      if (statsContainer) statsContainer.style.transform = 'translateY(100%)';
    }
  });

  // Fetch and populate stats
  try {
    const stats = await posts.getStoryStats(story.id);
    
    const viewersHtml = stats.viewers.length 
      ? stats.viewers.map(u => `<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.5rem;">${avatarEl(u, 'sm')} <span style="font-size:.85rem;">${esc(u.fullName)}</span></div>`).join('')
      : '<p class="text-muted" style="font-size:.8rem;text-align:center;">No viewers yet</p>';
      
    const likersHtml = stats.likers.length 
      ? stats.likers.map(u => `<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.5rem;">${avatarEl(u, 'sm')} <span style="font-size:.85rem;">${esc(u.fullName)}</span></div>`).join('')
      : '<p class="text-muted" style="font-size:.8rem;text-align:center;">No likers yet</p>';

    const vTab = document.getElementById('story-tab-viewers');
    const lTab = document.getElementById('story-tab-likers');
    if (vTab) vTab.innerHTML = viewersHtml;
    if (lTab) lTab.innerHTML = likersHtml;

    window.showStoryTab = (tab) => {
      document.getElementById('story-tab-viewers').style.display = tab === 'viewers' ? 'block' : 'none';
      document.getElementById('story-tab-likers').style.display = tab === 'likers' ? 'block' : 'none';
      document.getElementById('tab-btn-viewers').classList.toggle('text-muted', tab !== 'viewers');
      document.getElementById('tab-btn-likers').classList.toggle('text-muted', tab !== 'likers');
      document.getElementById('tab-btn-viewers').style.fontWeight = tab === 'viewers' ? 'bold' : 'normal';
      document.getElementById('tab-btn-likers').style.fontWeight = tab === 'likers' ? 'bold' : 'normal';
    };
  } catch(e) { console.error(e); }

  // Disable progress bar animation since we want users to be able to browse stats
  const progFill = overlay.querySelector('#story-prog-fill');
  if (progFill) progFill.style.animation = 'none';
};

window.deleteStory = async (id) => {
  if (!confirm('Are you sure you want to delete this story?')) return;
  try {
    await posts.delete(id);
    const modal = document.querySelector('.modal-overlay');
    if (modal) modal.remove();
    loadStories();
    showToast('Story deleted', 'success');
  } catch(e) {
    showToast(e.message, 'error');
  }
};

window.toggleStoryLike = async (storyId, btn) => {
  const icon = btn.querySelector('i');
  const isLiked = icon.classList.contains('ph-heart-fill');
  try {
    if (isLiked) {
      await posts.unlikeStory(storyId);
      icon.classList.remove('ph-heart-fill');
      icon.classList.add('ph-heart');
      icon.style.color = 'white';
    } else {
      await posts.likeStory(storyId);
      icon.classList.remove('ph-heart');
      icon.classList.add('ph-heart-fill');
      icon.style.color = 'var(--danger, #e0245e)';
    }
  } catch(e) { showToast(e.message, 'error'); }
};

async function loadFeed() {
  const feed = document.getElementById('feed');
  if (!feed) return;
  try {
    const data = await posts.getFeed();
    if (!data.length) {
      feed.innerHTML = '<div class="empty-state"><i class="ph ph-image-square"></i><p>No posts yet.<br>Follow people or <a href="/explore" onclick="event.preventDefault();window.appNavigate(\'\/explore\')">explore</a> to discover content.</p></div>';
      return;
    }
    feed.innerHTML = data.map(p => postCardHtml(p, state.user?.id)).join('');
  } catch(e) { feed.innerHTML = `<p class="text-muted">${e.message}</p>`; }
}

async function loadTrending() {
  const el = document.getElementById('trending-list');
  if (!el) return;
  try {
    const data = await posts.getTrending();
    if (!data.length) { el.innerHTML = '<p class="text-muted" style="font-size:.8rem;">Nothing trending yet.</p>'; return; }
    el.innerHTML = data.map(t => `
      <div class="trending-tag" onclick="window.appNavigate('/hashtag?tag=${t.tag}')">
        <span class="hashtag-chip">#${esc(t.tag)}</span>
        <span class="trending-count">${t.count} post${t.count>1?'s':''}</span>
      </div>`).join('');
  } catch(_) { el.innerHTML = ''; }
}

function setupImagePreview() {
  const input = document.getElementById('post-image-input');
  const preview = document.getElementById('post-image-preview');
  if (!input) return;
  input.addEventListener('change', () => {
    if (!input.files[0]) return;
    const file = input.files[0];
    const url = URL.createObjectURL(file);
    preview.style.display = 'block';
    if (file.type.startsWith('video/')) {
      preview.innerHTML = `<video src="${url}" controls style="width:100%;border-radius:var(--radius-md);"></video><button class="remove-image-btn" onclick="removeImage()"><i class="ph ph-x"></i></button>`;
    } else {
      preview.innerHTML = `<img src="${url}" alt="preview"><button class="remove-image-btn" onclick="removeImage()"><i class="ph ph-x"></i></button>`;
    }
  });
}
window.removeImage = () => {
  const input = document.getElementById('post-image-input');
  const preview = document.getElementById('post-image-preview');
  if (input) input.value = '';
  if (preview) { preview.innerHTML = ''; preview.style.display = 'none'; }
};

window.submitPost = async () => {
  const content = document.getElementById('post-content').value.trim();
  const fileInput = document.getElementById('post-image-input');
  const file = fileInput?.files[0];
  
  if (!content && !file) return;
  
  const btn = document.getElementById('post-submit-btn');
  btn.disabled = true;
  const formData = new FormData();
  if (content) formData.append('content', content);
  const isStory = document.getElementById('story-toggle')?.checked;
  if (isStory) formData.append('is_story', 'true');
  if (file) formData.append('image', file);
  try {
    await posts.create(formData);
    document.getElementById('post-content').value = '';
    removeImage();
    if (document.getElementById('story-toggle')) document.getElementById('story-toggle').checked = false;
    showToast(isStory ? 'Story posted!' : 'Posted!', 'success');
    await Promise.all([loadFeed(), loadStories()]);
  } catch(e) { showToast(e.message, 'error'); }
  btn.disabled = false;
};

// ── Profile Page ─────────────────────────────────────────────────────
async function renderProfile() {
  const params = new URLSearchParams(window.location.search);
  const profileId = params.get('id') || state.user?.id;
  const isOwn = String(profileId) === String(state.user?.id);

  app.innerHTML = `${navbar()}<div class="container" id="profile-container" style="max-width:900px;padding-top:1.5rem;">${spinner()}</div>`;
  setupNavSearch();

  try {
    const u = await users.getProfile(profileId);

    const canMessage = u.followStatus === 'accepted' || u.reverseFollowStatus === 'accepted';

    const followBtnHtml = !isOwn ? `
      <button class="btn ${u.followStatus === 'accepted' ? 'btn-outline' : u.followStatus === 'pending' ? 'btn-ghost' : 'btn-primary'}"
        id="follow-profile-btn" onclick="toggleFollowProfile('${u.id}', '${u.followStatus || ''}')">
        ${u.followStatus === 'accepted' ? 'Following' : u.followStatus === 'pending' ? '⏳ Request Sent' : 'Follow'}
      </button>
      ${canMessage ? `
      <button class="btn btn-outline btn-sm" onclick="window.appNavigate('/messages?userId=${u.id}')">
        <i class="ph ph-chat-circle-dots"></i> Message
      </button>` : ''}` : `
      <button class="btn btn-outline btn-sm" onclick="window.appNavigate('/edit-profile')">
        <i class="ph ph-pencil"></i> Edit Profile
      </button>`;

    const profilePic = u.profilePicture
      ? `<img src="${getImageUrl(u.profilePicture)}" class="avatar avatar-xl" alt="avatar">`
      : `<div class="avatar avatar-xl">${(u.fullName||'U').charAt(0)}</div>`;

    const postsHtml = u.posts?.length
      ? u.posts.map(p => `
        <div class="profile-grid-item">
          ${p.imageUrl ? (p.imageUrl.match(/\.(mp4|webm|mov|avi)$/i) ? `<video src="${getImageUrl(p.imageUrl)}" loading="lazy"></video>` : `<img src="${getImageUrl(p.imageUrl)}" alt="post" loading="lazy">`) : `<div class="grid-no-img" style="padding:1rem;text-align:center;font-size:0.9rem;word-break:break-word;display:flex;align-items:center;justify-content:center;">${esc(p.content.substring(0, 100))}${p.content.length > 100 ? '...' : ''}</div>`}
          <div class="grid-overlay">
            <span><i class="ph ph-heart"></i> ${p.likesCount}</span>
            <span><i class="ph ph-chat-circle"></i> ${p.commentsCount}</span>
          </div>
        </div>`).join('')
      : '<div class="empty-state" style="grid-column:1/-1"><i class="ph ph-image-square"></i><p>No posts yet</p></div>';

    const repostsHtml = u.reposts?.length
      ? u.reposts.map(p => `
        <div class="profile-grid-item">
          ${p.imageUrl ? (p.imageUrl.match(/\.(mp4|webm|mov|avi)$/i) ? `<video src="${getImageUrl(p.imageUrl)}" loading="lazy"></video>` : `<img src="${getImageUrl(p.imageUrl)}" alt="post" loading="lazy">`) : `<div class="grid-no-img" style="padding:1rem;text-align:center;font-size:0.9rem;word-break:break-word;display:flex;align-items:center;justify-content:center;">${esc(p.content.substring(0, 100))}${p.content.length > 100 ? '...' : ''}</div>`}
          <div class="grid-overlay">
            <span><i class="ph ph-heart"></i> ${p.likesCount}</span>
            <span><i class="ph ph-chat-circle"></i> ${p.commentsCount}</span>
          </div>
        </div>`).join('')
      : '<div class="empty-state" style="grid-column:1/-1"><i class="ph ph-arrows-clockwise"></i><p>No reposts yet</p></div>';

    document.getElementById('profile-container').innerHTML = `
      <div class="card profile-header">
        <div class="profile-top">
          ${profilePic}
          <div style="flex:1;">
            <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap;">
              <h2>${esc(u.fullName)}</h2>
              ${followBtnHtml}
            </div>
            <div class="text-muted" style="margin:.25rem 0;">@${esc(u.username)}</div>
            <div class="profile-stats">
              <div class="stat-item"><div class="stat-num">${u.postsCount||0}</div><div class="stat-label">Posts</div></div>
              <div class="stat-item"><div class="stat-num">${u.followersCount||0}</div><div class="stat-label">Followers</div></div>
              <div class="stat-item"><div class="stat-num">${u.followingCount||0}</div><div class="stat-label">Following</div></div>
            </div>
            ${u.bio ? `<p class="profile-bio">${esc(u.bio)}</p>` : ''}
          </div>
        </div>
      </div>
      <div class="card" style="margin-top:1rem;">
        <div class="profile-tabs" style="display:flex;border-bottom:1px solid var(--border);">
          <div class="profile-tab active" id="tab-btn-posts" onclick="showProfileTab('posts')" style="flex:1;text-align:center;padding:1rem;cursor:pointer;border-bottom:2px solid var(--primary);font-weight:bold;"><i class="ph ph-grid-four"></i> Posts</div>
          <div class="profile-tab text-muted" id="tab-btn-reposts" onclick="showProfileTab('reposts')" style="flex:1;text-align:center;padding:1rem;cursor:pointer;border-bottom:2px solid transparent;"><i class="ph ph-arrows-clockwise"></i> Reposts</div>
        </div>
        <div class="profile-grid" id="profile-posts-grid" style="padding:.5rem;">${postsHtml}</div>
        <div class="profile-grid" id="profile-reposts-grid" style="padding:.5rem;display:none;">${repostsHtml}</div>
      </div>`;
  } catch(e) {
    document.getElementById('profile-container').innerHTML = `<p class="text-muted">${e.message}</p>`;
  }
}

window.showProfileTab = (tab) => {
  const postsGrid = document.getElementById('profile-posts-grid');
  const repostsGrid = document.getElementById('profile-reposts-grid');
  const postsBtn = document.getElementById('tab-btn-posts');
  const repostsBtn = document.getElementById('tab-btn-reposts');
  
  if (tab === 'posts') {
    postsGrid.style.display = 'grid';
    repostsGrid.style.display = 'none';
    postsBtn.classList.add('active');
    postsBtn.classList.remove('text-muted');
    postsBtn.style.borderBottomColor = 'var(--primary)';
    postsBtn.style.fontWeight = 'bold';
    
    repostsBtn.classList.remove('active');
    repostsBtn.classList.add('text-muted');
    repostsBtn.style.borderBottomColor = 'transparent';
    repostsBtn.style.fontWeight = 'normal';
  } else {
    postsGrid.style.display = 'none';
    repostsGrid.style.display = 'grid';
    repostsBtn.classList.add('active');
    repostsBtn.classList.remove('text-muted');
    repostsBtn.style.borderBottomColor = 'var(--primary)';
    repostsBtn.style.fontWeight = 'bold';
    
    postsBtn.classList.remove('active');
    postsBtn.classList.add('text-muted');
    postsBtn.style.borderBottomColor = 'transparent';
    postsBtn.style.fontWeight = 'normal';
  }
};

window.toggleFollowProfile = async (userId, followStatus) => {
  const btn = document.getElementById('follow-profile-btn');
  btn.disabled = true;
  try {
    if (followStatus === 'accepted' || followStatus === 'pending') {
      await follow.unfollow(userId);
    } else {
      await follow.follow(userId);
    }
    await renderProfile(); // Re-render to update Message button and counts
  } catch(e) { 
    showToast(e.message, 'error'); 
    btn.disabled = false; 
  }
};

// ── Edit Profile ──────────────────────────────────────────────────────
async function renderEditProfile() {
  const u = state.user;
  app.innerHTML = `
  ${navbar()}
  <div class="container" style="max-width:600px;padding-top:1.5rem;">
    <div class="card" style="padding:2rem;">
      <h2 style="margin-bottom:1.5rem;">Edit Profile</h2>
      <form id="edit-profile-form">
        <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem;">
          <div id="edit-avatar">${avatarEl(u||{fullName:'U'}, 'lg')}</div>
          <label class="btn btn-outline btn-sm" for="avatar-input">Change Photo<input type="file" id="avatar-input" accept="image/*" style="display:none;"></label>
        </div>
        <div class="form-group">
          <label>Full Name</label>
          <input class="form-control" id="edit-fullname" value="${esc(u?.fullName||'')}" placeholder="Full Name">
        </div>
        <div class="form-group">
          <label>Bio</label>
          <textarea class="form-control" id="edit-bio" rows="3" placeholder="Tell the world about yourself">${esc(u?.bio||'')}</textarea>
        </div>
        <button type="submit" class="btn btn-primary btn-full" id="save-profile-btn">Save Changes</button>
      </form>
    </div>
  </div>`;

  setupNavSearch();

  document.getElementById('avatar-input').addEventListener('change', (e) => {
    if (e.target.files[0]) {
      const url = URL.createObjectURL(e.target.files[0]);
      document.getElementById('edit-avatar').innerHTML = `<img src="${url}" class="avatar avatar-lg" alt="preview">`;
    }
  });

  document.getElementById('edit-profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('save-profile-btn');
    btn.disabled = true; btn.textContent = 'Saving…';
    const formData = new FormData();
    const fn = document.getElementById('edit-fullname').value.trim();
    const bio = document.getElementById('edit-bio').value.trim();
    if (fn) formData.append('fullName', fn);
    formData.append('bio', bio);
    const file = document.getElementById('avatar-input').files[0];
    if (file) formData.append('profilePicture', file);
    try {
      const updated = await users.updateProfile(formData);
      const newUser = { ...state.user, ...updated };
      localStorage.setItem('user', JSON.stringify(newUser));
      state.user = newUser;
      showToast('Profile updated!', 'success');
      navigate('/profile');
    } catch(e) { showToast(e.message, 'error'); btn.disabled = false; btn.textContent = 'Save Changes'; }
  });
}

// ── Explore ───────────────────────────────────────────────────────────
async function renderExplore() {
  app.innerHTML = `
  ${navbar()}
  <div class="container" style="max-width:900px;padding-top:1.5rem;">
    <h2 style="margin-bottom:1rem;">Explore</h2>
    <div class="card" style="padding:1rem;margin-bottom:1.5rem;display:flex;gap:.75rem;align-items:center;">
      <i class="ph ph-magnifying-glass" style="color:var(--muted);font-size:1.2rem;"></i>
      <input class="form-control" id="explore-search" placeholder="Search users by name or username…" style="border:none;background:transparent;padding:.25rem 0;">
    </div>
    <div id="user-results" style="margin-bottom:1.5rem;display:none;"></div>
    <h3 style="margin-bottom:1rem;color:var(--muted);font-size:.9rem;text-transform:uppercase;letter-spacing:.05em;">Discover Posts</h3>
    <div id="explore-feed">${spinner()}</div>
  </div>`;

  setupNavSearch();
  await loadExploreFeed();

  const searchInput = document.getElementById('explore-search');
  let timer;
  searchInput.addEventListener('input', () => {
    clearTimeout(timer);
    const q = searchInput.value.trim();
    const resultsEl = document.getElementById('user-results');
    const feedEl = document.getElementById('explore-feed');
    if (q.length < 2) { resultsEl.style.display = 'none'; resultsEl.innerHTML = ''; feedEl.style.display = 'block'; return; }
    timer = setTimeout(async () => {
      try {
        const res = await users.search(q);
        feedEl.style.display = 'none';
        resultsEl.style.display = 'block';
        if (!res.length) { resultsEl.innerHTML = '<p class="text-muted" style="text-align:center;padding:2rem;">No users found.</p>'; return; }
        resultsEl.innerHTML = `<div class="card">${res.map(u => `
          <div class="user-result-card">
            <div style="cursor:pointer;display:flex;align-items:center;gap:.75rem;flex:1;" onclick="window.appNavigate('/profile?id=${u.id}')">
              ${avatarEl(u, 'md')}
              <div class="user-result-info">
                <div class="user-result-name">${esc(u.fullName)}</div>
                <div class="user-result-handle">@${esc(u.username)}</div>
                ${u.bio ? `<div class="user-result-bio">${esc(u.bio)}</div>` : ''}
              </div>
            </div>
            <button class="btn ${u.followStatus==='accepted'?'btn-outline':u.followStatus==='pending'?'btn-ghost':'btn-primary'} btn-sm" id="follow-btn-${u.id}"
              onclick="toggleFollowBtn('${u.id}', '${u.followStatus||''}')">
              ${u.followStatus==='accepted' ? 'Following' : u.followStatus==='pending' ? '⏳ Requested' : 'Follow'}
            </button>
          </div>`).join('')}</div>`;
      } catch(e) { showToast(e.message, 'error'); }
    }, 400);
  });
}

window.toggleFollowBtn = async (userId, followStatus) => {
  const btn = document.getElementById(`follow-btn-${userId}`);
  btn.disabled = true;
  try {
    if (followStatus === 'accepted' || followStatus === 'pending') {
      await follow.unfollow(userId);
      btn.textContent = 'Follow'; btn.className = 'btn btn-primary btn-sm';
      btn.onclick = () => toggleFollowBtn(userId, '');
    } else {
      await follow.follow(userId);
      btn.textContent = '⏳ Requested'; btn.className = 'btn btn-ghost btn-sm';
      btn.onclick = () => toggleFollowBtn(userId, 'pending');
    }
    showToast(followStatus ? 'Follow request cancelled' : 'Follow request sent!', 'success');
  } catch(e) { showToast(e.message, 'error'); }
  btn.disabled = false;
};

async function loadExploreFeed() {
  const feed = document.getElementById('explore-feed');
  if (!feed) return;
  try {
    const data = await posts.getExplore();
    if (!data.length) { feed.innerHTML = '<div class="empty-state"><i class="ph ph-compass"></i><p>You\'ve seen everything! Follow more people.</p></div>'; return; }
    feed.innerHTML = data.map(p => postCardHtml(p, state.user?.id)).join('');
  } catch(e) { feed.innerHTML = `<p class="text-muted">${e.message}</p>`; }
}

// ── Hashtag Feed ──────────────────────────────────────────────────────
async function renderHashtagFeed() {
  const tag = new URLSearchParams(window.location.search).get('tag') || '';
  app.innerHTML = `
  ${navbar()}
  <div class="container" style="max-width:680px;padding-top:1.5rem;">
    <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:1.5rem;">
      <button class="btn btn-ghost" onclick="history.back()"><i class="ph ph-arrow-left"></i></button>
      <h2 class="hashtag-chip" style="font-size:1.2rem;">#${esc(tag)}</h2>
    </div>
    <div id="hashtag-feed">${spinner()}</div>
  </div>`;
  setupNavSearch();
  try {
    const data = await posts.getByTag(tag);
    const feed = document.getElementById('hashtag-feed');
    if (!data.length) { feed.innerHTML = '<div class="empty-state"><i class="ph ph-hash"></i><p>No posts for this hashtag yet.</p></div>'; return; }
    feed.innerHTML = data.map(p => postCardHtml(p, state.user?.id)).join('');
  } catch(e) { document.getElementById('hashtag-feed').innerHTML = `<p class="text-muted">${e.message}</p>`; }
}

// ── Notifications Page ────────────────────────────────────────────────
async function renderNotifications() {
  app.innerHTML = `
  ${navbar()}
  <div class="container" style="max-width:680px;padding-top:1.5rem;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
      <h2>Notifications</h2>
      <button class="btn btn-ghost btn-sm" onclick="markAllNotifsRead()">Mark all read</button>
    </div>
    <div class="card" id="notif-list">${spinner()}</div>
  </div>`;
  setupNavSearch();
  await loadNotifications();
}

async function loadNotifications() {
  const list = document.getElementById('notif-list');
  try {
    const data = await notifications.getAll();
    await notifications.markRead();
    const dot = document.getElementById('notif-dot');
    if (dot) dot.style.display = 'none';
    if (!data.length) { list.innerHTML = '<div class="empty-state"><i class="ph ph-bell-slash"></i><p>No notifications yet.</p></div>'; return; }
    const iconMap = { like:'ph-heart',comment:'ph-chat-circle',follow:'ph-user-plus',follow_request:'ph-user-plus',follow_accept:'ph-check-circle',repost:'ph-repeat',story_like:'ph-heart' };
    const classMap = { like:'notif-like',comment:'notif-comment',follow:'notif-follow',follow_request:'notif-follow',follow_accept:'notif-follow',repost:'notif-repost',story_like:'notif-like' };
    const textMap = { like:'liked your post',comment:'commented on your post',follow:'started following you',follow_request:'sent you a follow request',follow_accept:'accepted your follow request',repost:'reposted your post',story_like:'liked your story' };
    list.innerHTML = data.map(n => `
      <div class="notification-item ${n.isRead?'':'unread'}" ${n.postId?`onclick="window.appNavigate('/')" style="cursor:pointer;"`:''}>
        <div class="notification-icon ${classMap[n.type]||''}"><i class="ph ${iconMap[n.type]||'ph-bell'}"></i></div>
        <div>
          <div class="notification-text">
            <strong style="cursor:pointer;" onclick="window.appNavigate('/profile?id=${n.actorId}')">${esc(n.actorFullName)}</strong>
            ${textMap[n.type]||n.type}
          </div>
          <div class="notification-time">${timeAgo(n.createdAt)}</div>
        </div>
      </div>`).join('');
  } catch(e) { list.innerHTML = `<p class="text-muted">${e.message}</p>`; }
}

window.markAllNotifsRead = async () => {
  try { await notifications.markRead(); await loadNotifications(); } catch(_) {}
};

// ── Messages Page ─────────────────────────────────────────────────────
async function renderMessages() {
  const params = new URLSearchParams(window.location.search);
  const initUserId = params.get('userId');

  app.innerHTML = `
  ${navbar()}
  <div class="container" style="max-width:1000px;padding-top:1.5rem;">
    <div class="card messages-layout">
      <div class="conversations-list" id="conversations-list">${spinner()}</div>
      <div class="chat-area" id="chat-area">
        <div class="empty-state" style="margin:auto;">
          <i class="ph ph-chat-circle-dots"></i>
          <p>Select a conversation</p>
        </div>
      </div>
    </div>
  </div>`;

  setupNavSearch();
  await loadConversations(initUserId);
  if (initUserId) openChat(initUserId);
}

async function loadConversations(activeId) {
  const list = document.getElementById('conversations-list');
  try {
    const data = await messages.getConversations();
    if (!data.length) {
      list.innerHTML = `<div class="empty-state" style="padding:2rem;"><i class="ph ph-chat-circle-dots"></i><p>No conversations yet.</p><button class="btn btn-primary btn-sm" style="margin-top:.75rem;" onclick="window.appNavigate('/explore')">Find People</button></div>`;
      return;
    }
    list.innerHTML = data.map(c => `
      <div class="conversation-item ${activeId === c.partnerId.toString() ? 'active' : ''}" id="conv-${c.partnerId}" onclick="openChat('${c.partnerId}')">
        ${avatarEl({fullName:c.partnerFullName,profilePicture:c.partnerProfilePicture},'md')}
        <div class="conversation-info">
          <div class="conversation-name">${esc(c.partnerFullName)}</div>
          <div class="conversation-preview">${esc(c.content)}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:.25rem;">
          <span class="conversation-time">${timeAgo(c.createdAt)}</span>
          ${(!c.isRead && c.receiverId===state.user?.id) ? '<span class="unread-badge">!</span>' : ''}
        </div>
      </div>`).join('');
  } catch(e) { list.innerHTML = `<p class="text-muted" style="padding:1rem;">${e.message}</p>`; }
}

let chatUserId = null;
let chatInterval = null;

window.openChat = async (userId) => {
  clearInterval(chatInterval);
  chatUserId = userId;
  document.querySelectorAll('.conversation-item').forEach(el => el.classList.remove('active'));
  const convEl = document.getElementById(`conv-${userId}`);
  if (convEl) convEl.classList.add('active');

  const chatArea = document.getElementById('chat-area');
  chatArea.innerHTML = `<div style="padding:2rem;text-align:center;">${spinner()}</div>`;

  try {
    const profile = await users.getProfile(userId);
    const partnerName = profile.fullName;
    const isBlocked = profile.isBlocked;

    chatArea.innerHTML = `
      <div class="chat-header">
        <button class="btn btn-ghost btn-sm" onclick="window.appNavigate('/profile?id=${userId}')">
          ${avatarEl({fullName:partnerName, profilePicture: profile.profilePicture},'sm')}
        </button>
        <div style="flex:1;">
          <div style="font-weight:600;">${esc(partnerName)}</div>
          <div id="partner-status" class="text-muted" style="font-size:.75rem;"></div>
        </div>
        ${isBlocked ? '' : `<button class="btn btn-ghost btn-sm" onclick="blockUserPermanently('${userId}')" style="color:var(--error);">Block</button>`}
      </div>
      <div class="chat-messages" id="chat-messages-area">${spinner()}</div>
      ${isBlocked ? `<div style="text-align:center;padding:1rem;background:rgba(255,0,0,0.1);color:var(--error);">You have permanently blocked this user.</div>` : `
      <div class="chat-input-area">
        <input class="form-control chat-input" id="chat-msg-input" placeholder="Type a message…">
        <button class="btn btn-primary btn-sm" onclick="sendChatMessage()"><i class="ph ph-paper-plane-tilt"></i></button>
      </div>`}
    `;

    await loadChatMessages(userId);
    chatInterval = setInterval(() => loadChatMessages(userId), 5000);

    const input = document.getElementById('chat-msg-input');
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') sendChatMessage();
      });
    }
  } catch(e) {
    chatArea.innerHTML = `<p class="text-muted" style="padding:2rem;text-align:center;">Error loading chat</p>`;
  }
};

window.blockUserPermanently = async (userId) => {
  if (!confirm('Are you sure you want to permanently block this user? This action cannot be undone.')) return;
  try {
    await users.block(userId);
    showToast('User permanently blocked', 'success');
    document.getElementById(`conv-${userId}`)?.remove();
    openChat(userId);
  } catch (e) {
    showToast(e.message, 'error');
  }
};

async function loadChatMessages(userId) {
  const area = document.getElementById('chat-messages-area');
  if (!area) return;
  const wasAtBottom = area.scrollHeight - area.scrollTop <= area.clientHeight + 60;
  try {
    const data = await messages.getMessages(userId);
    area.innerHTML = data.length ? data.map(m => {
      const isMine = m.senderId === state.user?.id;
      return `<div style="display:flex;flex-direction:column;align-items:${isMine?'flex-end':'flex-start'};">
        <div class="chat-bubble ${isMine?'mine':'theirs'}">${esc(m.content)}</div>
        <div class="${isMine?'chat-time':'chat-theirs-time'}" style="font-size:.68rem;margin:.2rem .5rem;">${timeAgo(m.createdAt)}</div>
      </div>`;
    }).join('') : '<p class="text-muted" style="text-align:center;padding:2rem;">Say hello!</p>';
    if (wasAtBottom) area.scrollTop = area.scrollHeight;
  } catch(_) {}
}

window.sendChatMessage = async () => {
  const input = document.getElementById('chat-msg-input');
  const content = input?.value.trim();
  if (!content || !chatUserId) return;
  input.value = '';
  try {
    await messages.send(chatUserId, { content });
    await loadChatMessages(chatUserId);
    await loadConversations(chatUserId);
  } catch(e) { showToast(e.message, 'error'); }
};

// ── Saved Posts ───────────────────────────────────────────────────────
async function renderSaved() {
  app.innerHTML = `
  ${navbar()}
  <div class="container" style="max-width:680px;padding-top:1.5rem;">
    <h2 style="margin-bottom:1rem;"><i class="ph ph-bookmark-fill" style="color:var(--warning);"></i> Saved Posts</h2>
    <div id="saved-feed">${spinner()}</div>
  </div>`;
  setupNavSearch();
  try {
    const data = await posts.getSaved();
    const feed = document.getElementById('saved-feed');
    if (!data.length) { feed.innerHTML = '<div class="empty-state"><i class="ph ph-bookmark"></i><p>No saved posts yet.<br>Tap the bookmark icon on any post.</p></div>'; return; }
    feed.innerHTML = data.map(p => postCardHtml(p, state.user?.id)).join('');
  } catch(e) { document.getElementById('saved-feed').innerHTML = `<p class="text-muted">${e.message}</p>`; }
}

// ── Follow Requests Page ──────────────────────────────────────────────
async function renderFollowRequests() {
  app.innerHTML = `
  ${navbar()}
  <div class="container" style="max-width:680px;padding-top:1.5rem;">
    <h2 style="margin-bottom:1rem;">Follow Requests</h2>
    <div class="card" id="requests-list">${spinner()}</div>
  </div>`;
  setupNavSearch();
  await loadFollowRequests();
}

async function loadFollowRequests() {
  const list = document.getElementById('requests-list');
  try {
    const data = await follow.getRequests();
    if (!data.length) {
      list.innerHTML = '<div class="empty-state"><i class="ph ph-user-plus"></i><p>No follow requests yet.</p></div>';
      return;
    }
    list.innerHTML = data.map(r => `
      <div class="user-result-card" style="padding:1rem 1.25rem;">
        ${avatarEl({fullName:r.fullName,profilePicture:r.profilePicture},'md')}
        <div class="user-result-info" style="flex:1;">
          <div class="user-result-name">${esc(r.fullName)}</div>
          <div class="user-result-handle">@${esc(r.username)}</div>
          ${r.bio ? `<div class="user-result-bio">${esc(r.bio)}</div>` : ''}
        </div>
        <div style="display:flex;gap:.5rem;">
          <button class="btn btn-primary btn-sm" onclick="acceptFollow('${r.requesterId}')">Accept</button>
          <button class="btn btn-ghost btn-sm" onclick="declineFollow('${r.requesterId}')">Decline</button>
        </div>
      </div>`).join('');
  } catch(e) {
    list.innerHTML = `<p class="text-muted">${e.message}</p>`;
  }
}

window.acceptFollow = async (requesterId) => {
  try {
    await follow.accept(requesterId);
    showToast('Follow request accepted', 'success');
    await loadFollowRequests();
    await loadFeed();
    await loadConversations();
  } catch(e) { showToast(e.message, 'error'); }
};

window.declineFollow = async (requesterId) => {
  try {
    await follow.decline(requesterId);
    showToast('Follow request declined', 'success');
    await loadFollowRequests();
  } catch(e) { showToast(e.message, 'error'); }
};

// ── 404 ───────────────────────────────────────────────────────────────
function render404() {
  app.innerHTML = `
  ${navbar()}
  <div class="empty-state" style="padding:6rem 1rem;">
    <i class="ph ph-ghost"></i>
    <h1 style="font-size:3rem;font-weight:800;margin-bottom:.5rem;">404</h1>
    <p style="margin-bottom:1.5rem;">Page not found</p>
    <button class="btn btn-primary" onclick="window.appNavigate('/')">Go Home</button>
  </div>`;
  setupNavSearch();
}

// ── Init ──────────────────────────────────────────────────────────────
handleRoute();
