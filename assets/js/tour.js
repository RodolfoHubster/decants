export function initTour() {
  const driver = window.driver.js.driver;

  const tourObj = driver({
    showProgress: true,
    animate: true,
    smoothScroll: true,
    allowClose: true,
    popoverClass: 'driverjs-theme',
    nextBtnText: 'Siguiente →',
    prevBtnText: '← Anterior',
    doneBtnText: '¡Listo!',
    progressText: '{{current}} / {{total}}',
    stagePadding: 6,
    stageRadius: 10,
    popoverOffset: 14,
    steps: [
      {
        popover: {
          title: '¡Bienvenido a Fitoscents! ✨',
          description: 'Te doy un recorrido rápido para que conozcas la página.',
          align: 'center'
        }
      },
      {
        element: '.filter-bar',
        popover: {
          title: 'Busca tu perfume',
          description: 'Escribe el nombre o usa los filtros para encontrar tu aroma ideal.',
          side: 'bottom',
          align: 'center'
        }
      },
      {
        element: '.btn-cart-header',
        popover: {
          title: 'Haz tu pedido',
          description: 'Toca un perfume, elige el tamaño de tu decant y agrégalo a la bolsa. Cuando termines, revisa tu pedido aquí.',
          side: 'bottom',
          align: 'center'
        }
      },
      {
        element: '#wa-fab',
        popover: {
          title: 'Contáctame',
          description: 'Toca aquí para enviarme un WhatsApp directo con tus dudas o pedidos.',
          side: 'left',
          align: 'end'
        }
      },
      {
        element: '.btn-completos',
        popover: {
          title: 'Perfumería completa',
          description: 'Botellas originales selladas. Toca aquí para ver el catálogo completo.',
          side: 'bottom',
          align: 'center'
        }
      },
      {
        element: '.btn-faq',
        popover: {
          title: 'Preguntas frecuentes',
          description: 'Originalidad, envíos y más. Aquí resolvemos tus dudas.',
          side: 'bottom',
          align: 'center'
        }
      },
      {
        element: '.footer-social',
        popover: {
          title: 'Síguenos',
          description: 'Encuéntranos en Instagram, TikTok y Facebook.',
          side: 'top',
          align: 'center'
        }
      }
    ],
    onDestroyStarted: () => {
      if (!tourObj.hasNextStep() || confirm("¿Salir de la guía?")) {
        tourObj.destroy();
      }
    },
    onCloseClick: () => {
      tourObj.destroy();
    }
  });

  // Auto-start for first-time visitors
  const hasSeenTour = localStorage.getItem('fitoscents_tour_seen');
  if (!hasSeenTour) {
    setTimeout(() => {
      tourObj.drive();
      localStorage.setItem('fitoscents_tour_seen', 'true');
    }, 1500);
  }

  // Manual trigger button
  const btnManual = document.getElementById('btn-start-tour');
  if (btnManual) {
    btnManual.addEventListener('click', () => {
      tourObj.drive();
    });
  }
}
