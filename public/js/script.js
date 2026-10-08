// Pegamos o formulário e o botão usando o ID que demos a eles
const form = document.getElementById("formRestore");
const botao = form.querySelector("button");

// Escutamos o evento de 'submit' (quando o usuário clica no botão)
form.addEventListener("submit", async (event) => {
  // 1. Evita que a página pisque e recarregue
  event.preventDefault();

  // 2. Muda a aparência do botão para o usuário saber que está processando
  const textoOriginal = botao.innerText;
  botao.innerText = "Restaurando... Aguarde!";
  botao.disabled = true; // Impede que o usuário clique duas vezes

  // 3. Cria um pacote mágico (FormData) que já coleta arquivo, senha e usuário automaticamente
  const formData = new FormData(form);

  try {
    // 4. Envia o pacote para o nosso servidor na rota '/api/restore' (que vamos criar jaja)
    const resposta = await fetch("/api/restore", {
      method: "POST",
      body: formData,
    });

    // 5. Espera a resposta do servidor e lê o que ele disse
    const resultado = await resposta.json();

    if (resultado.sucesso) {
      alert("✅ SUCESSO!\n" + resultado.mensagem);
      form.reset(); // Limpa a tela para uma nova operação
    } else {
      alert("❌ ERRO:\n" + resultado.mensagem);
    }
  } catch (erro) {
    alert("❌ Erro de comunicação com o servidor.");
  } finally {
    // 6. Devolve o botão ao estado normal no final de tudo
    botao.innerText = textoOriginal;
    botao.disabled = false;
  }
});

document.getElementById("btnDesligar").addEventListener("click", async () => {
  if (
    confirm(
      "Tem certeza que deseja desligar o servidor? O sistema ficará fora do ar.",
    )
  ) {
    const resposta = await fetch("/api/desligar", { method: "POST" });
    const resultado = await resposta.json();
    alert(resultado.mensagem);
  }
});

// --- LÓGICA DE EXPORTAÇÃO (BACKUP) ---
const formExport = document.getElementById("formExport");
const botaoExport = formExport.querySelector("button");

formExport.addEventListener("submit", async (event) => {
    event.preventDefault();

    const textoOriginal = botaoExport.innerText;
    botaoExport.innerText = "Extraindo dados... Aguarde!";
    botaoExport.disabled = true;

    const formData = new FormData(formExport);
    // Como não estamos enviando arquivos (só texto), podemos converter para JSON
    const dados = {
        usuario: formData.get("usuario"),
        senha: formData.get("senha")
    };

    try {
        const resposta = await fetch("/api/export", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(dados)
        });

        const resultado = await resposta.json();

        if (resultado.sucesso) {
            alert("✅ SUCESSO!\n" + resultado.mensagem);
            formExport.reset();
        } else {
            alert("❌ ERRO:\n" + resultado.mensagem);
        }
    } catch (erro) {
        alert("❌ Erro de comunicação com o servidor.");
    } finally {
        botaoExport.innerText = textoOriginal;
        botaoExport.disabled = false;
    }
});

// Envia um "ping" para o servidor a cada 3 segundos avisando que a aba está aberta
setInterval(() => {
  fetch("/api/ping").catch(() => {});
}, 3000);
