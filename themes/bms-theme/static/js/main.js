/**
 * B Mortgage Services - Main JavaScript
 */

document.addEventListener('DOMContentLoaded', function() {
  
  // Header scroll effect
  const header = document.getElementById('header');
  let lastScroll = 0;
  
  window.addEventListener('scroll', function() {
    const currentScroll = window.pageYOffset;
    
    if (currentScroll > 50) {
      header.classList.add('header--scrolled');
    } else {
      header.classList.remove('header--scrolled');
    }
    
    lastScroll = currentScroll;
  });
  
  // Mobile navigation toggle
  const navToggle = document.getElementById('nav-toggle');
  const navList = document.getElementById('nav-list');
  
  if (navToggle && navList) {
    navToggle.addEventListener('click', function() {
      const isOpen = navList.classList.toggle('nav__list--open');
      navToggle.setAttribute('aria-expanded', isOpen);
    });
    
    // Close menu on link click
    navList.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', function() {
        navList.classList.remove('nav__list--open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }
  
  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      
      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        const headerHeight = header ? header.offsetHeight : 0;
        const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - headerHeight;
        
        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
      }
    });
  });
  
  // Animate elements on scroll
  const animateOnScroll = function() {
    const elements = document.querySelectorAll('.animate-on-scroll');
    
    elements.forEach(element => {
      const elementTop = element.getBoundingClientRect().top;
      const windowHeight = window.innerHeight;
      
      if (elementTop < windowHeight - 100) {
        element.classList.add('visible');
      }
    });
  };
  
  window.addEventListener('scroll', animateOnScroll);
  animateOnScroll(); // Run on load

  // Wellness section frame animation - play on scroll
  const wellnessCanvas = document.getElementById('wellnessCanvas');

  if (wellnessCanvas) {
    const ctx = wellnessCanvas.getContext('2d');
    const frameCount = 184;
    const frames = [];
    let currentFrame = 0;
    let isAnimating = false;
    let imagesLoaded = 0;
    let canvasInitialized = false;
    let allFramesLoaded = false;

    // Function to resize canvas to fill container
    function resizeCanvas() {
      const container = wellnessCanvas.parentElement;
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;

      wellnessCanvas.width = containerWidth;
      wellnessCanvas.height = containerHeight;

      // Redraw current frame if initialized
      if (canvasInitialized && frames[currentFrame] && frames[currentFrame].complete) {
        drawFrame(frames[currentFrame]);
      }
    }

    // Initialize canvas size
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Preload all frames - try both delay values since they vary
    for (let i = 0; i < frameCount; i++) {
      const img = new Image();
      const frameNumber = String(i).padStart(3, '0');
      const basePath = window.location.origin;

      // Try 0.042s first
      img.src = `${basePath}/images/frames/frame_${frameNumber}_delay-0.042s.jpg`;

      img.onerror = (function(index, frameNum, basePath) {
        return function() {
          // If 0.042s fails, try 0.041s
          console.log('Trying alternate delay for frame:', index);
          this.src = `${basePath}/images/frames/frame_${frameNum}_delay-0.041s.jpg`;

          this.onerror = function() {
            console.error('Failed to load frame:', index, 'with either delay');
          };
        };
      })(i, frameNumber, basePath);

      img.onload = (function(index) {
        return function() {
          imagesLoaded++;
          console.log('Frame loaded:', index, 'Total loaded:', imagesLoaded, '/', frameCount);

          // Initialize with first frame
          if (index === 0 && !canvasInitialized) {
            canvasInitialized = true;
            drawFrame(img);
            console.log('First frame drawn');
          }

          // Start animation once all frames are loaded
          if (imagesLoaded === frameCount) {
            allFramesLoaded = true;
            console.log('All frames loaded! Checking viewport...');
            checkViewport();
          }
        };
      })(i);

      frames[i] = img;
    }

    // Draw frame to canvas, filling the entire space
    function drawFrame(img) {
      if (!img || !img.complete) {
        console.log('Cannot draw frame - image not ready');
        return;
      }

      const canvasAspect = wellnessCanvas.width / wellnessCanvas.height;
      const imgAspect = img.width / img.height;

      let drawWidth, drawHeight, offsetX, offsetY;

      if (imgAspect > canvasAspect) {
        // Image is wider than canvas
        drawHeight = wellnessCanvas.height;
        drawWidth = img.width * (wellnessCanvas.height / img.height);
        offsetX = (wellnessCanvas.width - drawWidth) / 2;
        offsetY = 0;
      } else {
        // Image is taller than canvas
        drawWidth = wellnessCanvas.width;
        drawHeight = img.height * (wellnessCanvas.width / img.width);
        offsetX = 0;
        offsetY = (wellnessCanvas.height - drawHeight) / 2;
      }

      ctx.clearRect(0, 0, wellnessCanvas.width, wellnessCanvas.height);
      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
    }

    // Animate through frames
    let lastFrameTime = Date.now();
    function animateFrames() {
      if (!isAnimating) {
        console.log('Animation stopped');
        return;
      }

      const now = Date.now();
      const elapsed = now - lastFrameTime;

      // Draw next frame every 42ms (24fps)
      if (elapsed > 42) {
        if (frames[currentFrame] && frames[currentFrame].complete) {
          drawFrame(frames[currentFrame]);

          currentFrame++;
          if (currentFrame >= frameCount) {
            currentFrame = 0; // Loop
            console.log('Animation looped');
          }
        }
        lastFrameTime = now;
      }

      requestAnimationFrame(animateFrames);
    }

    // Check if section is in viewport and start animation
    const checkViewport = function() {
      const rect = wellnessCanvas.getBoundingClientRect();
      const windowHeight = window.innerHeight;

      // Check if canvas is in viewport (at least 30% visible)
      const isVisible = rect.top < windowHeight * 0.7 && rect.bottom > windowHeight * 0.3;

      console.log('Checking viewport - Visible:', isVisible, 'Animating:', isAnimating, 'All loaded:', allFramesLoaded);

      if (isVisible && !isAnimating && allFramesLoaded) {
        console.log('Starting animation!');
        isAnimating = true;
        lastFrameTime = Date.now();
        animateFrames();
      } else if (!isVisible && isAnimating) {
        console.log('Stopping animation - out of viewport');
        isAnimating = false;
      }
    };

    window.addEventListener('scroll', checkViewport);

    // Check on load with a slight delay to ensure layout is ready
    setTimeout(() => {
      console.log('Initial viewport check');
      checkViewport();
    }, 100);
  }

  // Calculator tab switching
  const calculatorTabs = document.querySelectorAll('.calculator-tab');
  
  calculatorTabs.forEach(tab => {
    tab.addEventListener('click', function() {
      calculatorTabs.forEach(t => t.classList.remove('calculator-tab--active'));
      this.classList.add('calculator-tab--active');
      
      // You would add logic here to switch calculator panels
    });
  });
  
  // Form validation helper
  window.validateForm = function(formId) {
    const form = document.getElementById(formId);
    if (!form) return false;
    
    let isValid = true;
    const requiredFields = form.querySelectorAll('[required]');
    
    requiredFields.forEach(field => {
      if (!field.value.trim()) {
        field.classList.add('error');
        isValid = false;
      } else {
        field.classList.remove('error');
      }
    });
    
    return isValid;
  };
  
  // Number formatting helper
  window.formatCurrency = function(amount) {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };
  
  // Cookie consent (placeholder)
  const cookieConsent = localStorage.getItem('cookieConsent');
  if (!cookieConsent) {
    // Show cookie banner if needed
  }

  // Wellness modal - close on Escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      var wellnessModal = document.getElementById('wellnessModal');
      if (wellnessModal && wellnessModal.classList.contains('wellness-modal--open')) {
        if (typeof closeWellnessModal === 'function') {
          closeWellnessModal();
        }
      }
    }
  });

  // Wellness modal - declarative trigger support
  // Any element with data-wellness-trigger attribute will open the modal
  document.querySelectorAll('[data-wellness-trigger]').forEach(function(el) {
    el.addEventListener('click', function(e) {
      e.preventDefault();
      if (typeof openWellnessModal === 'function') {
        openWellnessModal({ source: this.dataset.wellnessSource || 'generic' });
      }
    });
  });

});

// FAQ toggle function (global for onclick handlers)
function toggleFaq(element) {
  const item = element.parentElement;
  const wasOpen = item.classList.contains('faq-item--open');
  
  // Close all FAQs
  document.querySelectorAll('.faq-item').forEach(faq => {
    faq.classList.remove('faq-item--open');
  });
  
  // Open clicked one if it wasn't already open
  if (!wasOpen) {
    item.classList.add('faq-item--open');
  }
}

// Borrowing calculator (global for onclick handlers)
function calculateBorrowing() {
  const income1 = parseFloat(document.getElementById('income1')?.value) || 0;
  const income2 = parseFloat(document.getElementById('income2')?.value) || 0;
  const deposit = parseFloat(document.getElementById('deposit')?.value) || 0;
  
  const borrowingCapacity = (income1 + income2) * 4.5;
  
  const resultEl = document.getElementById('borrow-amount');
  const containerEl = document.getElementById('borrow-result');
  
  if (resultEl && containerEl) {
    resultEl.textContent = formatCurrency(borrowingCapacity);
    containerEl.style.display = 'block';
  }
}
