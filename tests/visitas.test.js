import { debeContar, sumarVisitas, diaLocal } from '../assets/js/visitas.js';

describe('debeContar', () => {
  const base = { esDueno: false, ultimoDia: '2026-10-02', hoy: '2026-10-03', userAgent: 'Mozilla/5.0 (iPhone)' };
  test('una persona cuenta una vez al día', () => {
    expect(debeContar(base)).toBe(true);
    expect(debeContar({ ...base, ultimoDia: '2026-10-03' })).toBe(false);
  });
  test('el dueño y los robots de vista previa no cuentan', () => {
    expect(debeContar({ ...base, esDueno: true })).toBe(false);
    expect(debeContar({ ...base, userAgent: 'WhatsApp/2.23.20.0 A' })).toBe(false);
    expect(debeContar({ ...base, userAgent: 'facebookexternalhit/1.1' })).toBe(false);
  });
});

describe('sumarVisitas', () => {
  const ahora = new Date(2026, 9, 3, 20).getTime();
  const datos = { '2026-09-20': { personas: 4 }, '2026-10-01': { personas: 10 }, '2026-10-03': { personas: 5 } };
  test('suma el periodo y promedia desde el primer día con datos', () => {
    const r = sumarVisitas(datos, new Date(2026, 9, 1).getTime(), ahora);
    expect(r).toEqual({ personas: 15, dias: 3, porDia: 5 });
  });
  test('todo el tiempo', () => {
    expect(sumarVisitas(datos, 0, ahora).personas).toBe(19);
  });
  test('sin datos', () => {
    expect(sumarVisitas({}, 0, ahora)).toEqual({ personas: 0, dias: 1, porDia: 0 });
  });
  test('diaLocal arma el id del documento', () => {
    expect(diaLocal(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
