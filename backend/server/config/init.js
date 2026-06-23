const mysql = require('mysql2/promise');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

async function initDB() {
  try {
    console.log('Connecting to MySQL to initialize database...');
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || ''
    });

    const dbName = process.env.DB_NAME || 'connectsphere';

    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
    await connection.query(`USE \`${dbName}\`;`);

    // Create Users table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS Users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        username VARCHAR(255) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        bio TEXT,
        profile_picture VARCHAR(255) DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create Posts table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS Posts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
      );
    `);

    // Create Comments table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS Comments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        post_id INT NOT NULL,
        user_id INT NOT NULL,
        comment TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (post_id) REFERENCES Posts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
      );
    `);

    // Create Likes table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS Likes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        post_id INT NOT NULL,
        user_id INT NOT NULL,
        UNIQUE KEY unique_like (post_id, user_id),
        FOREIGN KEY (post_id) REFERENCES Posts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
      );
    `);

    // Create Followers table (with status for follow requests)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS Followers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        follower_id INT NOT NULL,
        following_id INT NOT NULL,
        status ENUM('pending','accepted') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_follow (follower_id, following_id),
        FOREIGN KEY (follower_id) REFERENCES Users(id) ON DELETE CASCADE,
        FOREIGN KEY (following_id) REFERENCES Users(id) ON DELETE CASCADE
      );
    `);
    // Add status column if upgrading existing table (MySQL doesn't support IF NOT EXISTS for ADD COLUMN)
    try {
      await connection.query(`ALTER TABLE Followers ADD COLUMN status ENUM('pending','accepted') DEFAULT 'pending'`);
    } catch(e) {}
    try {
      await connection.query(`ALTER TABLE Followers ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
    } catch(e) {}

    // Add extra columns to existing tables
    try {
      await connection.query(`ALTER TABLE Users ADD COLUMN last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`);
    } catch(e) {}
    try {
      await connection.query(`ALTER TABLE Posts ADD COLUMN image_url VARCHAR(500) DEFAULT NULL`);
    } catch(e) {}
    try {
      await connection.query(`ALTER TABLE Posts ADD COLUMN is_story TINYINT(1) DEFAULT 0`);
    } catch(e) {}
    try {
      await connection.query(`ALTER TABLE Posts ADD COLUMN expires_at TIMESTAMP NULL DEFAULT NULL`);
    } catch(e) {}

    // Saves table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS Saves (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        post_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_save (user_id, post_id),
        FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
        FOREIGN KEY (post_id) REFERENCES Posts(id) ON DELETE CASCADE
      );
    `);

    // Notifications table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS Notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        actor_id INT NOT NULL,
        type ENUM('like','comment','follow','repost','follow_request','follow_accept','story_like') NOT NULL,
        post_id INT DEFAULT NULL,
        is_read TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
        FOREIGN KEY (actor_id) REFERENCES Users(id) ON DELETE CASCADE,
        FOREIGN KEY (post_id) REFERENCES Posts(id) ON DELETE SET NULL
      );
    `);

    // Messages table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS Messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sender_id INT NOT NULL,
        receiver_id INT NOT NULL,
        content TEXT NOT NULL,
        is_read TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sender_id) REFERENCES Users(id) ON DELETE CASCADE,
        FOREIGN KEY (receiver_id) REFERENCES Users(id) ON DELETE CASCADE
      );
    `);

    // Hashtags table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS Hashtags (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tag VARCHAR(100) NOT NULL UNIQUE
      );
    `);

    // PostHashtags pivot
    await connection.query(`
      CREATE TABLE IF NOT EXISTS PostHashtags (
        id INT AUTO_INCREMENT PRIMARY KEY,
        post_id INT NOT NULL,
        hashtag_id INT NOT NULL,
        UNIQUE KEY unique_post_tag (post_id, hashtag_id),
        FOREIGN KEY (post_id) REFERENCES Posts(id) ON DELETE CASCADE,
        FOREIGN KEY (hashtag_id) REFERENCES Hashtags(id) ON DELETE CASCADE
      );
    `);

    // Shares table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS Shares (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        original_post_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
        FOREIGN KEY (original_post_id) REFERENCES Posts(id) ON DELETE CASCADE
      );
    `);

    // Story Likes table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS StoryLikes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        post_id INT NOT NULL,
        user_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_story_like (post_id, user_id),
        FOREIGN KEY (post_id) REFERENCES Posts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
      );
    `);

    // Story Views table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS StoryViews (
        id INT AUTO_INCREMENT PRIMARY KEY,
        post_id INT NOT NULL,
        user_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_story_view (post_id, user_id),
        FOREIGN KEY (post_id) REFERENCES Posts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
      );
    `);

    console.log('Database and tables initialized successfully.');
    await connection.end();
  } catch (error) {
    console.error('Error initializing database:', error.message);
    process.exit(1);
  }
}

initDB();
