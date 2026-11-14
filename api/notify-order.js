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

    let notificacaoRef;

    try {

        const { orderId } = req.body || {};

        if (
            !orderId ||
            typeof orderId !== "string" ||
            !/^[a-zA-Z0-9_-]+$/.test(orderId)
        ) {
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
        const idade = Date.now() - Number(encomenda.data);

        if (
            !encomenda.data ||
            !Number.isFinite(Number(encomenda.data)) ||
            idade < 0 ||
            idade > 180000
        ) {
            return res.status(400).json({
                error: "Encomenda fora do período permitido."
            });
        }

        // Controlar notificações sem alterar a encomenda
        notificacaoRef = db.ref(
            "notificacoesEnviadas/" + orderId
        );

        const resultado = await notificacaoRef.transaction(valor => {
            if (valor) return;
            return "enviando";
        });

        if (!resultado.committed) {
            return res.status(200).json({
                message: "Esta encomenda já foi notificada."
            });
        }

        // Procurar o dispositivo do administrador
        const uid = process.env.ADMIN_UID;

        if (!uid) {
            await notificacaoRef.remove();

            return res.status(500).json({
                error: "UID do administrador não configurado."
            });
        }

        const tokenSnapshot = await db
            .ref("adminPushTokens/" + uid)
            .once("value");

        const token = tokenSnapshot.val();

        if (!token) {
            await notificacaoRef.remove();

            return res.status(404).json({
                error: "Nenhum dispositivo registado."
            });
        }

        // Preparar a notificação
        const titulo = "Nova encomenda na Orkap!";
        const mensagem =
            "Recebeste a encomenda " + (encomenda.numero || "");

        // Enviar notificação
        await admin.messaging().send({
            token: token,

            notification: {
                title: titulo,
                body: mensagem
            },

            data: {
                title: titulo,
                body: mensagem,
                url: "/admin.html"
            },

            webpush: {
                headers: {
                    Urgency: "high"
                },

                fcmOptions: {
                    link: "https://orkap.vercel.app/admin.html"
                }
            }
        });

        await notificacaoRef.set(true);

        return res.status(200).json({
            success: true,
            message: "Notificação enviada."
        });

    } catch (error) {

        if (notificacaoRef) {
            await notificacaoRef.remove().catch(() => {});
        }

        console.error("Erro na notificação:", error);

        return res.status(500).json({
            error: "Não foi possível enviar a notificação."
        });
    }
};