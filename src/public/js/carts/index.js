/* ************************************************************************** */
/* /src/public/js/carts/index.js - .js de /src/views/carts.handlebars */
/* ************************************************************************** */
const socket = io();

const deleteCartRow = (pid) => {
  console.log('pid', pid);
  const documentRow = document.getElementById(pid);
  if (documentRow) {
    documentRow.remove();
  }
};
const updateTotalCartProducts = (total) => {
  const totalProductosCarrito = document.getElementById('totalProductosCarrito');
  if (totalProductosCarrito) {
    totalProductosCarrito.textContent = total;
  }
};
socket.on('deleteCartProduct', deleteCartRow);
socket.on('updateTotalCartProducts', updateTotalCartProducts);

/* ************************************************************************** */
const cartDivId = document.getElementById('cartDivId');

const cartId = cartDivId.getAttribute('data-cart-id');

console.log('cartIdDiv', cartId);

const deleteCartProduct = (pid) => {
  console.log('pid', pid);
  fetch(`/api/carts/${cartId}/product/${pid}`, {
    method: 'DELETE',
  })
    .then((response) => {
      if (response.ok) {
        socket.emit('deleteCartProduct', pid);
        console.log('delete running');
        /*         window.location.reload(); */
      } else {
        console.error('Error al eliminar el producto');
      }
    })
    .catch((error) => {
      console.error('Error al eliminar el producto:', error);
    });
};
// Función para mostrar el SweetAlert
function mostrarSweetAlert() {
  swal('¡Compra realizada!', 'Revise su casilla de correo electrónico para más detalles.', 'success').then(function () {
    // Redirigir al usuario a la página de productos
    window.location.href = '/products';
  });
}

// Agrega un evento submit al formulario de compra
document.querySelector('form[action$="/purchasecart"]').addEventListener('submit', function (event) {
  event.preventDefault(); // Evitar que se envíe el formulario de forma predeterminada

  // Realizar la solicitud POST al servidor (puede usar fetch o axios)
  fetch(this.action, {
    method: 'POST',
    body: new FormData(this),
  })
    .then((response) => {
      if (response.ok) {
        // La compra se realizó con éxito, mostrar SweetAlert y redirigir
        mostrarSweetAlert();
      } else {
        // La compra falló, mostrar un mensaje de error
        swal('Error', 'Hubo un problema al realizar la compra. Inténtelo de nuevo más tarde.', 'error');
      }
    })
    .catch((error) => {
      // Error en la solicitud, mostrar mensaje de error
      swal('Error', 'Hubo un problema al realizar la compra. Inténtelo de nuevo más tarde.', 'error');
    });
});
