const mysql = require('mysql2/promise');

async function fixDB() {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '12345',
      database: 'connectsphere'
    });
    
    await connection.query("ALTER TABLE Notifications MODIFY COLUMN type ENUM('like','comment','follow','repost','follow_request','follow_accept','story_like') NOT NULL");
    console.log('Fixed ENUM');
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
fixDB();
