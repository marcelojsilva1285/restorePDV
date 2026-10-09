const express = require('express');
const multer = require('multer');
const mysql = require('mysql2/promise');
const fs = require('fs');

// Adicionamos o exec para rodar comandos do sistema
const { exec } = require('child_process'); 
const path = require('path'); // <-- ADICIONE ESTA LINHA AQUI

const app = express();
const porta = 3000;

const upload = multer({ dest: 'uploads/' });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.post('/api/restore', upload.single('arquivo'), async (req, res) => {
    const usuario = req.body.usuario;
    const senha = req.body.senha;
    const arquivoPath = req.file.path;

    try {
        // --- PASSO 1: APAGAR E RECRIAR O BANCO ---
        console.log(`[1/3] Conectando como ${usuario} para recriar o banco...`);
        const conexaoInicial = await mysql.createConnection({
            host: 'localhost', 
            user: usuario, 
            password: senha
        });
        await conexaoInicial.query("DROP DATABASE IF EXISTS virtualpdv;");
        await conexaoInicial.query("CREATE DATABASE virtualpdv;");
        await conexaoInicial.end();

        // --- PASSO 2: IMPORTAR OS DADOS DO ARQUIVO (VIA CMD) ---
        console.log(`[2/3] Importando dados... Isso pode levar alguns minutos dependendo do tamanho do arquivo.`);
        
        // Montamos o comando do MySQL igual ao do seu .bat antigo
        // O uso de aspas garante que funcione mesmo se a senha tiver caracteres especiais
        const comandoMySQL = `"C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysql" -u ${usuario} -p"${senha}" virtualpdv < "${arquivoPath}"`;

        // Transformamos a execução do comando em uma Promise para usarmos com async/await
        await new Promise((resolve, reject) => {
            exec(comandoMySQL, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Erro na importação: ${error.message}`);
                    return reject(error);
                }
                resolve();
            });
        });

        // --- PASSO 3: AJUSTE DE PARÂMETROS (RETAGUARDA) ---
        console.log(`[3/3] Ajustando parâmetros de ociosidade...`);
        const conexaoBanco = await mysql.createConnection({
            host: 'localhost', 
            user: usuario, 
            password: senha, 
            database: 'virtualpdv'
        });
        
        const queryUpdate = `
            UPDATE parametro 
            SET VL_PARAMETRO = NULL 
            WHERE CD_PARAMETRO IN (
                'TempoOciosidadeEnvio', 'TempoOciosidadeGeracaoPacote', 
                'TempoOciosidadeProcessamento', 'TempoOciosidadeRecebimento'
            );
        `;
        await conexaoBanco.query(queryUpdate);
        await conexaoBanco.end(); 

        // --- LIMPEZA ---
        fs.unlinkSync(arquivoPath); 
        console.log(`✅ Processo concluído com sucesso!`);

        res.json({ 
            sucesso: true, 
            mensagem: "Banco virtualpdv restaurado e parâmetros ajustados com sucesso!" 
        });

    } catch (erro) {
        console.error("❌ Erro:", erro.message);
        if (fs.existsSync(arquivoPath)) fs.unlinkSync(arquivoPath);
        
        res.json({ 
            sucesso: false, 
            mensagem: "Falha na operação: " + erro.message 
        });
    }
});

// =========================================================
// ROTA DE EXPORTAÇÃO (BACKUP LOCAL COM ABERTURA DE PASTA)
// =========================================================
app.post('/api/export', async (req, res) => {
    emOperacao = true; 
    
    const usuario = req.body.usuario.trim();
    const senha = req.body.senha.trim(); 
    
    // --- NOVO LOCAL DE SALVAMENTO ---
    const pastaDestino = 'C:\\Backups_PDV';
    
    // Se a pasta não existir no Windows do cliente, o Node.js cria automaticamente
    if (!fs.existsSync(pastaDestino)) {
        fs.mkdirSync(pastaDestino, { recursive: true });
    }

    const dataFormatada = new Date().toISOString().replace(/[:.]/g, '-');
    const nomeArquivo = `backup_pdv_${dataFormatada}.sql`;
    
    // Agora o caminho final será C:\Backups_PDV\backup_pdv_data.sql
    const caminhoDestino = path.join(pastaDestino, nomeArquivo);
    // --------------------------------

    try {
        console.log(`\n📦 Iniciando extração do banco como '${usuario}'...`);
        
        // 1. Extrair o banco (mysqldump)
        const comandoDump = `"C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqldump" -h 127.0.0.1 -u ${usuario} -p${senha} virtualpdv > "${caminhoDestino}"`;

        await new Promise((resolve, reject) => {
            exec(comandoDump, (error, stdout, stderr) => {
                if (error) return reject(error);
                resolve();
            });
        });

        console.log(`✅ Backup gerado com sucesso localmente: ${nomeArquivo}`);
        
        // 2. MÁGICA: Abre o explorador de arquivos do Windows já com o backup selecionado
        exec(`explorer.exe /select,"${caminhoDestino}"`);
        
        res.json({ 
            sucesso: true, 
            mensagem: `Backup gerado com sucesso!\n\nArquivo salvo em:\n${caminhoDestino}\n\nA pasta do Windows foi aberta automaticamente para facilitar o envio.` 
        });

    } catch (erro) {
        console.error("❌ Erro:", erro.message);
        // Limpa arquivo corrompido em caso de erro
        if (fs.existsSync(caminhoDestino)) fs.unlinkSync(caminhoDestino);
        
        res.json({ sucesso: false, mensagem: "Falha na operação: " + erro.message });
    } finally {
        emOperacao = false; 
    }
});

// =========================================================
// Rota para desligar o servidor
// =========================================================
app.post('/api/desligar', (req, res) => {
    res.json({ sucesso: true, mensagem: "Servidor desligado com sucesso. Você já pode fechar esta aba." });
    console.log("Encerrando o sistema...");
    setTimeout(() => process.exit(0), 1000); // Aguarda 1 segundo e desliga o Node.js
});

// --- LÓGICA DE DESLIGAMENTO AUTOMÁTICO (HEARTBEAT) ---
let ultimoAcesso = Date.now();
let emOperacao = false;
// Rota que o navegador vai chamar a cada 3 segundos
app.get('/api/ping', (req, res) => {
    ultimoAcesso = Date.now();
    res.send('ok');
});

// O servidor verifica a cada 3 segundos se a página ainda está aberta
setInterval(() => {
    // Se passaram mais de 8 segundos sem o navegador dar "oi", desliga.
    if (!emOperacao && Date.now() - ultimoAcesso > 8000) {
        console.log("Navegador fechado. Desligando o servidor em segundo plano...");
        process.exit(0);
    }
}, 3000);
// -----------------------------------------------------

app.listen(porta, () => {
    console.log(`🚀 Sistema Online rodando! Acesse: http://localhost:${porta}`);
    // Isso faz o Windows abrir o navegador padrão automaticamente
    exec(`start http://localhost:${porta}`);
});

/* 1. Criando um servidor com Node.js e Express

// 1. Importando as ferramentas que instalamos
const express = require('express');

// 2. Criando o nosso aplicativo servidor
const app = express();
const porta = 3000; // O "canal" onde o servidor vai rodar

// 3. Configurando para o servidor entender dados no formato JSON e formulários
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 4. Dizendo ao servidor para expor uma pasta chamada "public" (onde ficará nosso HTML)
app.use(express.static('public'));

// 5. Rota de teste: O que acontece quando acessamos a página principal
app.get('/teste', (req, res) => {
    res.send('Nosso servidor Node.js está vivo e funcionando!');
});

// 6. Ligando o servidor para ele ficar escutando
app.listen(porta, () => {
    console.log(`🚀 Servidor rodando! Acesse: http://localhost:${porta}/teste`);
});

*/