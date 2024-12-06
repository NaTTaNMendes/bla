import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getFirestore, collection, addDoc, doc, getDoc, updateDoc, query, where, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDSr_WmM4cfgXxPqwTapGxmHs9TY6oI564",
  authDomain: "devs2blu-2fa57.firebaseapp.com",
  projectId: "devs2blu-2fa57",
  storageBucket: "devs2blu-2fa57.firebasestorage.app",
  messagingSenderId: "674048186497",
  appId: "1:674048186497:web:deb18042570a0f8adb1580",
  measurementId: "G-SZ4NREM00L"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
fetchAndDisplayProducts();

// State
let cart = [];
let tempUserId = '2jkLphbnOFAs3PnVMQ2i'; // Usuário temporário
let tempCartId = null; // ID do carrinho

// DOM Elements
const productGrid = document.getElementById('productGrid');
const cartItems = document.getElementById('cartItems');
initializeTempCart();

async function initializeTempCart() {
  try {
    // Obter a referência do usuário
    const userRef = doc(db, "usuarios", tempUserId);

    // Criar um carrinho associado ao usuário (referência)
    const cart = {
      comprador: userRef,  // Agora é uma referência ao documento do usuário
      total: 0,
      itens: [],
    };

    // Adicionar o carrinho ao Firestore
    const cartRef = await addDoc(collection(db, "carrinho"), cart);
    tempCartId = cartRef.id;

    logMessage(`Carrinho temporário criado com ID: ${tempCartId}`);
  } catch (error) {
    logMessage(`Erro ao inicializar carrinho: ${error.message}`);
  }
}

async function fetchAndDisplayProducts() {
  try {
    const querySnapshot = await getDocs(collection(db, "produtos"));
    const productGrid = document.getElementById('productGrid');

    productGrid.innerHTML = querySnapshot.docs.map(doc => {
      const product = doc.data();
      return `
        <div class="product-card">
          <div class="product-info">
            <h2 class="product-title">${product.nome}</h2>
            <p>Estoque: ${product.estoque}</p>
            <div class="product-price">R$ ${product.preco.toFixed(2)}</div>
            <button 
              class="add-to-cart" 
              data-id="${doc.id}" 
              ${product.estoque === 0 ? "disabled" : ""}>
              ${product.estoque === 0 ? "Indisponível" : "Adicionar ao Carrinho"}
            </button>
          </div>
        </div>
      `;
    }).join('');
  } catch (error) {
    logMessage(`Erro ao buscar produtos: ${error.message}`);
  }
}

function logMessage(message) {
  const logContent = document.getElementById('logContent');
  logContent.textContent += `${message}\n\n`;
}

window.addUser = async function() {
  const user = {
    email: "usuario@example.com",
    nome: "Usuário Exemplo"
  };

  try {
    const docRef = await addDoc(collection(db, "usuarios"), user);
    logMessage(`Usuário adicionado com ID: ${docRef.id}`);
  } catch (error) {
    logMessage(`Erro ao adicionar usuário: ${error.message}`);
  }
};

async function addToCart(productId) {
  try {
    const productRef = doc(db, "produtos", productId);
    const productSnap = await getDoc(productRef);

    if (productSnap.exists()) {
      const productData = productSnap.data();

      if (productData.estoque > 0) {
        // Atualizar estoque no Firebase
        await updateDoc(productRef, {
          estoque: productData.estoque - 1,
        });

        // Adicionar ou atualizar item no carrinho
        const cartRef = doc(db, "carrinho", tempCartId);
        const cartSnap = await getDoc(cartRef);

        if (cartSnap.exists()) {
          const cartData = cartSnap.data();

          // Verificar se o item já existe no carrinho
          const existingItemIndex = cartData.itens.findIndex(item => item.produtoId === productId);
          let updatedItems = [...cartData.itens];

          if (existingItemIndex !== -1) {
            // Atualizar a quantidade do item existente
            updatedItems[existingItemIndex].quantidade += 1;
          } else {
            // Adicionar novo item ao carrinho
            updatedItems.push({
              produtoId: productId,
              nome: productData.nome,
              preco: productData.preco,
              quantidade: 1,
            });
          }

          // Recalcular o total
          const updatedTotal = updatedItems.reduce((sum, item) => sum + item.preco * item.quantidade, 0);

          // Atualizar o carrinho no Firebase
          await updateDoc(cartRef, {
            itens: updatedItems,
            total: updatedTotal,
          });

          logMessage(`Produto "${productData.nome}" atualizado no carrinho.`);
          fetchAndDisplayProducts(); // Atualiza a UI
        } else {
          logMessage("Carrinho não encontrado.");
        }
      } else {
        logMessage(`Produto "${productData.nome}" está fora de estoque.`);
      }
    } else {
      logMessage("Produto não encontrado.");
    }
  } catch (error) {
    logMessage(`Erro ao adicionar produto ao carrinho: ${error.message}`);
  }
}

document.getElementById('productGrid').addEventListener('click', (e) => {
  if (e.target.classList.contains('add-to-cart')) {
    const productId = e.target.dataset.id;
    addToCart(productId);
  }
});

window.getAllCarts = async function() {
  try {
    const querySnapshot = await getDocs(collection(db, "carrinho"));
    const allCarts = [];
    querySnapshot.forEach(doc => {
      allCarts.push({ id: doc.id, ...doc.data() });
    });
    logMessage(`Carrinhos:\n${JSON.stringify(allCarts, null, 2)}`);
  } catch (error) {
    logMessage(`Erro ao listar carrinhos: ${error.message}`);
  }
};
window.getUserCart = async function(userId) {
  const q = query(collection(db, "carrinho"), where("comprador", "==", doc(db, "usuarios", userId)));
  const querySnapshot = await getDocs(q);
  const userCart = [];
  querySnapshot.forEach((doc) => {
    userCart.push({ id: doc.id, ...doc.data() });
  });
  logMessage(JSON.stringify(userCart, null, 2));
}

window.getCartTotal = async function(cartId) {
  try {
    const cartRef = doc(db, "carrinho", cartId);
    const cartSnap = await getDoc(cartRef);

    if (cartSnap.exists()) {
      const cartData = cartSnap.data();
      const total = cartData.total;  // Pega o total diretamente do banco

      logMessage(`O total do carrinho ${cartId} é R$${total.toFixed(2)}`);
    } else {
      logMessage("Carrinho não encontrado.");
    }
  } catch (error) {
    logMessage(`Erro ao pegar o total do carrinho: ${error.message}`);
  }
}

window.atualizarQuantidadeCompra = async function(cartId, itemId, novaQuantidade) {
  try {
    const compraRef = doc(db, "carrinho", cartId);

    const compraSnap = await getDoc(compraRef);
    if (compraSnap.exists()) {
      const compraData = compraSnap.data();
      const itens = compraData.itens;

      // Encontrar o item no carrinho com base no ID do produto
      const itemIndex = itens.findIndex(item => item.produtoId === itemId); // itemId é agora o ID do documento do produto
      if (itemIndex !== -1) {
        // Atualizar a quantidade do item encontrado
        itens[itemIndex].quantidade = parseInt(novaQuantidade);

        // Atualizar o carrinho no Firestore
        await updateDoc(compraRef, {
          itens: itens
        });

        logMessage(`Quantidade do produto com ID ${itemId} atualizada para ${novaQuantidade}.`);
      } else {
        logMessage("Item não encontrado.");
      }
    } else {
      logMessage("Carrinho não encontrado.");
    }
  } catch (error) {
    logMessage("Erro ao atualizar a quantidade: ", error);
  }
}

window.deleteEmptyCarts = async function () {
  try {
    // Fazer a consulta para buscar carrinhos com total igual a 0
    const q = query(collection(db, "carrinho"), where("total", "==", 0));
    const querySnapshot = await getDocs(q);

    // Verificar se há carrinhos com total igual a 0
    if (!querySnapshot.empty) {
      // Excluir os carrinhos
      querySnapshot.forEach(async (doc) => {
        await deleteDoc(doc.ref);  // Deletar o carrinho
        logMessage(`Carrinho com ID: ${doc.id} deletado com sucesso!`);
      });
    } else {
      logMessage("Nenhum carrinho vazio encontrado.");
    }
  } catch (error) {
    logMessage(`Erro ao deletar carrinhos: ${error.message}`);
  }
}