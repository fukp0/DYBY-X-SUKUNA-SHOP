const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

async function initDB() {
    const db = await open({
        filename: './database.sqlite',
        driver: sqlite3.Database
    });

    // Table Utilisateurs
    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT,
            role TEXT DEFAULT 'user'
        );
    `);

    // Table Notifications
    await db.exec(`
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            message TEXT,
            date_created DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Table Produits (Tes bots et tools)
    await db.exec(`
        CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            name TEXT,
            description TEXT,
            price REAL,
            file_path TEXT,
            image_url TEXT
        );
    `);

    // Insérer des produits par défaut avec des images si la table est vide
    const productCount = await db.get('SELECT COUNT(*) as count FROM products');
    if (productCount.count === 0) {
        // J'ai juste remplacé './files/...' par '/files/...' pour correspondre à Express
        await db.run(`INSERT INTO products (id, name, description, price, file_path, image_url) VALUES 
            ('bot_v1', 'Base Bot V1', 'Fichier de base complet pour créer votre propre bot.', 15.00, '/files/bot_v1.zip', 'https://images.unsplash.com/photo-1614680376593-902f74cf0d41?auto=format&fit=crop&w=300&q=80'),
            ('bot_premium', 'Bot Premium', 'Système de niveau, économie, modération.', 35.00, '/files/bot_premium.zip', 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=300&q=80')
        `);
    }

    return db;
}

module.exports = initDB;