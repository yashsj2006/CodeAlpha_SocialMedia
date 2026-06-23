export const API_URL = `http://${window.location.hostname}:5000`;

export const request = async (endpoint, options = {}) => {
  const token = localStorage.getItem('token');
  const headers = { ...options.headers };

  if (token) headers['Authorization'] = `Bearer ${token}`;

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    if (options.body && typeof options.body === 'object') {
      options.body = JSON.stringify(options.body);
    }
  }

  const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) throw new Error(data.message || 'Something went wrong');
  return data;
};

export const auth = {
  login:    (data) => request('/login',    { method: 'POST', body: data }),
  register: (data) => request('/register', { method: 'POST', body: data }),
  logout:   ()     => request('/logout',   { method: 'GET'  })
};

export const users = {
  getProfile:    (id)   => request(`/profile/${id}`),
  updateProfile: (data) => request('/profile/update', { method: 'PUT', body: data }),
  search:        (q)    => request(`/users/search?q=${encodeURIComponent(q)}`)
};

export const posts = {
  getFeed:    ()     => request('/posts'),
  getExplore: ()     => request('/explore'),
  getStories: ()     => request('/stories'),
  getByTag:   (tag)  => request(`/hashtag/${tag}`),
  getTrending: ()    => request('/trending'),
  create:     (data) => request('/posts/create', { method: 'POST', body: data }),
  delete:     (id)   => request(`/posts/${id}`,  { method: 'DELETE' }),
  like:       (id)   => request(`/posts/${id}/like`,   { method: 'POST' }),
  unlike:     (id)   => request(`/posts/${id}/unlike`, { method: 'POST' }),
  repost:     (id)   => request(`/posts/${id}/repost`, { method: 'POST' }),
  save:       (id)   => request(`/posts/${id}/save`,   { method: 'POST' }),
  unsave:     (id)   => request(`/posts/${id}/unsave`, { method: 'POST' }),
  getSaved:   ()     => request('/saved'),
  likeStory:   (id)  => request(`/stories/${id}/like`,   { method: 'POST' }),
  unlikeStory: (id)  => request(`/stories/${id}/unlike`, { method: 'POST' }),
  viewStory:   (id)  => request(`/stories/${id}/view`,   { method: 'POST' }),
  getStoryStats: (id) => request(`/stories/${id}/stats`)
};

export const comments = {
  getForPost: (postId) => request(`/posts/${postId}/comments`),
  add:        (postId, data) => request(`/posts/${postId}/comment`, { method: 'POST', body: data }),
  delete:     (id)           => request(`/comments/${id}`,           { method: 'DELETE' })
};

export const follow = {
  follow:   (id) => request(`/follow/${id}`,         { method: 'POST' }),
  accept:   (id) => request(`/follow/${id}/accept`,  { method: 'POST' }),
  decline:  (id) => request(`/follow/${id}/decline`, { method: 'POST' }),
  unfollow: (id) => request(`/unfollow/${id}`,       { method: 'POST' }),
  getRequests: () => request('/follow-requests')
};

export const notifications = {
  getAll:        () => request('/notifications'),
  markRead:      () => request('/notifications/read',         { method: 'PUT' }),
  getUnreadCount: () => request('/notifications/unread-count')
};

export const messages = {
  getConversations: ()         => request('/messages'),
  getMessages:      (userId)   => request(`/messages/${userId}`),
  send:             (userId, data) => request(`/messages/${userId}`, { method: 'POST', body: data }),
  getUnreadCount:   ()         => request('/messages/unread-count')
};
