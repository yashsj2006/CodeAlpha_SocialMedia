const express = require('express');
const {
  createPost, getPosts, deletePost,
  getStories, getExplorePosts, getHashtagPosts,
  getTrending, repost, viewStory, getStoryStats
} = require('../controllers/postController');
const { likePost, unlikePost } = require('../controllers/likeController');
const { addComment, getComments, deleteComment } = require('../controllers/commentController');
const { savePost, unsavePost, getSavedPosts } = require('../controllers/saveController');
const { likeStory, unlikeStory } = require('../controllers/storyLikeController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

const router = express.Router();

// Posts
router.post('/posts/create', protect, upload.single('image'), createPost);
router.get('/posts', protect, getPosts);
router.delete('/posts/:id', protect, deletePost);

// Stories
router.get('/stories', protect, getStories);
router.post('/stories/:id/view', protect, viewStory);
router.get('/stories/:id/stats', protect, getStoryStats);

// Explore & Hashtags
router.get('/explore', protect, getExplorePosts);
router.get('/hashtag/:tag', protect, getHashtagPosts);
router.get('/trending', protect, getTrending);

// Repost
router.post('/posts/:id/repost', protect, repost);

// Likes
router.post('/posts/:id/like', protect, likePost);
router.post('/posts/:id/unlike', protect, unlikePost);

// Comments
router.post('/posts/:id/comment', protect, addComment);
router.get('/posts/:id/comments', protect, getComments);
router.delete('/comments/:id', protect, deleteComment);

// Story likes
router.post('/stories/:id/like',   protect, likeStory);
router.post('/stories/:id/unlike', protect, unlikeStory);

// Saves
router.post('/posts/:id/save', protect, savePost);
router.post('/posts/:id/unsave', protect, unsavePost);
router.get('/saved', protect, getSavedPosts);

module.exports = router;
