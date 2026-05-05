// Scroll reveal function for fade and slide up effect
function revealOnScroll() {
  const revealElements = document.querySelectorAll('.feature-card, .hero-headline, .hero-subheadline, .program-tabs, .hero-ctas');
  const windowHeight = window.innerHeight;
  const revealPoint = 150;

  revealElements.forEach(el => {
    const elementTop = el.getBoundingClientRect().top;
    if (elementTop < windowHeight - revealPoint) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });
}

// Tab keyboard navigation
function handleProgramTabs() {
  const tabsContainer = document.querySelector('.program-tabs');
  const tabs = tabsContainer.querySelectorAll('button[role="tab"]');

  tabsContainer.addEventListener('keydown', e => {
    const key = e.key;
    const focusedElement = document.activeElement;
    if (!tabsContainer.contains(focusedElement)) return;

    let index = Array.prototype.indexOf.call(tabs, focusedElement);

    if (key === 'ArrowRight' || key === 'ArrowDown') {
      e.preventDefault();
      index = (index + 1) % tabs.length;
      tabs[index].focus();
      selectTab(tabs[index]);
    } else if (key === 'ArrowLeft' || key === 'ArrowUp') {
      e.preventDefault();
      index = (index - 1 + tabs.length) % tabs.length;
      tabs[index].focus();
      selectTab(tabs[index]);
    }
  });

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      selectTab(tab);
    });
  });

  function selectTab(tab) {
    tabs.forEach(t => {
      t.setAttribute('aria-selected', 'false');
      t.setAttribute('tabindex', '-1');
    });
    tab.setAttribute('aria-selected', 'true');
    tab.setAttribute('tabindex', '0');
    tab.focus();
  }
}

window.addEventListener('scroll', revealOnScroll);
window.addEventListener('load', () => {
  revealOnScroll();
  handleProgramTabs();
});
