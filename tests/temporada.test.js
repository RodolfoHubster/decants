import {
  temporadaVigente, hoyEnTijuana, temporadaSimulada, paquetesDeTemporada, seleccionRequerida, ofreceTrucoOTrato,
} from '../assets/js/temporada.js';

const config = { temporada: { id: 'halloween', activa: true, inicio: '2026-10-16', fin: '2026-11-03' } };

describe('temporadaVigente', () => {
  test('dentro de las fechas', () => {
    expect(temporadaVigente(config, '2026-10-16')).toMatchObject({ id: 'halloween' });
    expect(temporadaVigente(config, '2026-10-31')).toMatchObject({ id: 'halloween' });
    expect(temporadaVigente(config, '2026-11-02')).toMatchObject({ id: 'halloween' });
  });
  test('fin exclusivo: el 3 de noviembre ya no', () => {
    expect(temporadaVigente(config, '2026-11-03')).toBeNull();
  });
  test('antes del inicio, apagada o sin config', () => {
    expect(temporadaVigente(config, '2026-10-15')).toBeNull();
    expect(temporadaVigente({ temporada: { ...config.temporada, activa: false } }, '2026-10-20')).toBeNull();
    expect(temporadaVigente({}, '2026-10-20')).toBeNull();
    expect(temporadaVigente(null, '2026-10-20')).toBeNull();
  });
  test('fechas mal escritas o al revés no encienden nada', () => {
    expect(temporadaVigente({ temporada: { ...config.temporada, inicio: '16/10/2026' } }, '2026-10-20')).toBeNull();
    expect(temporadaVigente({ temporada: { ...config.temporada, inicio: '2026-11-05' } }, '2026-10-20')).toBeNull();
  });
  test('usa la hora de Tijuana, no la del servidor ni UTC', () => {
    // 2 nov 23:30 en Tijuana (UTC-8 tras el cambio de horario) ya es 3 nov en UTC: sigue vigente.
    expect(temporadaVigente(config, new Date('2026-11-03T07:30:00Z'))).toMatchObject({ id: 'halloween' });
    // 3 nov 08:00 en Tijuana: ya terminó.
    expect(temporadaVigente(config, new Date('2026-11-03T16:00:00Z'))).toBeNull();
    expect(hoyEnTijuana(new Date('2026-10-16T06:59:00Z'))).toBe('2026-10-15');
  });
});

describe('temporadaSimulada', () => {
  test('solo en localhost', () => {
    expect(temporadaSimulada('http://127.0.0.1:5501/index.html?temporada=halloween')).toMatchObject({ id: 'halloween', simulada: true });
    expect(temporadaSimulada('http://localhost:5501/?temporada=halloween').id).toBe('halloween');
    expect(temporadaSimulada('https://rodolfohubster.github.io/decants/?temporada=halloween')).toBeNull();
    expect(temporadaSimulada('http://127.0.0.1:5501/index.html')).toBeNull();
  });
});

describe('paquetes y Truco o Trato', () => {
  const items = [
    { id: 'a', tipo: 'paquete', temporada: 'halloween', esPersonalizable: true, maxSeleccion: 3 },
    { id: 'b', tipo: 'paquete' },
    { id: 'c', tipo: 'perfume', temporada: 'halloween' },
    { id: 'd', tipo: 'paquete', temporada: 'halloween', esPersonalizable: true, maxSeleccion: 1 },
  ];
  test('solo paquetes marcados con esa temporada', () => {
    expect(paquetesDeTemporada(items, 'halloween').map(p => p.id)).toEqual(['a', 'd']);
    expect(paquetesDeTemporada(items, null)).toEqual([]);
  });
  test('en Truco se elige uno menos; en Trato los de siempre', () => {
    expect(seleccionRequerida(items[0], 'truco')).toBe(2);
    expect(seleccionRequerida(items[0], 'trato')).toBe(3);
    expect(seleccionRequerida(items[3], 'truco')).toBe(1); // con 1 no hay sorpresa
  });
  test('Truco o Trato solo en personalizables de temporada con 2+', () => {
    expect(ofreceTrucoOTrato(items[0], 'halloween')).toBe(true);
    expect(ofreceTrucoOTrato(items[3], 'halloween')).toBe(false);
    expect(ofreceTrucoOTrato(items[0], null)).toBe(false);
    expect(ofreceTrucoOTrato(items[1], 'halloween')).toBe(false);
  });
});
