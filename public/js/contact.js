document.getElementById('year').textContent = new Date().getFullYear();

apiFetch('/api/pages/telegram-link').then((data) => {
  const link = document.getElementById('telegramLink');
  if (data.url) link.href = data.url;
}).catch(() => {});

document.getElementById('contactForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('contactError');
  const successEl = document.getElementById('contactSuccess');
  errorEl.classList.remove('show');
  successEl.classList.remove('show');

  try {
    await apiFetch('/api/pages/contact', {
      method: 'POST',
      body: {
        name: document.getElementById('contactName').value,
        message: document.getElementById('contactMessage').value,
      },
    });
    successEl.textContent = 'Thanks — your message has been sent. We\'ll get back to you soon.';
    successEl.classList.add('show');
    e.target.reset();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.add('show');
  }
});

document.getElementById('navToggle')?.addEventListener('click', () => {
  const nav = document.querySelector('.nav-links');
  const isOpen = nav.style.display === 'flex';
  nav.style.display = isOpen ? 'none' : 'flex';
  nav.style.cssText += isOpen ? '' : 'flex-direction:column; position:absolute; top:64px; left:0; right:0; background:#fff; padding:16px 24px; border-bottom:1px solid var(--border); gap:14px; z-index: 90;';
});
