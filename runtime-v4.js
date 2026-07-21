(() => {
  'use strict';

  const tg = window.Telegram?.WebApp;
  let walletData = null;
  let walletLoading = false;

  function notify(message) {
    if (typeof window.showToast === 'function') window.showToast(message);
  }

  function formatMoney(value) {
    return Number(value || 0).toLocaleString('ru-RU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function updateIdentity() {
    const user = tg?.initDataUnsafe?.user;
    const name = String(user?.first_name || '').trim().slice(0, 30) || 'Искатель';
    const homeName = document.getElementById('user-name');
    const profileName = document.getElementById('profile-name');
    if (homeName) homeName.textContent = name;
    if (profileName) profileName.textContent = name;
  }

  function labelForLedger(type) {
    return ({
      purchase: 'Покупка SILARUM',
      service_charge: 'Оплата услуги',
      wheel_prize: 'Приз Колеса Фортуны',
      referral_commission: 'Партнёрское начисление',
      withdrawal_hold: 'Заявка на обмен',
      withdrawal_paid: 'Обмен выполнен',
      withdrawal_release: 'Средства разблокированы',
      adjustment: 'Корректировка'
    })[type] || 'Операция счёта';
  }

  function iconForLedger(type) {
    return ({
      purchase: '＋',
      service_charge: '◈',
      wheel_prize: '✦',
      referral_commission: '∞',
      withdrawal_hold: '↗',
      withdrawal_paid: '✓',
      withdrawal_release: '↩'
    })[type] || '◇';
  }

  function renderWallet(data) {
    walletData = data;
    const wallet = data?.wallet || { balance: 0, available: 0, freeSpins: 0, locked: 0 };
    const balance = formatMoney(wallet.balance);
    const available = formatMoney(wallet.available);
    const spins = String(wallet.freeSpins || 0);
    for (const id of ['home-balance', 'wallet-balance']) {
      const node = document.getElementById(id);
      if (node) node.textContent = balance;
    }
    const homeSpins = document.getElementById('home-free-spins');
    const walletSpins = document.getElementById('wallet-spins');
    const walletAvailable = document.getElementById('wallet-available');
    if (homeSpins) homeSpins.textContent = spins;
    if (walletSpins) walletSpins.textContent = spins;
    if (walletAvailable) walletAvailable.textContent = available;

    const list = document.getElementById('wallet-transactions');
    if (list) {
      list.replaceChildren();
      const entries = Array.isArray(data?.ledger) ? data.ledger : [];
      if (!entries.length) {
        list.innerHTML = '<div class="wallet-empty"><span>◇</span><p><strong>Операций пока нет</strong><small>Здесь появятся покупки услуг, призы и заявки на обмен.</small></p></div>';
      } else {
        for (const entry of entries.slice(0, 30)) {
          const row = document.createElement('div');
          row.className = 'wallet-transaction';
          const amount = Number(entry.amount || 0);
          const date = entry.createdAt
            ? new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(entry.createdAt))
            : '';
          row.innerHTML = `<span>${iconForLedger(entry.type)}</span><p><strong>${labelForLedger(entry.type)}</strong><small>${date}</small></p><b class="${amount > 0 ? 'positive' : ''}">${amount > 0 ? '+' : ''}${formatMoney(amount)}</b>`;
          list.appendChild(row);
        }
      }
    }

    const exchange = document.getElementById('wallet-exchange');
    if (exchange) {
      const enabled = data?.config?.withdrawalsEnabled === true;
      exchange.dataset.enabled = String(enabled);
      exchange.textContent = enabled ? 'Обменять' : 'Обмен закрыт';
      exchange.setAttribute('aria-disabled', String(!enabled));
    }
  }

  async function loadWallet({ silent = false } = {}) {
    if (walletLoading) return;
    walletLoading = true;
    try {
      const response = await fetch('/api/wallet', {
        headers: { 'X-Telegram-Init-Data': tg?.initData || '' }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (!silent && response.status !== 401) notify('Не удалось обновить лицевой счёт');
        return;
      }
      renderWallet(data);
    } catch (error) {
      console.error('Wallet load failed', error);
      if (!silent) notify('Не удалось обновить лицевой счёт');
    } finally {
      walletLoading = false;
    }
  }

  function ensureWithdrawalDialog() {
    let dialog = document.getElementById('withdrawal-dialog');
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'withdrawal-dialog';
    dialog.className = 'withdrawal-dialog';
    dialog.innerHTML = `
      <form method="dialog" class="withdrawal-card glass-card" id="withdrawal-form">
        <div class="withdrawal-head"><div><p class="card-label">Обмен SILARUM</p><h2>Заявка на вывод</h2></div><button type="button" id="withdrawal-close" aria-label="Закрыть">×</button></div>
        <div class="withdrawal-summary" id="withdrawal-summary"></div>
        <label>Сумма SILARUM<input id="withdrawal-amount" type="number" min="0.01" step="0.01" inputmode="decimal" required></label>
        <label>USDT-адрес сети TON<input id="withdrawal-destination" maxlength="200" autocomplete="off" placeholder="Введите адрес кошелька" required></label>
        <div class="withdrawal-calculation" id="withdrawal-calculation"></div>
        <label class="consent-row"><input id="withdrawal-confirm" type="checkbox"><span><strong>Адрес проверен мной</strong><small>Перевод на ошибочный адрес невозможно отменить.</small></span></label>
        <button class="primary-btn" id="withdrawal-submit" type="submit">Создать заявку</button>
        <p class="fine-print">Заявка проходит проверку. Комиссия и сумма к получению показываются до подтверждения.</p>
      </form>`;
    document.body.appendChild(dialog);
    document.getElementById('withdrawal-close').addEventListener('click', () => dialog.close());
    document.getElementById('withdrawal-amount').addEventListener('input', updateWithdrawalCalculation);
    document.getElementById('withdrawal-form').addEventListener('submit', submitWithdrawal);
    return dialog;
  }

  function updateWithdrawalCalculation() {
    const amount = Number(document.getElementById('withdrawal-amount')?.value || 0);
    const feePercent = Number(walletData?.config?.withdrawalFee ?? 25);
    const fee = Math.ceil(amount * feePercent * 100) / 100;
    const net = Math.max(0, amount - fee);
    const box = document.getElementById('withdrawal-calculation');
    if (!box) return;
    box.innerHTML = `<span><small>Комиссия ${feePercent}%</small><strong>${formatMoney(fee)} SILARUM</strong></span><span><small>К получению</small><strong>${formatMoney(net)} USDT</strong></span>`;
  }

  function openWithdrawal() {
    if (!walletData?.config?.withdrawalsEnabled) {
      notify('Обмен пока закрыт администратором до завершения платёжного контура');
      return;
    }
    const dialog = ensureWithdrawalDialog();
    const available = Number(walletData?.wallet?.available || 0);
    const minimum = Number(walletData?.config?.minimumWithdrawal || 25);
    document.getElementById('withdrawal-summary').innerHTML = `<span><small>Доступно</small><strong>${formatMoney(available)} SILARUM</strong></span><span><small>Минимум</small><strong>${formatMoney(minimum)} SILARUM</strong></span>`;
    document.getElementById('withdrawal-amount').value = available >= minimum ? String(minimum) : '';
    document.getElementById('withdrawal-destination').value = '';
    document.getElementById('withdrawal-confirm').checked = false;
    updateWithdrawalCalculation();
    dialog.showModal();
  }

  async function submitWithdrawal(event) {
    event.preventDefault();
    const amount = Number(document.getElementById('withdrawal-amount').value);
    const destination = document.getElementById('withdrawal-destination').value.trim();
    const confirmed = document.getElementById('withdrawal-confirm').checked;
    if (!confirmed) return notify('Подтвердите, что адрес проверен');
    const button = document.getElementById('withdrawal-submit');
    button.disabled = true;
    button.textContent = 'Создаём заявку…';
    try {
      const response = await fetch('/api/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': tg?.initData || '' },
        body: JSON.stringify({ action: 'request_withdrawal', amount, destination })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const messages = {
          withdrawals_disabled: 'Обмен сейчас закрыт',
          below_minimum: 'Сумма ниже установленного минимума',
          insufficient_funds: 'Недостаточно доступных SILARUM',
          invalid_destination: 'Проверьте адрес кошелька'
        };
        throw new Error(messages[data.error] || 'Не удалось создать заявку');
      }
      renderWallet(data);
      document.getElementById('withdrawal-dialog').close();
      tg?.HapticFeedback?.notificationOccurred?.('success');
      notify('Заявка на обмен создана');
    } catch (error) {
      notify(error.message || 'Не удалось создать заявку');
      tg?.HapticFeedback?.notificationOccurred?.('error');
    } finally {
      button.disabled = false;
      button.textContent = 'Создать заявку';
    }
  }

  function bindWalletButtons() {
    const exchange = document.getElementById('wallet-exchange');
    if (exchange && !exchange.dataset.runtimeBound) {
      exchange.dataset.runtimeBound = 'true';
      exchange.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        openWithdrawal();
      }, { capture: true });
    }
    for (const id of ['home-wallet-card', 'profile-btn']) {
      const button = document.getElementById(id);
      if (button && !button.dataset.walletRefreshBound) {
        button.dataset.walletRefreshBound = 'true';
        button.addEventListener('click', () => setTimeout(() => loadWallet({ silent: true }), 50));
      }
    }
  }

  function init() {
    updateIdentity();
    bindWalletButtons();
    loadWallet({ silent: true });
    const observer = new MutationObserver(() => {
      bindWalletButtons();
      updateIdentity();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  init();
})();