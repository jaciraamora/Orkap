const admin = require("firebase-admin");

if (!admin.apps.length) {
    const serviceAccount = JSON.parse(
        process.env.FIREBASE_SERVICE_ACCOUNT
    );

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://orkap-d13c6-default-rtdb.firebaseio.com"
    });
}

module.exports = async (req, res) => {

    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Método não permitido."
        });
    }

    try {

        const { orderId } = req.body || {};

        if (!orderId || typeof orderId !== "string") {
            return res.status(400).json({
                error: "Identificador da encomenda inválido."
            });
        }

        const db = admin.database();

        // Procurar a encomenda
        const orderRef = db.ref("encomendas/" + orderId);
        const snapshot = await orderRef.once("value");

        if (!snapshot.exists()) {
            return res.status(404).json({
                error: "Encomenda não encontrada."
            });
        }

        const encomenda = snapshot.val();

        // Aceitar apenas encomendas recentes
        const idade = Date.now() - encomenda.data;

        if (!encomenda.data || idade < 0 || idade > 180000) {
            return res.status(400).json({
                error: "Encomenda fora do período permitido."
            });
        }

        // Evitar notificações repetidas
        const notificacaoRef = orderRef.child("_notificacaoEnviada");

        const resultado = await notificacaoRef.transaction(valor => {
            if (valor === true) return;
            return true;
        });

        if (!resultado.committed) {
            return res.status(200).json({
                message: "Esta encomenda já foi notificada."
            });
        }

        // Procurar o dispositivo do administrador
        const uid = process.env.ADMIN_UID;

        const tokenSnapshot = await db
            .ref("adminPushTokens/" + uid)
            .once("value");

        const token = tokenSnapshot.val();

        if (!token) {
            await notificacaoRef.set(false);

            return res.status(404).json({
                error: "Nenhum dispositivo registado."
            });
        }

        // Enviar notificação
        await admin.messaging().send({
            token: token,

            data: {
                title: "Nova encomenda na Orkap!",
                body: "Recebeste a encomenda " + encomenda.numero,
                url: "/admin.html"
            },

            webpush: {
                headers: {
                    Urgency: "high"
                }
            }
        });

        return res.status(200).json({
            success: true,
            message: "Notificação enviada."
        });

    } catch (error) {

        console.error("Erro na notificação:", error);

        return res.status(500).json({
            error: "Não foi possível enviar a notificação."
        });
    }
};
