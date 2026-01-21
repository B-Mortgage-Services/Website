/**
 * B Mortgage Services - Main JavaScript
 */

document.addEventListener('DOMContentLoaded', () => {
  // Header scroll effect
  const header = document.getElementById('header');
  if (header) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 50) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    });
  }

  // Mobile navigation toggle
  const navToggle = document.getElementById('navToggle');
  const mobileMenu = document.getElementById('mobileMenu');
  
  if (navToggle && mobileMenu) {
    navToggle.addEventListener('click', () => {
      mobileMenu.classList.toggle('active');
      navToggle.classList.toggle('active');
    });
    
    // Close menu when clicking a link
    mobileMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mobileMenu.classList.remove('active');
        navToggle.classList.remove('active');
      });
    });
  }

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      
      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        e.preventDefault();
        const headerHeight = header ? header.offsetHeight : 0;
        const targetPosition = targetElement.offsetTop - headerHeight - 20;
        
        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
      }
    });
  });

  // Intersection Observer for animations
  const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.1
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-in');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  document.querySelectorAll('.card, .service-card, .testimonial, .benefit').forEach(el => {
    observer.observe(el);
  });

  // Form validation helpers
  const forms = document.querySelectorAll('form');
  forms.forEach(form => {
    form.addEventListener('submit', (e) => {
      const requiredFields = form.querySelectorAll('[required]');
      let isValid = true;
      
      requiredFields.forEach(field => {
        if (!field.value.trim()) {
          isValid = false;
          field.classList.add('error');
        } else {
          field.classList.remove('error');
        }
      });
      
      if (!isValid) {
        e.preventDefault();
      }
    });
  });

  // Calculator functionality (if present)
  const calculatorInputs = document.querySelectorAll('.calculator-body input');
  calculatorInputs.forEach(input => {
    input.addEventListener('input', updateCalculations);
  });

  function updateCalculations() {
    const income1 = parseFloat(document.getElementById('income1')?.value) || 0;
    const income2 = parseFloat(document.getElementById('income2')?.value) || 0;
    const deposit = parseFloat(document.getElementById('deposit')?.value) || 0;
    
    const totalIncome = income1 + income2;
    const maxBorrow = totalIncome * 4.5;
    
    const resultElement = document.getElementById('borrowResult');
    if (resultElement) {
      resultElement.textContent = '£' + maxBorrow.toLocaleString('en-GB');
    }
  }

  // FAQ accordion (if present)
  document.querySelectorAll('.faq-question').forEach(button => {
    button.addEventListener('click', () => {
      const item = button.parentElement;
      const isActive = item.classList.contains('active');
      
      // Close all other items
      document.querySelectorAll('.faq-item').forEach(otherItem => {
        otherItem.classList.remove('active');
      });
      
      // Toggle current item
      if (!isActive) {
        item.classList.add('active');
      }
    });
  });

  // Tab switching (if present)
  document.querySelectorAll('.calculator-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      
      // Update tabs
      document.querySelectorAll('.calculator-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Update panels
      document.querySelectorAll('.calculator-panel').forEach(panel => {
        panel.classList.remove('active');
        if (panel.dataset.panel === tabName) {
          panel.classList.add('active');
        }
      });
    });
  });

  // Lazy loading images
  if ('loading' in HTMLImageElement.prototype) {
    const images = document.querySelectorAll('img[loading="lazy"]');
    images.forEach(img => {
      img.src = img.dataset.src;
    });
  } else {
    // Fallback for browsers that don't support lazy loading
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/lazysizes/5.3.2/lazysizes.min.js';
    document.body.appendChild(script);
  }

  // Print functionality for reports
  window.printReport = function() {
    window.print();
  };
});

// Utility functions
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
