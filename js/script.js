/**
 * Atelier Forma - Luxury Interior Studio
 * Main JavaScript File
 */

document.addEventListener("DOMContentLoaded", () => {
  // ==========================================================================
  // 1. Loader & Initialization
  // ==========================================================================
  const loader = document.getElementById("loader");

  // Simulate loading time for visual effect (min 2s)
  setTimeout(() => {
    loader.classList.add("fade-out");

    // Trigger initial hero animations after loader vanishes
    setTimeout(() => {
      document
        .querySelectorAll(".hero-title .reveal-text")
        .forEach((el, index) => {
          setTimeout(() => el.classList.add("active"), index * 200);
        });
      document
        .querySelectorAll(".hero-section .reveal-element")
        .forEach((el) => {
          el.classList.add("active");
        });
    }, 800);
  }, 2000);

  // ==========================================================================
  // 2. Dark/Light Mode Theme Toggle
  // ==========================================================================
  const themeToggleBtn = document.getElementById("theme-toggle");
  const htmlElement = document.documentElement;

  // Check saved theme
  const savedTheme = localStorage.getItem("atelier-theme") || "light";
  htmlElement.setAttribute("data-theme", savedTheme);

  themeToggleBtn.addEventListener("click", () => {
    const currentTheme = htmlElement.getAttribute("data-theme");
    const newTheme = currentTheme === "light" ? "dark" : "light";

    htmlElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("atelier-theme", newTheme);
  });

  // ==========================================================================
  // 3. Navbar & Mobile Menu
  // ==========================================================================
  const navbar = document.getElementById("navbar");
  const menuToggle = document.querySelector(".menu-toggle");
  const navLinks = document.querySelectorAll(".nav-link");

  // Scroll effect
  window.addEventListener("scroll", () => {
    if (window.scrollY > 50) {
      navbar.classList.add("scrolled");
    } else {
      navbar.classList.remove("scrolled");
    }
  });

  // Mobile Menu Toggle
  menuToggle.addEventListener("click", () => {
    navbar.classList.toggle("menu-open");
  });

  // Close menu when clicking link
  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      navbar.classList.remove("menu-open");
    });
  });

  // ==========================================================================
  // 4. Scroll Animations (Intersection Observer)
  // ==========================================================================
  const revealElements = document.querySelectorAll(
    ".reveal-fade-up, .reveal-fade-right, .reveal-element",
  );

  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("active");
          observer.unobserve(entry.target); // Run once

          // If it contains a counter, trigger it
          const counters = entry.target.querySelectorAll(".counter");
          if (counters.length > 0) {
            startCounters(counters);
          }
        }
      });
    },
    {
      root: null,
      threshold: 0.15,
      rootMargin: "0px 0px -50px 0px",
    },
  );

  revealElements.forEach((el) => revealObserver.observe(el));

  // ==========================================================================
  // 5. Animated Counters
  // ==========================================================================
  function startCounters(counters) {
    counters.forEach((counter) => {
      const target = +counter.getAttribute("data-target");
      const duration = 2000; // ms
      const stepTime = Math.abs(Math.floor(duration / target));
      let current = 0;

      const timer = setInterval(() => {
        current += Math.ceil(target / 50); // Increment chunk
        if (current >= target) {
          counter.innerText = target;
          clearInterval(timer);
        } else {
          counter.innerText = current;
        }
      }, stepTime);
    });
  }

  // ==========================================================================
  // 6. Portfolio Filtering
  // ==========================================================================
  const filterBtns = document.querySelectorAll(".filter-btn");
  const portfolioItems = document.querySelectorAll(".portfolio-item");

  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      // Remove active class from all
      filterBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const filterValue = btn.getAttribute("data-filter");

      portfolioItems.forEach((item) => {
        if (filterValue === "all" || item.classList.contains(filterValue)) {
          // Show item dynamically
          item.style.display = "block";
          setTimeout(() => {
            item.style.opacity = "1";
            item.style.transform = "scale(1)";
          }, 50);
        } else {
          // Hide item
          item.style.opacity = "0";
          item.style.transform = "scale(0.8)";
          setTimeout(() => {
            item.style.display = "none";
          }, 300);
        }
      });
    });
  });

  // ==========================================================================
  // 7. Process Timeline Scroll Progress
  // ==========================================================================
  const timelineSection = document.getElementById("process");
  const timelineFill = document.getElementById("timeline-fill");
  const timelineSteps = document.querySelectorAll(".timeline-step");

  if (timelineSection && timelineFill) {
    window.addEventListener("scroll", () => {
      const rect = timelineSection.getBoundingClientRect();
      const sectionTop = rect.top;
      const sectionHeight = rect.height;
      const windowHeight = window.innerHeight;

      // Calculate progress 0 to 1
      if (sectionTop < windowHeight && sectionTop > -sectionHeight) {
        // Determine percentage
        let scrollPercent =
          ((windowHeight - sectionTop) / (windowHeight + sectionHeight / 2)) *
          100;

        // Clamp
        scrollPercent = Math.max(0, Math.min(100, scrollPercent));

        // Adjust width or height depending on mobile/desktop
        if (window.innerWidth > 768) {
          timelineFill.style.width = scrollPercent + "%";
          timelineFill.style.height = "100%";
        } else {
          timelineFill.style.height = scrollPercent + "%";
          timelineFill.style.width = "100%";
        }

        // Highlight steps based on progress
        timelineSteps.forEach((step, index) => {
          const stepThreshold = (index / (timelineSteps.length - 1)) * 100;
          if (scrollPercent >= stepThreshold - 10) {
            step.classList.add("active");
          }
        });
      }
    });
  }

  // ==========================================================================
  // 8. Testimonials Carousel
  // ==========================================================================
  const track = document.querySelector(".carousel-track");
  if (track) {
    const slides = Array.from(track.children);
    const nextButton = document.querySelector(".carousel-button-right");
    const prevButton = document.querySelector(".carousel-button-left");
    const dotsNav = document.querySelector(".carousel-dots");
    const dots = Array.from(dotsNav.children);

    let slideInterval;
    let currentSlideIndex = 0;

    const moveToSlide = (currentSlide, targetSlide, targetIndex) => {
      currentSlide.classList.remove("current-slide");
      targetSlide.classList.add("current-slide");

      // Update Dots
      dots.forEach((dot) => dot.classList.remove("current-slide"));
      dots[targetIndex].classList.add("current-slide");

      currentSlideIndex = targetIndex;
    };

    const goToNext = () => {
      const currentSlide = track.querySelector(".current-slide");
      let nextSlide = currentSlide.nextElementSibling;
      let targetIndex = currentSlideIndex + 1;

      if (!nextSlide) {
        nextSlide = slides[0];
        targetIndex = 0;
      }
      moveToSlide(currentSlide, nextSlide, targetIndex);
    };

    const goToPrev = () => {
      const currentSlide = track.querySelector(".current-slide");
      let prevSlide = currentSlide.previousElementSibling;
      let targetIndex = currentSlideIndex - 1;

      if (!prevSlide) {
        prevSlide = slides[slides.length - 1];
        targetIndex = slides.length - 1;
      }
      moveToSlide(currentSlide, prevSlide, targetIndex);
    };

    // Setup timer
    const startCarousel = () => {
      slideInterval = setInterval(goToNext, 5000);
    };

    const resetCarouselTimer = () => {
      clearInterval(slideInterval);
      startCarousel();
    };

    nextButton.addEventListener("click", () => {
      goToNext();
      resetCarouselTimer();
    });

    prevButton.addEventListener("click", () => {
      goToPrev();
      resetCarouselTimer();
    });

    dotsNav.addEventListener("click", (e) => {
      const targetDot = e.target.closest("button");
      if (!targetDot) return;

      const currentSlide = track.querySelector(".current-slide");
      const targetIndex = dots.findIndex((dot) => dot === targetDot);
      const targetSlide = slides[targetIndex];

      moveToSlide(currentSlide, targetSlide, targetIndex);
      resetCarouselTimer();
    });

    // Initialize automatic slide
    startCarousel();
  }

  // ==========================================================================
  // 9. Parallax Effect (Hero & About Images)
  // ==========================================================================
  const parallaxBgs = document.querySelectorAll(".parallax-bg, .parallax-img");

  window.addEventListener("scroll", () => {
    const scrolled = window.scrollY;

    parallaxBgs.forEach((bg) => {
      const speed = bg.classList.contains("parallax-bg") ? 0.3 : 0.1;
      // Only apply if element is somewhat in view (basic optimization)
      const rect = bg.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        bg.style.transform = `translateY(${scrolled * speed}px)`;
      }
    });
  });

  // ==========================================================================
  // 10. Forms & Back to Top
  // ==========================================================================
  // Form Simulation
  const contactForm = document.getElementById("contactForm");
  if (contactForm) {
    contactForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const btn = contactForm.querySelector('button[type="submit"]');
      const msg = document.getElementById("formMessage");

      const originalText = btn.innerText;
      btn.innerText = "Sending...";
      btn.style.opacity = "0.7";

      // Simulate API call delay
      setTimeout(() => {
        btn.innerText = originalText;
        btn.style.opacity = "1";
        msg.innerHTML =
          '<span style="color: #4BB543;"><i class="fas fa-check-circle"></i> Message sent successfully! We will be in touch shortly.</span>';
        contactForm.reset();

        // Remove focus classes manually
        contactForm.querySelectorAll(".focus-border").forEach((border) => {
          border.style.width = "0";
        });

        setTimeout(() => (msg.innerHTML = ""), 5000);
      }, 1500);
    });
  }

  // Back to Top Button
  const backToTopBtn = document.getElementById("backToTop");
  if (backToTopBtn) {
    backToTopBtn.addEventListener("click", () => {
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    });
  }

  // Set Copyright Year
  const yearSpan = document.getElementById("year");
  if (yearSpan) {
    yearSpan.innerText = new Date().getFullYear();
  }

  // Smooth scrolling for anchor links to handle sticky navbar offset
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      const targetId = this.getAttribute("href");
      if (targetId === "#") return;

      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        e.preventDefault();
        const offset = navbar.offsetHeight;
        const targetPosition =
          targetElement.getBoundingClientRect().top + window.scrollY - offset;

        window.scrollTo({
          top: targetPosition,
          behavior: "smooth",
        });
      }
    });
  });

  // Subtitute HTML custom properties using JS for reveal text
  document.querySelectorAll(".hero-title .reveal-text").forEach((el) => {
    const text = el.innerText;
    el.innerHTML = `<span class="reveal-inner">${text}</span>`;
  });
});
