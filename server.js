const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const initDB = require('./db');
const { createOrder, captureOrder } = require('./paypal');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const SECRET_KEY = "dybyxsukuna"; 
let db;

initDB().then(database => {
    db = database;
    console.log("✅ Base de données chargée !");
});

// --- MIDDLEWARES ---
function verifyToken(req, res, next) {
    const token = req.headers['authorization']?.split(" ")[1];
    if (!token) return res.status(403).json({ error: "Non connecté." });

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return res.status(401).json({ error: "Token invalide." });
        req.user = decoded;
        next();
    });
}

function isAdmin(req, res, next) {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Accès refusé." });
    next();
}

// --- ROUTES AUTHENTIFICATION ---
app.post('/api/signup', async (req, res) => {
    const { username, password } = req.body;
    const hash = await bcrypt.hash(password, 10);
    try {
        await db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hash]);
        res.json({ success: true, message: "Compte créé !" });
    } catch (e) { res.status(400).json({ error: "Pseudo déjà pris." }); }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(400).json({ error: "Identifiants incorrects." });
    }
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, SECRET_KEY);
    res.json({ success: true, token, role: user.role });
});

// --- ROUTES BOUTIQUE --- (Modifiée pour récupérer l'image)
app.get('/api/products', async (req, res) => {
    // On sélectionne maintenant aussi l'image_url
    const products = await db.all('SELECT id, name, description, price, image_url FROM products');
    res.json(products);
});

// --- ROUTES ADMIN ---

// (NOUVEAU) Ajouter un nouveau produit
app.post('/api/admin/products/add', verifyToken, isAdmin, async (req, res) => {
    const { id, name, description, price, file_path, image_url } = req.body;
    
    if (!id || !name || !price) {
        return res.status(400).json({ error: "L'ID, le nom et le prix sont obligatoires." });
    }

    try {
        await db.run(
            'INSERT INTO products (id, name, description, price, file_path, image_url) VALUES (?, ?, ?, ?, ?, ?)', 
            [id, name, description, price, file_path, image_url]
        );
        res.json({ success: true, message: "Produit ajouté avec succès !" });
    } catch (error) {
        // Si l'ID existe déjà, SQLite va renvoyer une erreur
        res.status(500).json({ error: "Erreur : Cet ID de produit existe peut-être déjà." });
    }
});

// (MODIFIÉ) Mettre à jour un produit existant pour inclure l'image
app.post('/api/admin/products', verifyToken, isAdmin, async (req, res) => {
    const { id, name, description, price, image_url } = req.body;
    await db.run(
        'UPDATE products SET name = ?, description = ?, price = ?, image_url = ? WHERE id = ?', 
        [name, description, price, image_url, id]
    );
    res.json({ success: true, message: "Produit mis à jour !" });
});

app.post('/api/buy', verifyToken, async (req, res) => {
    const { productId } = req.body;
    const product = await db.get('SELECT * FROM products WHERE id = ?', [productId]);
    
    if (!product) return res.status(404).json({ error: "Produit introuvable." });

    try {
        const order = await createOrder(
            product, 
            'https://dyby-x-sukuna-shop-production.up.railway.app/success.html', // À créer plus tard (page de succès)
            'https://dyby-x-sukuna-shop-production.up.railway.app/'
        );
        res.json(order);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// --- VALIDER LE PAIEMENT ET DONNER LE FICHIER ---
app.post('/api/capture', verifyToken, async (req, res) => {
    const { orderId, productId } = req.body;

    try {
        // 1. On dit à PayPal de capturer l'argent
        const captureResult = await captureOrder(orderId);

        // 2. On vérifie si le paiement est bien "COMPLETED" (Terminé)
        if (captureResult.status === 'COMPLETED') {
            
            // 3. On récupère le chemin du fichier dans la base de données
            const product = await db.get('SELECT file_path FROM products WHERE id = ?', [productId]);
            
            if (product && product.file_path) {
                // Succès ! On renvoie le lien de téléchargement au client
                res.json({ 
                    success: true, 
                    message: "Paiement réussi !", 
                    downloadUrl: product.file_path 
                });
            } else {
                res.status(404).json({ error: "Fichier introuvable après paiement." });
            }
        } else {
            res.status(400).json({ error: "Le paiement n'a pas abouti." });
        }
    } catch (error) {
        console.error("Erreur capture PayPal:", error);
        res.status(500).json({ error: "Erreur lors de la validation du paiement." });
    }
});

// --- ROUTES ADMIN ---
app.post('/api/admin/notifications', verifyToken, isAdmin, async (req, res) => {
    await db.run('INSERT INTO notifications (title, message) VALUES (?, ?)', [req.body.title, req.body.message]);
    res.json({ success: true, message: "Annonce envoyée !" });
});



app.listen(3000, () => console.log('🚀 Serveur web sur http://localhost:3000'));



