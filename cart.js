/**
 * cart.js — Shared cart module for Ormidia Car Accessories
 * Injects the cart drawer into any page that includes this script.
 * Exposes window.Cart API for adding/removing/updating items.
 */

(function () {
  const CART_KEY = 'ormidia_cart';

  /* ─── DATA ─── */
  function load() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
    catch { return []; }
  }
  function save(items) {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  }

  const Cart = {
    getItems() { return load(); },

    addItem(product, variant) {
      const items = load();
      const key = variant ? `${product.id}_${variant.id}` : `${product.id}`;
      const existing = items.find(i => i.key === key);
      if (existing) {
        existing.quantity += 1;
      } else {
        items.push({
          key,
          product_id: product.id,
          name: product.name,
          variant_id: variant?.id || null,
          variant_name: variant?.variant_name || null,
          price: variant?.price ?? product.base_price,
          image: null, // set by caller if needed
          quantity: 1,
        });
      }
      save(items);
      Cart._refresh();
    },

    removeItem(key) {
      save(load().filter(i => i.key !== key));
      Cart._refresh();
    },

    updateQty(key, delta) {
      const items = load().map(i => {
        if (i.key === key) {
          i.quantity = Math.max(1, i.quantity + delta);
        }
        return i;
      });
      save(items);
      Cart._refresh();
    },

    clear() {
      save([]);
      Cart._refresh();
    },

    getTotal() {
      return load().reduce((s, i) => s + i.price * i.quantity, 0);
    },

    getCount() {
      return load().reduce((s, i) => s + i.quantity, 0);
    },

    /* ─── UI ─── */
    open() {
      document.getElementById('cart-drawer')?.classList.add('open');
      document.getElementById('cart-overlay')?.classList.add('show');
      document.body.style.overflow = 'hidden';
      Cart._renderDrawer();
    },

    close() {
      document.getElementById('cart-drawer')?.classList.remove('open');
      document.getElementById('cart-overlay')?.classList.remove('show');
      document.body.style.overflow = '';
    },

    _refresh() {
      // Update badge counts
      const count = Cart.getCount();
      document.querySelectorAll('.cart-badge').forEach(el => {
        el.textContent = count;
        el.style.display = count > 0 ? 'flex' : 'none';
      });
      // Re-render drawer contents if open
      if (document.getElementById('cart-drawer')?.classList.contains('open')) {
        Cart._renderDrawer();
      }
    },

    _renderDrawer() {
      const items = load();
      const body = document.getElementById('cart-drawer-body');
      const footer = document.getElementById('cart-drawer-footer');
      if (!body || !footer) return;

      if (items.length === 0) {
        body.innerHTML = `
          <div class="cart-empty">
            <i class="fas fa-shopping-cart"></i>
            <p>Your cart is empty</p>
            <a href="products.html" onclick="Cart.close()">Browse Products</a>
          </div>`;
        footer.innerHTML = '';
        return;
      }

      body.innerHTML = items.map(item => `
        <div class="cart-item" data-key="${item.key}">
          <div class="cart-item-info">
            <div class="cart-item-name">${escHtml(item.name)}</div>
            ${item.variant_name ? `<div class="cart-item-variant">${escHtml(item.variant_name)}</div>` : ''}
            <div class="cart-item-price">€${(item.price * item.quantity).toFixed(2)}</div>
          </div>
          <div class="cart-item-controls">
            <button class="qty-btn" onclick="Cart.updateQty('${item.key}', -1)">−</button>
            <span class="qty-val">${item.quantity}</span>
            <button class="qty-btn" onclick="Cart.updateQty('${item.key}', 1)">+</button>
            <button class="remove-btn" onclick="Cart.removeItem('${item.key}')" title="Remove">
              <i class="fas fa-times"></i>
            </button>
          </div>
        </div>`).join('');

      const total = Cart.getTotal();
      footer.innerHTML = `
        <div class="cart-total">
          <span>Total</span>
          <span class="cart-total-price">€${total.toFixed(2)}</span>
        </div>
        <a href="checkout.html" class="btn-checkout">
          <i class="fas fa-lock"></i> Checkout
        </a>
        <button class="btn-clear-cart" onclick="Cart.clear()">Clear cart</button>`;
    },
  };

  function escHtml(str) {
    return String(str || '').replace(/[&<>"']/g, m =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }

  /* ─── INJECT HTML ─── */
  function inject() {
    // Overlay
    const overlay = document.createElement('div');
    overlay.id = 'cart-overlay';
    overlay.onclick = () => Cart.close();
    document.body.appendChild(overlay);

    // Drawer
    const drawer = document.createElement('div');
    drawer.id = 'cart-drawer';
    drawer.innerHTML = `
      <div class="cart-drawer-header">
        <div class="cart-drawer-title">
          <i class="fas fa-shopping-cart"></i> Your Cart
          <span id="cart-drawer-count" class="cart-drawer-count"></span>
        </div>
        <button class="cart-drawer-close" onclick="Cart.close()">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="cart-drawer-body" id="cart-drawer-body"></div>
      <div class="cart-drawer-footer" id="cart-drawer-footer"></div>`;
    document.body.appendChild(drawer);

    // Styles
    const style = document.createElement('style');
    style.textContent = `
      #cart-overlay {
        display: none; position: fixed; inset: 0;
        background: rgba(0,0,0,0.45); backdrop-filter: blur(4px);
        z-index: 9000;
      }
      #cart-overlay.show { display: block; }

      #cart-drawer {
        position: fixed; top: 0; right: -420px; width: 420px; max-width: 100vw;
        height: 100vh; background: #fff;
        box-shadow: -8px 0 40px rgba(0,0,0,0.15);
        z-index: 9100; display: flex; flex-direction: column;
        transition: right 0.35s cubic-bezier(0.4,0,0.2,1);
        font-family: 'Barlow Condensed', sans-serif;
      }
      #cart-drawer.open { right: 0; }

      .cart-drawer-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 20px 24px; border-bottom: 1.5px solid #e4e7ec;
        flex-shrink: 0;
      }
      .cart-drawer-title {
        font-family: 'Rajdhani', sans-serif; font-size: 18px; font-weight: 700;
        letter-spacing: 1.5px; text-transform: uppercase; color: #1a1a1a;
        display: flex; align-items: center; gap: 10px;
      }
      .cart-drawer-title i { color: #D0021B; }
      .cart-drawer-count {
        background: #D0021B; color: #fff;
        font-size: 11px; font-weight: 700; letter-spacing: 1px;
        padding: 2px 8px; border-radius: 20px;
      }
      .cart-drawer-close {
        background: #f7f8fa; border: 1px solid #e4e7ec;
        width: 36px; height: 36px; border-radius: 4px;
        cursor: pointer; font-size: 16px; color: #374151;
        display: flex; align-items: center; justify-content: center;
        transition: background 0.2s, color 0.2s;
      }
      .cart-drawer-close:hover { background: #D0021B; color: #fff; border-color: #D0021B; }

      .cart-drawer-body {
        flex: 1; overflow-y: auto; padding: 16px 24px;
      }
      .cart-drawer-body::-webkit-scrollbar { width: 4px; }
      .cart-drawer-body::-webkit-scrollbar-thumb { background: #e4e7ec; border-radius: 4px; }

      .cart-empty {
        display: flex; flex-direction: column; align-items: center;
        justify-content: center; height: 100%; gap: 16px;
        color: #9ca3af; text-align: center; padding: 40px 20px;
      }
      .cart-empty i { font-size: 56px; color: #e4e7ec; }
      .cart-empty p { font-family: 'Rajdhani', sans-serif; font-size: 17px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; }
      .cart-empty a {
        background: #D0021B; color: #fff; text-decoration: none;
        padding: 10px 24px; border-radius: 3px;
        font-family: 'Rajdhani', sans-serif; font-size: 14px; font-weight: 700;
        letter-spacing: 1.5px; text-transform: uppercase;
        transition: background 0.2s;
      }
      .cart-empty a:hover { background: #e8021e; }

      .cart-item {
        display: flex; align-items: flex-start; justify-content: space-between;
        gap: 12px; padding: 14px 0; border-bottom: 1px solid #f0f2f5;
      }
      .cart-item:last-child { border-bottom: none; }
      .cart-item-info { flex: 1; min-width: 0; }
      .cart-item-name {
        font-family: 'Rajdhani', sans-serif; font-size: 15px; font-weight: 700;
        color: #1a1a1a; letter-spacing: 0.3px; margin-bottom: 3px;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .cart-item-variant {
        font-size: 13px; color: #6b7280; margin-bottom: 6px;
        font-weight: 600; letter-spacing: 0.5px;
      }
      .cart-item-price {
        font-family: 'Bebas Neue', sans-serif; font-size: 20px; color: #D0021B; letter-spacing: 1px;
      }
      .cart-item-controls { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
      .qty-btn {
        width: 28px; height: 28px; border: 1.5px solid #e4e7ec;
        background: #f7f8fa; border-radius: 3px; cursor: pointer;
        font-size: 16px; font-weight: 700; color: #374151;
        display: flex; align-items: center; justify-content: center;
        transition: all 0.15s; line-height: 1;
      }
      .qty-btn:hover { border-color: #D0021B; color: #D0021B; background: #fff; }
      .qty-val {
        font-family: 'Rajdhani', sans-serif; font-weight: 700; font-size: 15px;
        min-width: 20px; text-align: center; color: #1a1a1a;
      }
      .remove-btn {
        width: 28px; height: 28px; border: none; background: none;
        cursor: pointer; color: #9ca3af; font-size: 14px;
        display: flex; align-items: center; justify-content: center;
        border-radius: 3px; transition: color 0.15s, background 0.15s;
      }
      .remove-btn:hover { color: #D0021B; background: #fef2f2; }

      .cart-drawer-footer {
        padding: 16px 24px 24px; border-top: 1.5px solid #e4e7ec; flex-shrink: 0;
      }
      .cart-total {
        display: flex; justify-content: space-between; align-items: center;
        margin-bottom: 16px;
        font-family: 'Rajdhani', sans-serif; font-size: 16px; font-weight: 700;
        letter-spacing: 1px; text-transform: uppercase; color: #374151;
      }
      .cart-total-price {
        font-family: 'Bebas Neue', sans-serif; font-size: 28px; color: #D0021B; letter-spacing: 1px;
      }
      .btn-checkout {
        display: flex; align-items: center; justify-content: center; gap: 8px;
        width: 100%; padding: 14px;
        background: #D0021B; color: #fff; text-decoration: none;
        border-radius: 3px; border: none; cursor: pointer;
        font-family: 'Rajdhani', sans-serif; font-size: 16px; font-weight: 700;
        letter-spacing: 2px; text-transform: uppercase;
        transition: background 0.2s, transform 0.15s;
        box-shadow: 0 4px 16px rgba(208,2,27,0.25);
        margin-bottom: 10px;
      }
      .btn-checkout:hover { background: #e8021e; transform: translateY(-1px); }
      .btn-clear-cart {
        display: block; width: 100%; background: none; border: none;
        cursor: pointer; text-align: center;
        font-family: 'Rajdhani', sans-serif; font-size: 13px; font-weight: 600;
        letter-spacing: 1px; text-transform: uppercase; color: #9ca3af;
        padding: 6px; transition: color 0.2s;
      }
      .btn-clear-cart:hover { color: #D0021B; }

      /* Nav cart button */
      .nav-cart-btn {
        position: relative; background: none; border: none;
        cursor: pointer; padding: 6px; color: #374151;
        font-size: 20px; transition: color 0.2s;
        display: flex; align-items: center;
      }
      .nav-cart-btn:hover { color: #D0021B; }
      .cart-badge {
        position: absolute; top: -2px; right: -6px;
        background: #D0021B; color: #fff;
        font-family: 'Rajdhani', sans-serif; font-size: 10px; font-weight: 700;
        min-width: 18px; height: 18px; border-radius: 20px;
        display: none; align-items: center; justify-content: center;
        letter-spacing: 0;
      }

      @media (max-width: 480px) {
        #cart-drawer { width: 100vw; }
      }
    `;
    document.head.appendChild(style);

    // Initial render
    Cart._refresh();
  }

  /* ─── CART BUTTON INJECT ─── */
  function injectCartButton() {
    // Find the nav and insert cart btn before the last item or hamburger
    const nav = document.querySelector('nav');
    if (!nav) return;

    const btn = document.createElement('button');
    btn.className = 'nav-cart-btn';
    btn.id = 'cartNavBtn';
    btn.setAttribute('aria-label', 'Open cart');
    btn.onclick = () => Cart.open();
    btn.innerHTML = `<i class="fas fa-shopping-cart"></i><span class="cart-badge" id="cartBadgeNav"></span>`;

    // Insert before hamburger or at end of nav
    const hamburger = nav.querySelector('.hamburger');
    if (hamburger) {
      nav.insertBefore(btn, hamburger);
    } else {
      // Insert before the ul, after the logo area
      const ul = nav.querySelector('ul');
      if (ul) ul.insertAdjacentElement('afterend', btn);
      else nav.appendChild(btn);
    }
  }

  /* ─── BOOT ─── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { inject(); injectCartButton(); });
  } else {
    inject();
    injectCartButton();
  }

  // Expose globally
  window.Cart = Cart;
})();
